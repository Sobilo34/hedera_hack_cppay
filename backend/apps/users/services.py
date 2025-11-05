"""
Business logic services for user management
"""
from typing import Optional, Tuple
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from core.security import (
    hash_password,
    verify_password,
    generate_verification_token,
    validate_password_strength
)

User = get_user_model()


class UserService:
    """Service class for user-related operations"""
    
    @staticmethod
    def create_user(
        email: str,
        password: str,
        phone_number: Optional[str] = None,
        referral_code: Optional[str] = None
    ) -> Tuple[User, str]:
        """
        Create a new user account
        
        Args:
            email: User email address
            password: Plain text password
            phone_number: Optional phone number
            referral_code: Optional referral code from another user
            
        Returns:
            Tuple of (User object, error message if any)
            
        Raises:
            ValueError: If validation fails
        """
        # Validate password strength
        is_valid, error_msg = validate_password_strength(password)
        if not is_valid:
            raise ValueError(error_msg)
        
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            raise ValueError("Email already registered")
        
        # Check if phone number already exists (field name is 'phone')
        if phone_number and User.objects.filter(phone=phone_number).exists():
            raise ValueError("Phone number already registered")
        
        # Handle referral code
        referred_by_user = None
        if referral_code:
            try:
                referred_by_user = User.objects.get(referral_code=referral_code)
            except User.DoesNotExist:
                raise ValueError("Invalid referral code")
        
        # Create user
        with transaction.atomic():
            # Use Django's create_user which handles password hashing automatically
            user = User.objects.create_user(
                email=email,
                password=password,  # Django will hash this automatically
                phone=phone_number,  # Field name is 'phone' in the model
                referred_by=referred_by_user
            )
            
            # Create email verification token
            from apps.users.models import EmailVerificationToken
            token = generate_verification_token()
            EmailVerificationToken.objects.create(
                user=user,
                token=token,
                expires_at=timezone.now() + timedelta(hours=24)
            )
            
            # TODO: Send verification email (will be handled by Celery task)
            # from apps.users.tasks import send_verification_email
            # send_verification_email.delay(user.id, token)
        
        return user, token
    
    @staticmethod
    def authenticate_user(email: str, password: str) -> Optional[User]:
        """
        Authenticate user with email and password
        
        Args:
            email: User email address
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return None
        
        if not user.is_active:
            return None
        
        # Use Django's check_password instead of custom verify_password
        if not user.check_password(password):
            return None
        
        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        
        return user
    
    @staticmethod
    def verify_email(token: str) -> Tuple[bool, str]:
        """
        Verify user email with token
        
        Args:
            token: Email verification token
            
        Returns:
            Tuple of (success, message)
        """
        from apps.users.models import EmailVerificationToken
        
        try:
            verification = EmailVerificationToken.objects.select_related('user').get(
                token=token,
                is_used=False
            )
        except EmailVerificationToken.DoesNotExist:
            return False, "Invalid or expired verification token"
        
        # Check if token has expired
        if verification.expires_at < timezone.now():
            return False, "Verification token has expired"
        
        # Mark email as verified
        with transaction.atomic():
            verification.user.email_verified = True
            verification.user.save(update_fields=['email_verified'])
            
            verification.is_used = True
            verification.used_at = timezone.now()
            verification.save(update_fields=['is_used', 'used_at'])
        
        return True, "Email verified successfully"
    
    @staticmethod
    def request_password_reset(email: str) -> Tuple[bool, Optional[str]]:
        """
        Request password reset for user
        
        Args:
            email: User email address
            
        Returns:
            Tuple of (success, reset_token if successful)
        """
        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            # Don't reveal if email exists or not (security)
            return True, None
        
        from apps.users.models import PasswordResetToken
        
        # Invalidate any existing reset tokens
        PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True, used_at=timezone.now())
        
        # Create new reset token
        token = generate_verification_token()
        PasswordResetToken.objects.create(
            user=user,
            token=token,
            expires_at=timezone.now() + timedelta(hours=1)
        )
        
        # TODO: Send reset email (will be handled by Celery task)
        # from apps.users.tasks import send_password_reset_email
        # send_password_reset_email.delay(user.id, token)
        
        return True, token
    
    @staticmethod
    def reset_password(token: str, new_password: str) -> Tuple[bool, str]:
        """
        Reset user password with token
        
        Args:
            token: Password reset token
            new_password: New plain text password
            
        Returns:
            Tuple of (success, message)
        """
        from apps.users.models import PasswordResetToken
        
        # Validate password strength
        is_valid, error_msg = validate_password_strength(new_password)
        if not is_valid:
            return False, error_msg
        
        try:
            reset_token = PasswordResetToken.objects.select_related('user').get(
                token=token,
                is_used=False
            )
        except PasswordResetToken.DoesNotExist:
            return False, "Invalid or expired reset token"
        
        # Check if token has expired
        if reset_token.expires_at < timezone.now():
            return False, "Reset token has expired"
        
        # Reset password
        with transaction.atomic():
            user = reset_token.user
            user.password = hash_password(new_password)
            user.save(update_fields=['password'])
            
            reset_token.is_used = True
            reset_token.used_at = timezone.now()
            reset_token.save(update_fields=['is_used', 'used_at'])
            
            # Invalidate all user's tokens (force re-login)
            from apps.users.models import TokenBlacklist
            # This would require storing all active tokens, 
            # for now we'll just mark the reset as used
        
        return True, "Password reset successfully"
    
    @staticmethod
    def change_password(user: User, current_password: str, new_password: str) -> Tuple[bool, str]:
        """
        Change user password (authenticated user)
        
        Args:
            user: User object
            current_password: Current plain text password
            new_password: New plain text password
            
        Returns:
            Tuple of (success, message)
        """
        # Verify current password
        if not verify_password(current_password, user.password):
            return False, "Current password is incorrect"
        
        # Validate new password strength
        is_valid, error_msg = validate_password_strength(new_password)
        if not is_valid:
            return False, error_msg
        
        # Check if new password is same as current
        if current_password == new_password:
            return False, "New password must be different from current password"
        
        # Change password
        user.password = hash_password(new_password)
        user.save(update_fields=['password'])
        
        return True, "Password changed successfully"
