"""
Wallet Management API
Endpoints for wallet registration, gas allowance tracking, and transaction recording
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from api.schemas.wallet import (
    WalletRegisterRequest,
    WalletResponse,
    GasAllowanceResponse,
    VerifyUserRequest,
    TransactionCreateRequest,
    TransactionResponse,
    MessageResponse
)
from api.dependencies import get_current_user, require_email_verified
from apps.users.models import User
from apps.wallets.models import Wallet
from apps.transactions.models import Transaction
from core.database import get_db
from core.blockchain.client import get_web3_client
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wallets", tags=["Wallets"])


@router.post("/register", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
async def register_wallet(
    request: WalletRegisterRequest,
    current_user: User = Depends(require_email_verified),
    db: AsyncSession = Depends(get_db)
):
    """
    Register/link a wallet to user account
    
    - **eoa_address**: EOA (Externally Owned Account) address
    - **smart_account_address**: Smart account address (optional, can be derived later)
    - **network**: Network name (e.g., "lisk-sepolia")
    - **chain_id**: Chain ID (e.g., 4202 for Lisk Sepolia)
    """
    try:
        # Validate address format
        web3_client = get_web3_client(request.chain_id)
        if not web3_client.is_valid_address(request.eoa_address):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid EOA address format"
            )
        
        # Check if wallet already exists
        existing_wallet = await db.execute(
            db.query(Wallet).filter(
                Wallet.eoa_address == request.eoa_address,
                Wallet.user_id == current_user.id
            )
        )
        if existing_wallet.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wallet already registered"
            )
        
        # Get balance from blockchain
        try:
            balance = web3_client.get_balance(request.eoa_address)
        except Exception as e:
            logger.warning(f"Could not fetch balance: {e}")
            balance = Decimal('0')
        
        # Create wallet record
        wallet = Wallet(
            user_id=current_user.id,
            eoa_address=request.eoa_address,
            smart_account_address=request.smart_account_address,
            network=request.network,
            chain_id=request.chain_id,
            is_active=True
        )
        
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
        
        logger.info(f"Wallet registered for user {current_user.id}: {request.eoa_address}")
        
        return WalletResponse(
            id=wallet.id,
            user_id=wallet.user_id,
            eoa_address=wallet.eoa_address,
            smart_account_address=wallet.smart_account_address,
            network=wallet.network,
            chain_id=wallet.chain_id,
            is_active=wallet.is_active,
            balance_eth=balance,
            created_at=wallet.created_at,
            updated_at=wallet.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering wallet: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register wallet: {str(e)}"
        )


@router.get("/", response_model=List[WalletResponse])
async def get_user_wallets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all wallets for current user
    """
    try:
        result = await db.execute(
            db.query(Wallet).filter(Wallet.user_id == current_user.id)
        )
        wallets = result.scalars().all()
        
        # Enrich with balance data
        wallet_responses = []
        for wallet in wallets:
            try:
                web3_client = get_web3_client(wallet.chain_id)
                balance = web3_client.get_balance(wallet.eoa_address)
            except Exception as e:
                logger.warning(f"Could not fetch balance for {wallet.eoa_address}: {e}")
                balance = Decimal('0')
            
            wallet_responses.append(WalletResponse(
                id=wallet.id,
                user_id=wallet.user_id,
                eoa_address=wallet.eoa_address,
                smart_account_address=wallet.smart_account_address,
                network=wallet.network,
                chain_id=wallet.chain_id,
                is_active=wallet.is_active,
                balance_eth=balance,
                created_at=wallet.created_at,
                updated_at=wallet.updated_at
            ))
        
        return wallet_responses
        
    except Exception as e:
        logger.error(f"Error fetching wallets: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch wallets"
        )


@router.get("/{wallet_address}/gas-allowance", response_model=GasAllowanceResponse)
async def get_gas_allowance(
    wallet_address: str,
    chain_id: int = 4202,
    current_user: User = Depends(require_email_verified),
    db: AsyncSession = Depends(get_db)
):
    """
    Get gas allowance status for wallet from CPPayPaymaster contract
    
    - **wallet_address**: User's wallet address (EOA or smart account)
    - **chain_id**: Chain ID (default: 4202 for Lisk Sepolia)
    
    Returns:
    - remaining: Remaining gas in ETH
    - limit: Daily limit in ETH
    - used: Gas used today in ETH
    - reset_time: Unix timestamp when allowance resets
    - is_verified: Whether user is KYC verified (2x limit)
    - percent_used: Percentage of daily limit used
    - can_sponsor: Whether next transaction can be sponsored
    """
    try:
        # Verify wallet belongs to user
        result = await db.execute(
            db.query(Wallet).filter(
                (Wallet.eoa_address == wallet_address.lower()) | 
                (Wallet.smart_account_address == wallet_address.lower()),
                Wallet.user_id == current_user.id
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found or does not belong to user"
            )
        
        # Get gas allowance from contract
        web3_client = get_web3_client(chain_id)
        status_data = web3_client.get_gas_allowance_status(wallet_address)
        
        return GasAllowanceResponse(**status_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching gas allowance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch gas allowance: {str(e)}"
        )


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def record_transaction(
    request: TransactionCreateRequest,
    current_user: User = Depends(require_email_verified),
    db: AsyncSession = Depends(get_db)
):
    """
    Record a transaction from frontend
    
    Frontend calls this after sending a transaction to record it in the database
    for history tracking and analytics.
    
    - **tx_hash**: Transaction hash
    - **wallet_address**: User's wallet address
    - **to_address**: Destination address
    - **value**: Transaction value in ETH
    - **gas_used**: Gas used in ETH (optional, will be updated later)
    - **gas_sponsored**: Whether gas was sponsored by paymaster
    - **status**: Transaction status (default: "pending")
    - **chain_id**: Chain ID
    """
    try:
        # Verify wallet belongs to user
        result = await db.execute(
            db.query(Wallet).filter(
                (Wallet.eoa_address == request.wallet_address) | 
                (Wallet.smart_account_address == request.wallet_address),
                Wallet.user_id == current_user.id
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found"
            )
        
        # Check if transaction already recorded
        existing_tx = await db.execute(
            db.query(Transaction).filter(Transaction.tx_hash == request.tx_hash)
        )
        if existing_tx.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction already recorded"
            )
        
        # Create transaction record
        transaction = Transaction(
            user_id=current_user.id,
            wallet_id=wallet.id,
            tx_hash=request.tx_hash,
            from_address=request.wallet_address,
            to_address=request.to_address,
            value=request.value,
            gas_used=request.gas_used,
            gas_sponsored=request.gas_sponsored,
            status=request.status,
            chain_id=request.chain_id,
            transaction_type="transfer"  # Default type
        )
        
        db.add(transaction)
        await db.commit()
        await db.refresh(transaction)
        
        logger.info(f"Transaction recorded: {request.tx_hash}")
        
        return TransactionResponse(
            id=transaction.id,
            user_id=transaction.user_id,
            wallet_id=transaction.wallet_id,
            tx_hash=transaction.tx_hash,
            to_address=transaction.to_address,
            value=transaction.value,
            gas_used=transaction.gas_used,
            gas_sponsored=transaction.gas_sponsored,
            status=transaction.status,
            chain_id=transaction.chain_id,
            created_at=transaction.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording transaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record transaction: {str(e)}"
        )


@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    wallet_address: str = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get transaction history for user
    
    - **wallet_address**: Filter by specific wallet (optional)
    - **limit**: Max number of transactions to return (default: 50)
    """
    try:
        query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
        
        if wallet_address:
            # Verify wallet belongs to user
            wallet_result = await db.execute(
                db.query(Wallet).filter(
                    (Wallet.eoa_address == wallet_address.lower()) | 
                    (Wallet.smart_account_address == wallet_address.lower()),
                    Wallet.user_id == current_user.id
                )
            )
            wallet = wallet_result.scalar_one_or_none()
            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Wallet not found"
                )
            query = query.filter(Transaction.wallet_id == wallet.id)
        
        result = await db.execute(
            query.order_by(Transaction.created_at.desc()).limit(limit)
        )
        transactions = result.scalars().all()
        
        return [
            TransactionResponse(
                id=tx.id,
                user_id=tx.user_id,
                wallet_id=tx.wallet_id,
                tx_hash=tx.tx_hash,
                to_address=tx.to_address,
                value=tx.value,
                gas_used=tx.gas_used,
                gas_sponsored=tx.gas_sponsored,
                status=tx.status,
                chain_id=tx.chain_id,
                created_at=tx.created_at
            )
            for tx in transactions
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch transactions"
        )
