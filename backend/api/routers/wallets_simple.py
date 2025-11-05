"""
Simple Wallet Router - Django ORM based
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from asgiref.sync import sync_to_async
from pydantic import BaseModel
from uuid import UUID

from api.dependencies import get_current_user
from django.contrib.auth import get_user_model
from apps.wallets.models import Wallet

User = get_user_model()

router = APIRouter()


class WalletCreate(BaseModel):
    smart_account_address: str
    owner_address: str  # This is eoa_address
    wallet_type: str  # Ignored for now
    chain_id: int


class WalletOut(BaseModel):
    id: UUID
    smart_account_address: Optional[str] = None
    eoa_address: str
    chain_id: int
    network: str
    
    class Config:
        from_attributes = True


@router.post("", response_model=WalletOut, status_code=status.HTTP_201_CREATED)
async def create_wallet(
    wallet_data: WalletCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new wallet"""
    
    # Map chain_id to network name
    chain_to_network = {
        1: "ethereum",
        8453: "base",
        42161: "arbitrum",
        10: "optimism",
        137: "polygon",
        4202: "base"  # Lisk Sepolia mapped to base for now
    }
    network = chain_to_network.get(wallet_data.chain_id, "ethereum")
    
    # Check if wallet already exists (wrap Django ORM call properly)
    def check_wallet_exists():  # Must be sync function, not async!
        return Wallet.objects.filter(
            smart_account_address=wallet_data.smart_account_address,
            user=current_user
        ).exists()
    
    wallet_exists = await sync_to_async(check_wallet_exists)()
    
    if wallet_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet already exists"
        )
    
    # Create wallet (wrap Django ORM call properly)
    def create_wallet_obj():  # Must be sync function, not async!
        return Wallet.objects.create(
            user=current_user,
            smart_account_address=wallet_data.smart_account_address,
            eoa_address=wallet_data.owner_address,
            chain_id=wallet_data.chain_id,
            network=network
        )
    
    wallet = await sync_to_async(create_wallet_obj)()
    
    return wallet


@router.get("", response_model=List[WalletOut])
async def list_wallets(
    current_user: User = Depends(get_current_user)
):
    """Get all wallets for current user"""
    
    # Get wallets (wrap Django ORM call properly)
    def get_wallets():  # Must be sync function, not async!
        return list(Wallet.objects.filter(user=current_user))
    
    wallets = await sync_to_async(get_wallets)()
    
    return wallets
