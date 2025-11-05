"""
TransactionService - ERC-4337 UserOperation Management

Handles:
- Creating and submitting UserOperations
- Transaction monitoring and status tracking
- Gas estimation for UserOperations
- Bundler integration (Pimlico)
- Transaction retries and cancellations
"""
import os
import logging
import asyncio
from decimal import Decimal
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json

from web3 import Web3
from eth_utils import to_checksum_address
from eth_account import Account
import httpx

from django.db import transaction
from django.utils import timezone

from .web3_service import Web3Service
from .paymaster_service import PaymasterService
from apps.transactions.models import Transaction
from apps.wallets.models import Wallet


logger = logging.getLogger(__name__)


class TransactionService:
    """
    Service for managing ERC-4337 UserOperations and transactions
    """
    
    # Bundler RPC URLs (Pimlico)
    BUNDLER_URLS = {
        1: os.getenv('BUNDLER_URL_ETHEREUM', 'https://api.pimlico.io/v1/ethereum/rpc'),
        8453: os.getenv('BUNDLER_URL_BASE', 'https://api.pimlico.io/v1/base/rpc'),
        42161: os.getenv('BUNDLER_URL_ARBITRUM', 'https://api.pimlico.io/v1/arbitrum/rpc'),
        10: os.getenv('BUNDLER_URL_OPTIMISM', 'https://api.pimlico.io/v1/optimism/rpc'),
        137: os.getenv('BUNDLER_URL_POLYGON', 'https://api.pimlico.io/v1/polygon/rpc'),
        1135: os.getenv('BUNDLER_URL_LISK', 'https://api.pimlico.io/v2/1135/rpc'),
        4202: os.getenv('BUNDLER_URL_LISK_SEPOLIA', 'https://api.pimlico.io/v2/4202/rpc'),
    }
    
    BUNDLER_API_KEY = os.getenv('PIMLICO_API_KEY', '')
    
    # EntryPoint v0.6 address
    ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
    
    def __init__(self, chain_id: int):
        """
        Initialize Transaction Service
        
        Args:
            chain_id: EVM chain ID
        """
        self.chain_id = chain_id
        self.web3_service = Web3Service(chain_id)
        self.paymaster_service = PaymasterService(chain_id)
        self.bundler_url = self.BUNDLER_URLS.get(chain_id)
        
        if not self.bundler_url:
            raise ValueError(f"Bundler not configured for chain {chain_id}")
        
        # Add API key to URL if available
        if self.BUNDLER_API_KEY:
            self.bundler_url = f"{self.bundler_url}?apikey={self.BUNDLER_API_KEY}"
        
        logger.info(f"✅ TransactionService initialized for chain {chain_id}")
    
    async def create_send_transaction(
        self,
        sender: str,
        recipient: str,
        amount: Decimal,
        token: str,
        user_id: str,
        wallet_id: str
    ) -> Dict:
        """
        Create a send transaction (UserOperation)
        
        Args:
            sender: Sender's smart account address
            recipient: Recipient address
            amount: Amount to send
            token: Token symbol (ETH, USDC, etc.)
            user_id: User UUID
            wallet_id: Wallet UUID
            
        Returns:
            Transaction data dict
        """
        try:
            logger.info(f"📤 Creating send transaction: {amount} {token} to {recipient}")
            
            # Validate addresses
            if not self.web3_service.validate_address(sender):
                raise ValueError(f"Invalid sender address: {sender}")
            if not self.web3_service.validate_address(recipient):
                raise ValueError(f"Invalid recipient address: {recipient}")
            
            # Check balance
            if token == self.web3_service.network['native_token']:
                balance = self.web3_service.get_native_balance(sender)
            else:
                balance = self.web3_service.get_token_balance(sender, token)
            
            if balance < amount:
                raise ValueError(f"Insufficient balance. Have {balance} {token}, need {amount}")
            
            # Build call data
            if token == self.web3_service.network['native_token']:
                # Native token transfer
                call_data = self._build_native_transfer_calldata(recipient, amount)
            else:
                # ERC-20 transfer
                call_data = self._build_token_transfer_calldata(recipient, amount, token)
            
            # Estimate gas
            gas_estimate = await self._estimate_user_operation_gas(sender, call_data)
            
            # Check paymaster sponsorship
            can_sponsor, reason = self.paymaster_service.can_sponsor_gas(
                sender,
                gas_estimate['total_gas_cost']
            )
            
            # Create transaction record
            tx_record = Transaction.objects.create(
                user_id=user_id,
                wallet_id=wallet_id,
                tx_type=Transaction.TransactionType.SEND,
                status=Transaction.TransactionStatus.PENDING,
                chain_id=self.chain_id,
                from_address=sender,
                to_address=recipient,
                amount=amount,
                token=token,
                gas_sponsored=can_sponsor,
                estimated_gas=gas_estimate['total_gas'],
                metadata={
                    'gas_estimate': gas_estimate,
                    'sponsorship_reason': reason
                }
            )
            
            return {
                'transaction_id': str(tx_record.id),
                'sender': sender,
                'recipient': recipient,
                'amount': str(amount),
                'token': token,
                'call_data': call_data,
                'gas_estimate': gas_estimate,
                'gas_sponsored': can_sponsor,
                'status': 'pending'
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating send transaction: {str(e)}")
            raise
    
    async def sign_and_submit_transaction(
        self,
        tx_data: Dict,
        private_key: str
    ) -> str:
        """
        Sign and submit UserOperation to bundler
        
        Args:
            tx_data: Transaction data from create_send_transaction
            private_key: User's private key (for signing)
            
        Returns:
            UserOperation hash
        """
        try:
            logger.info(f"✍️ Signing and submitting transaction {tx_data['transaction_id']}")
            
            # Build UserOperation
            user_op = await self._build_user_operation(tx_data, private_key)
            
            # Submit to bundler
            user_op_hash = await self._submit_user_operation(user_op)
            
            # Update transaction record
            tx_record = Transaction.objects.get(id=tx_data['transaction_id'])
            tx_record.user_operation_hash = user_op_hash
            tx_record.status = Transaction.TransactionStatus.PENDING
            tx_record.save()
            
            # Start monitoring (async)
            # TODO: Trigger Celery task for monitoring
            
            logger.info(f"✅ Transaction submitted: {user_op_hash}")
            return user_op_hash
            
        except Exception as e:
            logger.error(f"❌ Error submitting transaction: {str(e)}")
            
            # Update transaction as failed
            if 'transaction_id' in tx_data:
                tx_record = Transaction.objects.get(id=tx_data['transaction_id'])
                tx_record.status = Transaction.TransactionStatus.FAILED
                tx_record.error_message = str(e)
                tx_record.save()
            
            raise
    
    async def monitor_transaction(self, user_op_hash: str) -> None:
        """
        Monitor UserOperation status until confirmed or failed
        
        Args:
            user_op_hash: UserOperation hash
        """
        try:
            logger.info(f"👀 Monitoring transaction: {user_op_hash}")
            
            max_attempts = 60  # 5 minutes (5 seconds per attempt)
            attempt = 0
            
            while attempt < max_attempts:
                # Get UserOperation receipt
                receipt = await self._get_user_operation_receipt(user_op_hash)
                
                if receipt:
                    # UserOperation was included in a transaction
                    tx_hash = receipt.get('transactionHash')
                    success = receipt.get('success', False)
                    actual_gas_used = receipt.get('actualGasUsed', 0)
                    
                    # Update transaction record
                    tx_record = Transaction.objects.filter(
                        user_operation_hash=user_op_hash
                    ).first()
                    
                    if tx_record:
                        tx_record.tx_hash = tx_hash
                        tx_record.gas_used = actual_gas_used
                        tx_record.status = (
                            Transaction.TransactionStatus.CONFIRMED if success
                            else Transaction.TransactionStatus.FAILED
                        )
                        tx_record.confirmed_at = timezone.now()
                        tx_record.save()
                        
                        # Update gas usage if sponsored
                        if tx_record.gas_sponsored:
                            self.paymaster_service.update_gas_usage(
                                tx_record.from_address,
                                actual_gas_used,
                                tx_hash
                            )
                        
                        # Send notification
                        # TODO: Trigger notification
                        
                        logger.info(f"✅ Transaction confirmed: {tx_hash}")
                    
                    return
                
                # Wait before next check
                attempt += 1
                await asyncio.sleep(5)
            
            # Timeout
            logger.warning(f"⏱️ Transaction monitoring timeout: {user_op_hash}")
            tx_record = Transaction.objects.filter(
                user_operation_hash=user_op_hash
            ).first()
            if tx_record:
                tx_record.metadata['monitoring_timeout'] = True
                tx_record.save()
                
        except Exception as e:
            logger.error(f"❌ Error monitoring transaction: {str(e)}")
    
    def get_transaction_status(self, tx_hash: str) -> Dict:
        """
        Get transaction status from blockchain
        
        Args:
            tx_hash: Transaction hash
            
        Returns:
            Status dict
        """
        try:
            receipt = self.web3_service.get_transaction_receipt(tx_hash)
            
            if not receipt:
                return {
                    'status': 'pending',
                    'confirmations': 0
                }
            
            status = 'confirmed' if receipt.get('status') == 1 else 'failed'
            block_number = receipt.get('blockNumber', 0)
            current_block = self.web3_service.get_block_number()
            confirmations = current_block - block_number
            
            return {
                'status': status,
                'confirmations': confirmations,
                'block_number': block_number,
                'gas_used': receipt.get('gasUsed', 0)
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting transaction status: {str(e)}")
            return {'status': 'unknown', 'error': str(e)}
    
    async def estimate_transaction_cost(
        self,
        tx_type: str,
        from_address: str,
        to_address: str,
        amount: Decimal,
        token: str
    ) -> Dict:
        """
        Estimate transaction cost
        
        Args:
            tx_type: Transaction type (send, swap, payment)
            from_address: Sender address
            to_address: Recipient address
            amount: Amount to send
            token: Token symbol
            
        Returns:
            Cost estimate dict
        """
        try:
            # Build call data
            if token == self.web3_service.network['native_token']:
                call_data = self._build_native_transfer_calldata(to_address, amount)
            else:
                call_data = self._build_token_transfer_calldata(to_address, amount, token)
            
            # Estimate gas
            gas_estimate = await self._estimate_user_operation_gas(from_address, call_data)
            
            # Check sponsorship
            can_sponsor, reason = self.paymaster_service.can_sponsor_gas(
                from_address,
                gas_estimate['total_gas_cost']
            )
            
            gas_price = self.web3_service.get_gas_price()
            
            return {
                'gas_estimate': gas_estimate['total_gas'],
                'gas_price_gwei': self.web3_service.w3.from_wei(gas_price['max_fee'], 'gwei'),
                'total_cost_eth': self.web3_service.w3.from_wei(
                    gas_estimate['total_gas_cost'],
                    'ether'
                ),
                'sponsored': can_sponsor,
                'sponsorship_reason': reason
            }
            
        except Exception as e:
            logger.error(f"❌ Error estimating cost: {str(e)}")
            raise
    
    # ============================================================================
    # PRIVATE HELPER METHODS
    # ============================================================================
    
    def _build_native_transfer_calldata(self, recipient: str, amount: Decimal) -> str:
        """Build calldata for native token transfer"""
        # Simple ETH transfer: execute(to, value, data)
        # This is for Simple Account, adjust based on your smart account implementation
        recipient_checksum = to_checksum_address(recipient)
        amount_wei = self.web3_service.w3.to_wei(amount, 'ether')
        
        # encode execute(address,uint256,bytes)
        from web3 import Web3
        execute_selector = Web3.keccak(text='execute(address,uint256,bytes)')[:4].hex()
        
        # Encode parameters
        encoded = Web3.solidity_keccak(
            ['address', 'uint256', 'bytes'],
            [recipient_checksum, amount_wei, b'']
        ).hex()
        
        return f"0x{execute_selector}{encoded}"
    
    def _build_token_transfer_calldata(self, recipient: str, amount: Decimal, token: str) -> str:
        """Build calldata for ERC-20 token transfer"""
        token_address = self.web3_service.get_token_address(token, self.chain_id)
        if not token_address:
            raise ValueError(f"Token {token} not supported on chain {self.chain_id}")
        
        recipient_checksum = to_checksum_address(recipient)
        token_checksum = to_checksum_address(token_address)
        
        # Get token decimals
        # Assume 6 decimals for USDC/USDT, 18 for others
        decimals = 6 if token in ['USDC', 'USDT'] else 18
        amount_raw = int(amount * Decimal(10 ** decimals))
        
        # ERC-20 transfer function: transfer(address,uint256)
        from web3 import Web3
        transfer_selector = Web3.keccak(text='transfer(address,uint256)')[:4].hex()
        
        # Encode parameters
        encoded_recipient = recipient_checksum[2:].zfill(64)
        encoded_amount = hex(amount_raw)[2:].zfill(64)
        
        transfer_data = f"0x{transfer_selector}{encoded_recipient}{encoded_amount}"
        
        # Wrap in execute() call to token contract
        execute_selector = Web3.keccak(text='execute(address,uint256,bytes)')[:4].hex()
        
        # encode execute(tokenAddress, 0, transfer_data)
        encoded_token = token_checksum[2:].zfill(64)
        encoded_value = "0" * 64  # 0 ETH value
        encoded_data_offset = hex(96)[2:].zfill(64)  # offset to data
        encoded_data_length = hex(len(transfer_data[2:]) // 2)[2:].zfill(64)
        encoded_data = transfer_data[2:] + "0" * (64 - len(transfer_data[2:]) % 64)
        
        return f"0x{execute_selector}{encoded_token}{encoded_value}{encoded_data_offset}{encoded_data_length}{encoded_data}"
    
    async def _estimate_user_operation_gas(self, sender: str, call_data: str) -> Dict:
        """Estimate gas for UserOperation"""
        try:
            # Call bundler's eth_estimateUserOperationGas
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.bundler_url,
                    json={
                        'jsonrpc': '2.0',
                        'id': 1,
                        'method': 'eth_estimateUserOperationGas',
                        'params': [
                            {
                                'sender': sender,
                                'nonce': '0x0',  # Will be filled by bundler
                                'initCode': '0x',
                                'callData': call_data,
                                'paymasterAndData': '0x',
                            },
                            self.ENTRYPOINT_ADDRESS
                        ]
                    },
                    timeout=30
                )
                
                result = response.json()
                
                if 'error' in result:
                    raise Exception(f"Gas estimation error: {result['error']}")
                
                gas_data = result['result']
                
                # Calculate total
                call_gas = int(gas_data.get('callGasLimit', '0x0'), 16)
                verification_gas = int(gas_data.get('verificationGasLimit', '0x0'), 16)
                pre_verification_gas = int(gas_data.get('preVerificationGas', '0x0'), 16)
                
                total_gas = call_gas + verification_gas + pre_verification_gas
                
                # Get gas price
                gas_price = self.web3_service.get_gas_price()
                total_cost = total_gas * gas_price['max_fee']
                
                return {
                    'call_gas_limit': call_gas,
                    'verification_gas_limit': verification_gas,
                    'pre_verification_gas': pre_verification_gas,
                    'total_gas': total_gas,
                    'total_gas_cost': total_cost
                }
                
        except Exception as e:
            logger.error(f"❌ Gas estimation failed: {str(e)}")
            # Return conservative estimates
            return {
                'call_gas_limit': 200000,
                'verification_gas_limit': 100000,
                'pre_verification_gas': 50000,
                'total_gas': 350000,
                'total_gas_cost': 350000 * self.web3_service.get_gas_price()['max_fee']
            }
    
    async def _build_user_operation(self, tx_data: Dict, private_key: str) -> Dict:
        """Build complete UserOperation"""
        # This is a simplified version
        # In production, use your smart account's actual implementation
        
        sender = tx_data['sender']
        call_data = tx_data['call_data']
        gas_estimate = tx_data['gas_estimate']
        
        # Get nonce (placeholder - should query from smart account)
        nonce = 0
        
        # Get paymaster data if sponsored
        paymaster_data = '0x'
        if tx_data['gas_sponsored']:
            paymaster_data = self.paymaster_service.generate_paymaster_data(
                sender,
                gas_estimate['total_gas_cost']
            ) or '0x'
        
        user_op = {
            'sender': sender,
            'nonce': hex(nonce),
            'initCode': '0x',
            'callData': call_data,
            'callGasLimit': hex(gas_estimate['call_gas_limit']),
            'verificationGasLimit': hex(gas_estimate['verification_gas_limit']),
            'preVerificationGas': hex(gas_estimate['pre_verification_gas']),
            'maxFeePerGas': hex(self.web3_service.get_gas_price()['max_fee']),
            'maxPriorityFeePerGas': hex(self.web3_service.get_gas_price()['max_priority_fee']),
            'paymasterAndData': paymaster_data,
            'signature': '0x'  # Will be filled after signing
        }
        
        # Sign UserOperation
        # TODO: Implement proper signature based on your smart account
        user_op['signature'] = '0x' + '00' * 65  # Placeholder
        
        return user_op
    
    async def _submit_user_operation(self, user_op: Dict) -> str:
        """Submit UserOperation to bundler"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.bundler_url,
                    json={
                        'jsonrpc': '2.0',
                        'id': 1,
                        'method': 'eth_sendUserOperation',
                        'params': [user_op, self.ENTRYPOINT_ADDRESS]
                    },
                    timeout=30
                )
                
                result = response.json()
                
                if 'error' in result:
                    raise Exception(f"Bundler error: {result['error']}")
                
                user_op_hash = result['result']
                return user_op_hash
                
        except Exception as e:
            logger.error(f"❌ Failed to submit UserOperation: {str(e)}")
            raise
    
    async def _get_user_operation_receipt(self, user_op_hash: str) -> Optional[Dict]:
        """Get UserOperation receipt from bundler"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.bundler_url,
                    json={
                        'jsonrpc': '2.0',
                        'id': 1,
                        'method': 'eth_getUserOperationReceipt',
                        'params': [user_op_hash]
                    },
                    timeout=30
                )
                
                result = response.json()
                
                if 'error' in result:
                    return None
                
                return result.get('result')
                
        except Exception as e:
            logger.error(f"❌ Error getting UserOperation receipt: {str(e)}")
            return None
