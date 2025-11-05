"""
Admin API for user verification and gas sponsorship management
ADMIN ONLY endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from api.schemas.wallet import VerifyUserRequest, MessageResponse
from api.dependencies import get_current_user
from apps.users.models import User
from apps.wallets.models import Wallet
from apps.gas_sponsorship.models import GasSponsorship
from core.database import get_db
from core.blockchain.client import get_web3_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: User = Depends(get_current_user)):
    """Dependency to require admin role"""
    if not current_user.is_staff and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.post("/verify-user", response_model=MessageResponse)
async def verify_user_for_gas_sponsorship(
    request: VerifyUserRequest,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark user as verified for increased gas sponsorship (2x limit)
    
    **ADMIN ONLY**
    
    This endpoint should be called after user completes KYC verification.
    Verified users get 2x daily gas limit (2 ETH instead of 1 ETH).
    
    - **wallet_address**: User's wallet address to verify
    - **kyc_tier**: KYC tier (1-3), determines multiplier
    
    Note: This updates the database record. The smart contract has its own
    verifyUser() function that needs to be called separately (requires admin wallet).
    """
    try:
        # Find wallet
        result = await db.execute(
            db.query(Wallet).filter(
                (Wallet.eoa_address == request.wallet_address.lower()) | 
                (Wallet.smart_account_address == request.wallet_address.lower())
            )
        )
        wallet = result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found"
            )
        
        # Find or create gas sponsorship record
        gas_sponsorship_result = await db.execute(
            db.query(GasSponsorship).filter(GasSponsorship.user_id == wallet.user_id)
        )
        gas_sponsorship = gas_sponsorship_result.scalar_one_or_none()
        
        if not gas_sponsorship:
            # Create new gas sponsorship record
            gas_sponsorship = GasSponsorship(
                user_id=wallet.user_id,
                wallet_address=request.wallet_address.lower(),
                is_verified=True,
                kyc_tier=request.kyc_tier,
                chain_id=4202,  # Lisk Sepolia
                is_active=True
            )
            db.add(gas_sponsorship)
        else:
            # Update existing record
            gas_sponsorship.is_verified = True
            gas_sponsorship.kyc_tier = request.kyc_tier
            gas_sponsorship.is_active = True
        
        await db.commit()
        
        logger.info(f"User {wallet.user_id} verified for gas sponsorship (tier {request.kyc_tier})")
        
        return MessageResponse(
            message=f"User verified successfully. Tier {request.kyc_tier} activated."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify user: {str(e)}"
        )


@router.post("/unverify-user", response_model=MessageResponse)
async def unverify_user(
    wallet_address: str,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove verification status from user (back to 1x gas limit)
    
    **ADMIN ONLY**
    """
    try:
        # Find wallet
        result = await db.execute(
            db.query(Wallet).filter(
                (Wallet.eoa_address == wallet_address.lower()) | 
                (Wallet.smart_account_address == wallet_address.lower())
            )
        )
        wallet = result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found"
            )
        
        # Find gas sponsorship record
        gas_sponsorship_result = await db.execute(
            db.query(GasSponsorship).filter(GasSponsorship.user_id == wallet.user_id)
        )
        gas_sponsorship = gas_sponsorship_result.scalar_one_or_none()
        
        if gas_sponsorship:
            gas_sponsorship.is_verified = False
            gas_sponsorship.kyc_tier = 0
            await db.commit()
        
        logger.info(f"User {wallet.user_id} unverified")
        
        return MessageResponse(
            message="User unverified successfully. Back to standard gas limit."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unverifying user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unverify user"
        )


@router.get("/gas-stats", response_model=dict)
async def get_gas_sponsorship_stats(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get gas sponsorship statistics
    
    **ADMIN ONLY**
    
    Returns:
    - Total users with gas sponsorship
    - Verified vs unverified users
    - Total gas sponsored today
    - Average gas usage per user
    """
    try:
        # Count total gas sponsorship records
        total_result = await db.execute(
            db.query(GasSponsorship).count()
        )
        total_users = total_result.scalar()
        
        # Count verified users
        verified_result = await db.execute(
            db.query(GasSponsorship).filter(GasSponsorship.is_verified == True).count()
        )
        verified_users = verified_result.scalar()
        
        # Calculate total gas used today
        gas_sponsorships = await db.execute(
            db.query(GasSponsorship).filter(GasSponsorship.is_active == True)
        )
        sponsorships = gas_sponsorships.scalars().all()
        
        total_gas_used = sum(s.used_today for s in sponsorships)
        
        return {
            "total_users": total_users,
            "verified_users": verified_users,
            "unverified_users": total_users - verified_users,
            "total_gas_used_today_eth": float(total_gas_used),
            "average_gas_per_user_eth": float(total_gas_used / total_users) if total_users > 0 else 0,
        }
        
    except Exception as e:
        logger.error(f"Error fetching gas stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch statistics"
        )
