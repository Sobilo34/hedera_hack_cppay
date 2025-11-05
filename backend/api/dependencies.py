"""
FastAPI dependencies for authentication and authorization
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async

from core.security import decode_token

User = get_user_model()

# Security scheme for JWT tokens
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Dependency to get current authenticated user from JWT token
    
    Args:
        credentials: HTTP Bearer token credentials
        
    Returns:
        User object if token is valid
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials
    
    # Decode token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check token type
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user ID from token
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if token is blacklisted (wrap Django ORM in sync_to_async)
    from apps.users.models import TokenBlacklist
    is_blacklisted = await sync_to_async(TokenBlacklist.objects.filter(token=token).exists)()
    if is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database (wrap Django ORM in sync_to_async)
    try:
        user = await sync_to_async(User.objects.get)(id=user_id)
    except User.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to ensure user account is active
    
    Args:
        current_user: Current user from get_current_user
        
    Returns:
        User object if account is active
        
    Raises:
        HTTPException: If user account is not active
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
    return current_user


async def require_email_verified(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency to ensure user email is verified
    
    Args:
        current_user: Current active user
        
    Returns:
        User object if email is verified
        
    Raises:
        HTTPException: If email is not verified
    """
    if not current_user.email_verified:  # Fixed: model uses 'email_verified' not 'is_email_verified'
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )
    return current_user


async def require_kyc_tier(min_tier: int):
    """
    Dependency factory to require minimum KYC tier
    
    Args:
        min_tier: Minimum required KYC tier (0-3)
        
    Returns:
        Dependency function that checks KYC tier
    """
    async def check_kyc_tier(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.kyc_tier < min_tier:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"KYC tier {min_tier} or higher required. Current tier: {current_user.kyc_tier}"
            )
        return current_user
    
    return check_kyc_tier


async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency to require admin or staff user
    
    Args:
        current_user: Current active user
        
    Returns:
        User object if user is admin/staff
        
    Raises:
        HTTPException: If user is not admin/staff
    """
    if not (current_user.is_staff or current_user.is_superuser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


# Optional user dependency (doesn't raise exception if no token)
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    """
    Optional dependency to get current user without raising exception
    
    Args:
        credentials: Optional HTTP Bearer token credentials
        
    Returns:
        User object if token is valid, None otherwise
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
