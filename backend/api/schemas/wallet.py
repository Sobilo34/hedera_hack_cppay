"""
Wallet-related Pydantic schemas
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class WalletRegisterRequest(BaseModel):
    """Register/link wallet to user account"""
    eoa_address: str = Field(..., description="EOA (Externally Owned Account) address")
    smart_account_address: Optional[str] = Field(None, description="Smart account address (optional)")
    network: str = Field(default="lisk-sepolia", description="Network name")
    chain_id: int = Field(default=4202, description="Chain ID")
    
    @field_validator('eoa_address', 'smart_account_address')
    @classmethod
    def validate_address(cls, v):
        if v and not v.startswith('0x'):
            raise ValueError('Address must start with 0x')
        if v and len(v) != 42:
            raise ValueError('Invalid Ethereum address length')
        return v.lower()


class WalletResponse(BaseModel):
    """Wallet information response"""
    id: int
    user_id: int
    eoa_address: str
    smart_account_address: Optional[str]
    network: str
    chain_id: int
    is_active: bool
    balance_eth: Optional[Decimal]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class GasAllowanceResponse(BaseModel):
    """Gas allowance status from contract"""
    remaining: Decimal = Field(..., description="Remaining gas in ETH")
    limit: Decimal = Field(..., description="Daily limit in ETH")
    used: Decimal = Field(..., description="Gas used today in ETH")
    reset_time: int = Field(..., description="Unix timestamp when allowance resets")
    is_verified: bool = Field(..., description="Whether user is KYC verified")
    percent_used: float = Field(..., description="Percentage of daily limit used (0-100)")
    can_sponsor: bool = Field(..., description="Whether next transaction can be sponsored")


class VerifyUserRequest(BaseModel):
    """Request to verify user for increased gas limits"""
    wallet_address: str = Field(..., description="User's wallet address")
    kyc_tier: int = Field(default=1, ge=1, le=3, description="KYC tier (1-3)")
    
    @field_validator('wallet_address')
    @classmethod
    def validate_address(cls, v):
        if not v.startswith('0x'):
            raise ValueError('Address must start with 0x')
        if len(v) != 42:
            raise ValueError('Invalid Ethereum address length')
        return v.lower()


class TransactionCreateRequest(BaseModel):
    """Record transaction from frontend"""
    tx_hash: str = Field(..., description="Transaction hash")
    wallet_address: str = Field(..., description="User's wallet address")
    to_address: str = Field(..., description="Destination address")
    value: Decimal = Field(..., description="Transaction value in ETH")
    gas_used: Optional[Decimal] = Field(None, description="Gas used in ETH")
    gas_sponsored: bool = Field(default=False, description="Whether gas was sponsored")
    status: str = Field(default="pending", description="Transaction status")
    chain_id: int = Field(default=4202, description="Chain ID")
    
    @field_validator('tx_hash', 'wallet_address', 'to_address')
    @classmethod
    def validate_hex(cls, v):
        if not v.startswith('0x'):
            raise ValueError('Must start with 0x')
        return v.lower()


class TransactionResponse(BaseModel):
    """Transaction information"""
    id: int
    user_id: int
    wallet_id: int
    tx_hash: str
    to_address: str
    value: Decimal
    gas_used: Optional[Decimal]
    gas_sponsored: bool
    status: str
    chain_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
