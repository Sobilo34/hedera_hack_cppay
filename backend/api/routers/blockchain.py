"""
Blockchain API Router - FastAPI endpoints for blockchain operations

Endpoints:
- Wallet balance queries
- Transaction creation and submission
- Gas sponsorship checks
- Smart account deployment
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from uuid import UUID

from api.dependencies import get_current_user
from apps.users.models import User
from services.blockchain import (
    Web3Service,
    PaymasterService,
    TransactionService,
    SmartAccountService
)


router = APIRouter(prefix="/blockchain")


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class NetworkInfo(BaseModel):
    """Network information"""
    chain_id: int
    name: str
    native_token: str
    explorer: str


class BalanceRequest(BaseModel):
    """Balance query request"""
    address: str
    chain_id: int
    tokens: Optional[List[str]] = None


class BalanceResponse(BaseModel):
    """Balance query response"""
    address: str
    chain_id: int
    native_balance: str
    token_balances: dict


class SendTransactionRequest(BaseModel):
    """Send transaction request"""
    wallet_id: str
    recipient: str
    amount: str
    token: str
    chain_id: int


class TransactionResponse(BaseModel):
    """Transaction response"""
    transaction_id: str
    status: str
    sender: str
    recipient: str
    amount: str
    token: str
    gas_sponsored: bool
    user_operation_hash: Optional[str] = None


class GasSponsorshipCheckRequest(BaseModel):
    """Gas sponsorship check request"""
    address: str
    chain_id: int
    estimated_gas_cost: Optional[int] = None


class GasSponsorshipResponse(BaseModel):
    """Gas sponsorship response"""
    can_sponsor: bool
    reason: str
    remaining: str
    limit: str
    reset_time: str
    is_verified: bool


class SmartAccountRequest(BaseModel):
    """Smart account deployment request"""
    eoa_address: str
    chain_id: int


class SmartAccountResponse(BaseModel):
    """Smart account response"""
    eoa_address: str
    smart_account_address: str
    is_deployed: bool
    chain_id: int


class EstimateCostRequest(BaseModel):
    """Cost estimation request"""
    from_address: str
    to_address: str
    amount: str
    token: str
    chain_id: int


class EstimateCostResponse(BaseModel):
    """Cost estimation response"""
    gas_estimate: int
    gas_price_gwei: str
    total_cost_eth: str
    sponsored: bool


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/networks", response_model=List[NetworkInfo])
async def get_supported_networks():
    """
    Get list of supported blockchain networks
    """
    try:
        networks = Web3Service.get_supported_networks()
        return networks
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching networks: {str(e)}"
        )


@router.post("/balance", response_model=BalanceResponse)
async def get_balance(
    request: BalanceRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Get native and token balances for an address
    """
    try:
        web3_service = Web3Service(request.chain_id)
        
        # Get native balance
        native_balance = web3_service.get_native_balance(request.address)
        
        # Get token balances if requested
        token_balances = {}
        if request.tokens:
            token_balances = web3_service.get_token_balances(
                request.address,
                request.tokens
            )
        
        return BalanceResponse(
            address=request.address,
            chain_id=request.chain_id,
            native_balance=str(native_balance),
            token_balances={k: str(v) for k, v in token_balances.items()}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching balance: {str(e)}"
        )


@router.post("/gas-sponsorship/check", response_model=GasSponsorshipResponse)
async def check_gas_sponsorship(
    request: GasSponsorshipCheckRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Check if user is eligible for gas sponsorship
    """
    try:
        paymaster_service = PaymasterService(request.chain_id)
        
        # Get remaining gas allowance
        gas_data = paymaster_service.get_remaining_gas(request.address)
        print(gas_data)
        
        # Check if can sponsor
        estimated_cost = request.estimated_gas_cost or 100000  # Default estimate
        can_sponsor, reason = paymaster_service.can_sponsor_gas(
            request.address,
            estimated_cost
        )
        
        return GasSponsorshipResponse(
            can_sponsor=can_sponsor,
            reason=reason,
            remaining=str(gas_data['remaining']),
            limit=str(gas_data['limit']),
            reset_time=gas_data['reset_time'],
            is_verified=gas_data['is_verified']
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error checking gas sponsorship: {str(e)}"
        )


@router.get("/gas-sponsorship/statistics/{address}/{chain_id}")
async def get_gas_statistics(
    address: str,
    chain_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get gas sponsorship statistics for user
    """
    try:
        paymaster_service = PaymasterService(chain_id)
        stats = paymaster_service.get_gas_statistics(address)
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching statistics: {str(e)}"
        )


@router.post("/smart-account/predict", response_model=SmartAccountResponse)
async def predict_smart_account(
    request: SmartAccountRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Predict smart account address for an EOA
    """
    try:
        smart_account_service = SmartAccountService(request.chain_id)
        
        # Predict address
        predicted_address = smart_account_service.predict_smart_account_address(
            request.eoa_address
        )
        
        # Check if deployed
        is_deployed = smart_account_service.is_smart_account_deployed(
            predicted_address
        )
        
        return SmartAccountResponse(
            eoa_address=request.eoa_address,
            smart_account_address=predicted_address,
            is_deployed=is_deployed,
            chain_id=request.chain_id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error predicting smart account: {str(e)}"
        )


@router.get("/smart-account/info/{address}/{chain_id}")
async def get_smart_account_info(
    address: str,
    chain_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get smart account information
    """
    try:
        smart_account_service = SmartAccountService(chain_id)
        info = smart_account_service.get_smart_account_info(address)
        return info
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching smart account info: {str(e)}"
        )


@router.post("/transaction/estimate", response_model=EstimateCostResponse)
async def estimate_transaction_cost(
    request: EstimateCostRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Estimate transaction cost
    """
    try:
        transaction_service = TransactionService(request.chain_id)
        
        estimate = await transaction_service.estimate_transaction_cost(
            'send',
            request.from_address,
            request.to_address,
            Decimal(request.amount),
            request.token
        )
        
        return EstimateCostResponse(**estimate)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error estimating cost: {str(e)}"
        )


@router.post("/transaction/send", response_model=TransactionResponse)
async def create_send_transaction(
    request: SendTransactionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a send transaction (UserOperation)
    
    Note: This only creates the transaction record.
    The client must sign and submit the UserOperation separately.
    """
    try:
        from apps.wallets.models import Wallet
        
        # Get wallet
        wallet = Wallet.objects.get(id=request.wallet_id, user=current_user)
        
        if wallet.chain_id != request.chain_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wallet chain ID mismatch"
            )
        
        # Create transaction
        transaction_service = TransactionService(request.chain_id)
        
        tx_data = await transaction_service.create_send_transaction(
            sender=wallet.smart_account_address,
            recipient=request.recipient,
            amount=Decimal(request.amount),
            token=request.token,
            user_id=str(current_user.id),
            wallet_id=request.wallet_id
        )
        
        return TransactionResponse(
            transaction_id=tx_data['transaction_id'],
            status=tx_data['status'],
            sender=tx_data['sender'],
            recipient=tx_data['recipient'],
            amount=tx_data['amount'],
            token=tx_data['token'],
            gas_sponsored=tx_data['gas_sponsored']
        )
        
    except Wallet.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating transaction: {str(e)}"
        )


@router.get("/transaction/status/{tx_hash}/{chain_id}")
async def get_transaction_status(
    tx_hash: str,
    chain_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get transaction status from blockchain
    """
    try:
        transaction_service = TransactionService(chain_id)
        status_data = transaction_service.get_transaction_status(tx_hash)
        return status_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching transaction status: {str(e)}"
        )


@router.get("/transaction/{transaction_id}")
async def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Get transaction details from database
    """
    try:
        from apps.transactions.models import Transaction
        
        tx = Transaction.objects.get(id=transaction_id, user=current_user)
        
        return {
            'id': str(tx.id),
            'status': tx.status,
            'tx_type': tx.tx_type,
            'from_address': tx.from_address,
            'to_address': tx.to_address,
            'amount': str(tx.amount),
            'token': tx.token,
            'tx_hash': tx.tx_hash,
            'user_operation_hash': tx.user_operation_hash,
            'gas_sponsored': tx.gas_sponsored,
            'gas_used': tx.gas_used,
            'created_at': tx.created_at.isoformat(),
            'confirmed_at': tx.confirmed_at.isoformat() if tx.confirmed_at else None,
        }
        
    except Transaction.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching transaction: {str(e)}"
        )
