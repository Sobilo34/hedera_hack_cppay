"""
Pydantic schemas for user-related API requests and responses
"""
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, validator
import re


class UserRegister(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: Optional[str] = None
    referral_code: Optional[str] = None
    
    @validator('phone_number')
    def validate_phone(cls, v):
        if v:
            # Remove spaces and dashes
            phone = re.sub(r'[\s-]', '', v)
            # Check if it starts with + and contains only digits after that
            if not re.match(r'^\+\d{10,15}$', phone):
                raise ValueError('Phone number must be in international format (e.g., +1234567890)')
            return phone
        return v


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema for token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Schema for token refresh request"""
    refresh_token: str


class UserResponse(BaseModel):
    """Schema for user data in responses"""
    id: UUID  # Changed from str to UUID to match Django model
    email: str
    phone_number: Optional[str] = Field(None, alias='phone')  # Model uses 'phone'
    email_verified: bool  # Match model field name
    phone_verified: bool  # Match model field name
    kyc_tier: int
    referral_code: str
    created_at: datetime
    
    class Config:
        from_attributes = True  # For Pydantic v2 compatibility
        populate_by_name = True  # Allow both field name and alias


class EmailVerificationRequest(BaseModel):
    """Schema for email verification"""
    token: str


class PhoneVerificationRequest(BaseModel):
    """Schema for phone verification with OTP"""
    phone_number: str
    otp: str


class PasswordResetRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=8)


class PasswordChange(BaseModel):
    """Schema for password change (authenticated user)"""
    current_password: str
    new_password: str = Field(..., min_length=8)


class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
