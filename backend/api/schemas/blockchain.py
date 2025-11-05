"""
Pydantic schemas for blockchain operations
Used by blockchain router for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from decimal import Decimal
from datetime import datetime


class NetworkInfo(BaseModel):
    """Network information schema"""
    chain_id: int
    name: str
    native_currency: str
    rpc_urls: List[str]
    explorer_url: str


class BalanceRequest(BaseModel):
    """Request schema for balance queries"""
    chain: str = Field(..., description="Network identifier (e.g., 'ethereum', 'base')")
    address: str = Field(..., description="Wallet address to query")
    tokens: Optional[List[str]] = Field(None, description="List of token symbols (e.g., ['USDC', 'USDT'])")


class BalanceResponse(BaseModel):
    """Response schema for balance queries"""
    address: str
    chain: str
    native_balance: str
    token_balances: Dict[str, str]


class GasSponsorshipCheckRequest(BaseModel):
    """Request schema for gas sponsorship eligibility check"""
    chain: str
    estimated_gas: int
    user_id: int


class GasSponsorshipCheckResponse(BaseModel):
    """Response schema for gas sponsorship eligibility"""
    eligible: bool
    reason: Optional[str]
    remaining_daily_allowance: str
    daily_limit: str


class SmartAccountPredictRequest(BaseModel):
    """Request schema for smart account address prediction"""
    owner_address: str
    salt: Optional[int] = Field(0, description="Salt for CREATE2 deterministic deployment")


class SmartAccountPredictResponse(BaseModel):
    """Response schema for smart account prediction"""
    predicted_address: str
    init_code: str
    factory_address: str
    is_deployed: bool


class SmartAccountInfoResponse(BaseModel):
    """Response schema for smart account info"""
    address: str
    is_deployed: bool
    owner: str
    balance: str


class TransactionEstimateRequest(BaseModel):
    """Request schema for transaction cost estimation"""
    chain: str
    from_address: str
    to_address: str
    value: Optional[str] = Field("0", description="Amount in wei")
    token: Optional[str] = Field(None, description="Token symbol for ERC-20 transfer")
    token_amount: Optional[str] = Field(None, description="Token amount in smallest unit")


class TransactionEstimateResponse(BaseModel):
    """Response schema for transaction estimate"""
    estimated_gas: int
    gas_price: str
    max_fee_per_gas: str
    max_priority_fee_per_gas: str
    total_cost_eth: str
    total_cost_usd: str
    sponsored: bool


class TransactionSendRequest(BaseModel):
    """Request schema for sending transaction"""
    chain: str
    from_address: str
    to_address: str
    value: str = Field("0", description="Amount in wei")
    token: Optional[str] = Field(None, description="Token symbol for ERC-20 transfer")
    token_amount: Optional[str] = Field(None, description="Token amount in smallest unit")
    request_gas_sponsorship: bool = Field(True, description="Request gas sponsorship if eligible")


class TransactionSendResponse(BaseModel):
    """Response schema for transaction send"""
    transaction_id: int
    status: str
    message: str
    sponsored: bool
    user_operation_hash: Optional[str] = None


class TransactionStatusResponse(BaseModel):
    """Response schema for transaction status query"""
    transaction_id: int
    status: str
    tx_hash: Optional[str]
    block_number: Optional[int]
    confirmations: int
    gas_used: Optional[int]
    gas_cost: Optional[str]
    error: Optional[str]


class GasStatisticsResponse(BaseModel):
    """Response schema for user gas statistics"""
    user_id: int
    total_sponsored: str
    used_today: str
    daily_limit: str
    remaining_today: str
    transaction_count: int
    kyc_tier: str
