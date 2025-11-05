"""
Authentication routes - Registration, Login, Token Management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from django.contrib.auth import get_user_model
from django.utils import timezone
from asgiref.sync import sync_to_async

from api.schemas.user import (
    UserRegister,
    UserLogin,
    TokenResponse,
    TokenRefresh,
    UserResponse,
    EmailVerificationRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    PasswordChange,
    MessageResponse
)
from api.dependencies import get_current_user, get_current_active_user
from apps.users.services import UserService
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token
)

User = get_user_model()
router = APIRouter()


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
    """
    Register a new user account
    
    - Creates new user with email and password
    - Sends email verification token
    - Optionally accepts phone number and referral code
    """
    try:
        # Wrap synchronous Django ORM calls in sync_to_async
        user, verification_token = await sync_to_async(UserService.create_user)(
            email=user_data.email,
            password=user_data.password,
            phone_number=user_data.phone_number,
            referral_code=user_data.referral_code
        )
        
        return {
            "message": f"User registered successfully. Verification email sent to {user.email}. Token (dev): {verification_token}"
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Login with email and password
    
    - Returns access token (30 min expiry) and refresh token (7 days)
    - Updates last login timestamp
    """
    # Wrap synchronous Django ORM calls in sync_to_async
    user = await sync_to_async(UserService.authenticate_user)(
        email=credentials.email,
        password=credentials.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token_data: TokenRefresh):
    """
    Refresh access token using refresh token
    
    - Validates refresh token
    - Returns new access token and refresh token
    """
    # Decode refresh token
    payload = decode_token(token_data.refresh_token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check token type
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if token is blacklisted - wrap ORM call
    def _check_refresh(token):
        from apps.users.models import TokenBlacklist
        return TokenBlacklist.objects.filter(token=token).exists()
    
    is_blacklisted = await sync_to_async(_check_refresh, thread_sensitive=False)(token_data.refresh_token)
    if is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user - wrap ORM call
    def _get_user(user_id):
        try:
            return User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return None
    
    user_id = payload.get("sub")
    user = await sync_to_async(_get_user, thread_sensitive=False)(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create new tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout user (token should be discarded client-side)
    
    - In production, implement token blacklisting
    - For now, client should discard the token
    """
    return {"message": "Logged out successfully. Please discard your tokens."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    Get current authenticated user information
    
    - Returns user profile data
    - Requires valid access token
    """
    return current_user


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(verification: EmailVerificationRequest):
    """
    Verify user email address with token
    
    - Validates verification token
    - Marks email as verified
    - Token expires after 24 hours
    """
    # Wrap synchronous Django ORM call in sync_to_async
    success, message = await sync_to_async(UserService.verify_email)(verification.token)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    return {"message": message}


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_email(current_user: User = Depends(get_current_user)):
    """
    Resend email verification token
    
    - Generates new verification token
    - Sends verification email
    - Requires authentication
    """
    if current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )
    
    from apps.users.models import EmailVerificationToken
    from core.security import generate_verification_token
    from datetime import timedelta
    
    # Invalidate old tokens
    EmailVerificationToken.objects.filter(user=current_user, is_used=False).update(is_used=True, used_at=timezone.now())
    
    # Create new token
    token = generate_verification_token()
    EmailVerificationToken.objects.create(
        user=current_user,
        token=token,
        expires_at=timezone.now() + timedelta(hours=24)
    )
    
    return {"message": f"Verification email sent. Token (dev): {token}"}


@router.post("/request-reset", response_model=MessageResponse)
async def request_password_reset(reset_request: PasswordResetRequest):
    """
    Request password reset email
    
    - Sends password reset email if account exists
    - Always returns success (security: don't reveal if email exists)
    - Token expires after 1 hour
    """
    def _request_reset(email):
        return UserService.request_password_reset(email)
    
    success, token = await sync_to_async(_request_reset, thread_sensitive=False)(reset_request.email)
    
    return {
        "message": f"If an account exists with this email, a password reset link has been sent. Token (dev): {token}"
    }


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(reset_data: PasswordResetConfirm):
    """
    Reset password with token
    
    - Validates reset token
    - Updates user password
    - Invalidates the token
    """
    def _reset_pwd(token, password):
        return UserService.reset_password(token=token, new_password=password)
    
    success, message = await sync_to_async(_reset_pwd, thread_sensitive=False)(
        reset_data.token,
        reset_data.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    return {"message": message}


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user)
):
    """
    Change password for authenticated user
    
    - Requires current password
    - Validates new password strength
    - Updates password
    """
    def _change_pwd(user, current_pwd, new_pwd):
        return UserService.change_password(user=user, current_password=current_pwd, new_password=new_pwd)
    
    success, message = await sync_to_async(_change_pwd, thread_sensitive=False)(
        current_user,
        password_data.current_password,
        password_data.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    return {"message": message}
