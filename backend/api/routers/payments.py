"""
Payments Router

Unified endpoints covering crypto-to-fiat payments and local payment records.
"""
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, root_validator

from api.dependencies import get_current_user
from apps.payments.models import Payment
from apps.users.models import User
from services.payments import (
	CryptoToFiatBridge,
	DEXAggregationService,
	PaystackService,
	PriceOracleService,
)

logger = logging.getLogger(__name__)
router = APIRouter()

paystack = PaystackService()
price_oracle = PriceOracleService()
dex_aggregator = DEXAggregationService()
crypto_fiat_bridge = CryptoToFiatBridge()


def _coalesce(values: Dict[str, Any], target: str, *aliases: str) -> None:
	if target in values and values[target] is not None:
		return
	for alias in aliases:
		if alias in values and values[alias] is not None:
			values[target] = values[alias]
			return


def _build_reference(prefix: str) -> str:
	return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"


async def _get_billers_by_category(category_key: str) -> List[Dict[str, Any]]:
	response = await paystack.list_billers()
	if response.get("status") != "success":
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail=response.get("message") or "Unable to fetch Paystack billers",
		)

	category_tokens = {
		token.lower() for token in PaystackService.CATEGORY_MAP.get(category_key, set())
	}

	filtered: List[Dict[str, Any]] = []
	for biller in response.get("data", []):
		category = (biller.get("category") or biller.get("type") or "").lower()
		if category_tokens and not any(token in category for token in category_tokens):
			continue
		filtered.append(
			{
				"name": biller.get("name"),
				"code": biller.get("code"),
				"short_name": biller.get("short_name"),
				"category": biller.get("category") or biller.get("type"),
			}
		)

	return filtered


def _serialize_payment(payment: Payment) -> Dict[str, Any]:
	return {
		"id": str(payment.id),
		"user_id": payment.user_id,
		"payment_type": payment.payment_type,
		"provider": payment.provider,
		"recipient_id": payment.recipient_id,
		"recipient_name": payment.recipient_name,
		"amount": str(payment.amount),
		"currency": payment.currency,
		"reference": payment.reference,
		"provider_reference": payment.provider_reference,
		"status": payment.status,
		"transaction_id": str(payment.transaction_id) if payment.transaction_id else None,
		"package_name": payment.package_name,
		"package_code": payment.package_code,
		"metadata": payment.metadata,
		"provider_response": payment.provider_response,
		"error_message": payment.error_message,
		"failure_reason": payment.failure_reason,
		"created_at": payment.created_at.isoformat() if payment.created_at else None,
		"updated_at": payment.updated_at.isoformat() if payment.updated_at else None,
		"completed_at": payment.completed_at.isoformat() if payment.completed_at else None,
	}


async def _create_payment_record(user: User, **fields: Any) -> Payment:
	def _create() -> Payment:
		return Payment.objects.create(user=user, **fields)

	return await sync_to_async(_create)()


async def _resolve_crypto_amount(
	payment_type: str,
	fiat_amount: Decimal,
	crypto_token: str,
	chain: str,
	requested_amount: Optional[Decimal],
) -> Decimal:
	if requested_amount is not None:
		return requested_amount

	estimate = await crypto_fiat_bridge.get_payment_estimate(
		payment_type=payment_type,
		fiat_amount=fiat_amount,
		crypto_token=crypto_token,
		chain=chain,
	)
	if not estimate:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Unable to calculate estimate",
		)

	return Decimal(estimate["crypto_amount_needed"])


async def _process_bridge_payment(
	*,
	user: User,
	payment_type: str,
	fiat_amount: Decimal,
	crypto_token: str,
	requested_amount: Optional[Decimal],
	chain: str,
	payment_details: Dict[str, Any],
	reference: str,
) -> Dict[str, Any]:
	crypto_amount = await _resolve_crypto_amount(
		payment_type=payment_type,
		fiat_amount=fiat_amount,
		crypto_token=crypto_token,
		chain=chain,
		requested_amount=requested_amount,
	)

	return await crypto_fiat_bridge.execute_crypto_to_fiat_payment(
		user=user,
		payment_type=payment_type,
		fiat_amount=fiat_amount,
		crypto_token=crypto_token,
		crypto_amount=crypto_amount,
		chain=chain,
		payment_details=payment_details,
		reference=reference,
	)


async def _validate_bank_account(account_number: str, bank_code: str) -> Dict[str, Any]:
	result = await paystack.resolve_account_number(
		account_number=account_number,
		bank_code=bank_code,
	)
	if result.get("status") != "success":
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=result.get("message", "Account validation failed"),
		)
	return result


# =============================================================================
# Schemas
# =============================================================================


class TokenPriceRequest(BaseModel):
	token: str = Field(..., description="Token symbol (ETH, USDC, etc.)")
	currency: str = Field("usd", description="Fiat currency (usd, ngn, eur, gbp)")


class TokenPriceResponse(BaseModel):
	token: str
	price: str
	currency: str
	timestamp: str


class PaymentEstimateRequest(BaseModel):
	payment_type: str = Field(..., description="Type: airtime, electricity, cable_tv, transfer")
	fiat_amount: Decimal = Field(..., description="Amount in NGN")
	crypto_token: str = Field(..., description="Token to pay with (ETH, USDC, etc.)")
	chain: str = Field(..., description="Blockchain network")

	@root_validator(pre=True)
	def _aliases(cls, values: Dict[str, Any]) -> Dict[str, Any]:
		_coalesce(values, "fiat_amount", "amount_ngn")
		_coalesce(values, "crypto_token", "from_token")
		_coalesce(values, "chain", "network", "blockchain_network")
		return values


class PaymentEstimateResponse(BaseModel):
	payment_type: str
	fiat_amount: str
	fiat_currency: str
	crypto_token: str
	crypto_amount_needed: str
	usd_value: str
	swap_needed: bool
	paystack_fee: str
	dex_gas_cost_usd: str
	total_cost_usd: str
	exchange_rate: str


class AirtimePurchaseRequest(BaseModel):
	phone_number: str
	amount: Decimal
	provider: str
	crypto_token: str
	crypto_amount: Optional[Decimal] = Field(
		None, description="Optional override if crypto amount already prepared"
	)
	chain: str
	user_address: str
	token_address: Optional[str] = None
	transaction_hash: Optional[str] = None

	@root_validator(pre=True)
	def _aliases(cls, values: Dict[str, Any]) -> Dict[str, Any]:
		_coalesce(values, "crypto_token", "from_token", "token_symbol")
		_coalesce(values, "chain", "network", "blockchain_network")
		_coalesce(values, "user_address", "wallet_address", "sender_address")
		return values


class ElectricityPaymentRequest(BaseModel):
	meter_number: str
	amount: Decimal
	provider: str
	meter_type: str
	crypto_token: str
	crypto_amount: Optional[Decimal] = None
	chain: str
	user_address: str

	@root_validator(pre=True)
	def _aliases(cls, values: Dict[str, Any]) -> Dict[str, Any]:
		_coalesce(values, "crypto_token", "from_token")
		_coalesce(values, "chain", "network", "blockchain_network")
		_coalesce(values, "user_address", "wallet_address")
		return values


class CableTVPaymentRequest(BaseModel):
	smartcard_number: str
	amount: Decimal
	provider: str
	bouquet_code: str
	crypto_token: str
	crypto_amount: Optional[Decimal] = None
	chain: str
	user_address: str

	@root_validator(pre=True)
	def _aliases(cls, values: Dict[str, Any]) -> Dict[str, Any]:
		_coalesce(values, "crypto_token", "from_token")
		_coalesce(values, "chain", "network", "blockchain_network")
		_coalesce(values, "user_address", "wallet_address")
		return values


class BankTransferRequest(BaseModel):
	account_number: str
	bank_code: str
	amount: Decimal
	crypto_token: str
	chain: str
	user_address: str
	crypto_amount: Optional[Decimal] = None
	beneficiary_name: Optional[str] = None
	narration: str = Field("CPPay transfer", description="Transaction narration")

	@root_validator(pre=True)
	def _aliases(cls, values: Dict[str, Any]) -> Dict[str, Any]:
		_coalesce(values, "crypto_token", "from_token")
		_coalesce(values, "chain", "network", "blockchain_network")
		_coalesce(values, "user_address", "wallet_address")
		return values


class SwapQuoteRequest(BaseModel):
	chain: str
	from_token: str
	to_token: str
	amount: Decimal = Field(..., description="Amount in human-readable units")


class SwapQuoteResponse(BaseModel):
	provider: str
	from_token: str
	to_token: str
	from_amount: str
	to_amount: str
	estimated_gas: int
	rate: str


class DataPurchaseRequest(BaseModel):
	phone_number: str
	data_plan_id: str
	amount: Decimal
	currency: str = "NGN"
	provider: str = "MTN"
	token_address: Optional[str] = None
	from_token: Optional[str] = None
	blockchain_network: Optional[str] = None
	transaction_hash: Optional[str] = None


class P2PTransferRequest(BaseModel):
	recipient_address: str
	amount: Decimal
	currency: str = "NGN"
	token_symbol: str = "USDT"
	from_token: Optional[str] = None
	blockchain_network: Optional[str] = None
	transaction_hash: Optional[str] = None
	message: Optional[str] = None


class TokenSwapRequest(BaseModel):
	from_token: str
	to_token: str
	amount: Decimal
	slippage: float


class WithdrawalRequest(BaseModel):
	amount: Decimal
	currency: str = "NGN"
	token_address: Optional[str] = None
	merchant_id: Optional[str] = None
	blockchain_network: Optional[str] = None
	transaction_hash: Optional[str] = None


class BankAccountValidationRequest(BaseModel):
	account_number: str
	bank_code: str


class PaymentResponse(BaseModel):
	success: bool
	message: str
	transaction_id: Optional[str] = None
	reference: Optional[str] = None
	metadata: Optional[Dict[str, Any]] = None


# =============================================================================
# Price endpoints
# =============================================================================


@router.post("/prices/token", response_model=TokenPriceResponse)
async def get_token_price(
	request: TokenPriceRequest,
	current_user: User = Depends(get_current_user),
):
	price = await price_oracle.get_token_price(token=request.token, currency=request.currency)
	if price is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=f"Price not available for {request.token} in {request.currency}",
		)

	return TokenPriceResponse(
		token=request.token.upper(),
		price=str(price),
		currency=request.currency.upper(),
		timestamp=str(datetime.now()),
	)


@router.get("/prices/multiple")
async def get_multiple_prices(
	tokens: str,
	currency: str = "usd",
	current_user: User = Depends(get_current_user),
):
	token_list = [token.strip() for token in tokens.split(",")]
	prices = await price_oracle.get_multiple_prices(token_list, currency)
	return {
		"currency": currency,
		"prices": {token: str(value) if value else None for token, value in prices.items()},
		"timestamp": str(datetime.now()),
	}


@router.get("/prices/ngn-rate")
async def get_ngn_exchange_rate(current_user: User = Depends(get_current_user)):
	rate = await price_oracle.get_ngn_rate()
	if rate is None:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Exchange rate temporarily unavailable",
		)

	return {
		"from": "USD",
		"to": "NGN",
		"rate": str(rate),
		"timestamp": str(datetime.now()),
	}


# =============================================================================
# Swap / DEX endpoints
# =============================================================================


@router.post("/swap/quote", response_model=SwapQuoteResponse)
async def get_swap_quote(
	request: SwapQuoteRequest,
	current_user: User = Depends(get_current_user),
):
	amount_wei = int(request.amount * (10 ** 18))
	quote = await dex_aggregator.get_best_quote(
		chain=request.chain,
		from_token=request.from_token,
		to_token=request.to_token,
		amount=amount_wei,
	)

	if not quote:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="No swap quotes available",
		)

	from_amount = Decimal(quote["from_amount"]) / (10 ** 18)
	to_amount = Decimal(quote["to_amount"]) / (10 ** 18)
	rate = to_amount / from_amount if from_amount > 0 else Decimal("0")

	return SwapQuoteResponse(
		provider=quote["provider"],
		from_token=quote["from_token"],
		to_token=quote["to_token"],
		from_amount=str(from_amount),
		to_amount=str(to_amount),
		estimated_gas=quote["estimated_gas"],
		rate=str(rate),
	)


# =============================================================================
# Payment estimates
# =============================================================================


@router.post("/estimate", response_model=PaymentEstimateResponse)
async def estimate_payment(
	request: PaymentEstimateRequest,
	current_user: User = Depends(get_current_user),
):
	estimate = await crypto_fiat_bridge.get_payment_estimate(
		payment_type=request.payment_type,
		fiat_amount=request.fiat_amount,
		crypto_token=request.crypto_token,
		chain=request.chain,
	)

	if not estimate:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Unable to calculate estimate",
		)

	return PaymentEstimateResponse(
		payment_type=estimate["payment_type"],
		fiat_amount=str(estimate["fiat_amount"]),
		fiat_currency=estimate["fiat_currency"],
		crypto_token=estimate["crypto_token"],
		crypto_amount_needed=str(estimate["crypto_amount_needed"]),
		usd_value=str(estimate["usd_value"]),
		swap_needed=estimate["swap_needed"],
		paystack_fee=str(estimate["paystack_fee"]),
		dex_gas_cost_usd=str(estimate["dex_gas_cost_usd"]),
		total_cost_usd=str(estimate["total_cost_usd"]),
		exchange_rate=str(estimate["exchange_rate"]),
	)


# =============================================================================
# Crypto-to-fiat payments
# =============================================================================


async def _airtime_payment_flow(request: AirtimePurchaseRequest, user: User) -> Dict[str, Any]:
	payment_details = {
		"phone_number": request.phone_number,
		"provider": request.provider,
		"recipient_id": request.phone_number,
		"user_address": request.user_address,
		"token_address": request.token_address,
		"transaction_hash": request.transaction_hash,
	}
	return await _process_bridge_payment(
		user=user,
		payment_type="airtime",
		fiat_amount=request.amount,
		crypto_token=request.crypto_token,
		requested_amount=request.crypto_amount,
		chain=request.chain,
		payment_details=payment_details,
		reference=_build_reference("AIRTIME"),
	)


@router.post("/airtime/buy")
async def buy_airtime(
	request: AirtimePurchaseRequest,
	current_user: User = Depends(get_current_user),
):
	return await _airtime_payment_flow(request, current_user)


@router.post("/airtime/purchase")
async def purchase_airtime(
	request: AirtimePurchaseRequest,
	current_user: User = Depends(get_current_user),
):
	return await _airtime_payment_flow(request, current_user)


@router.post("/bills/electricity")
async def pay_electricity(
	request: ElectricityPaymentRequest,
	current_user: User = Depends(get_current_user),
):
	payment_details = {
		"meter_number": request.meter_number,
		"provider": request.provider,
		"meter_type": request.meter_type,
		"recipient_id": request.meter_number,
		"user_address": request.user_address,
	}
	return await _process_bridge_payment(
		user=current_user,
		payment_type="electricity",
		fiat_amount=request.amount,
		crypto_token=request.crypto_token,
		requested_amount=request.crypto_amount,
		chain=request.chain,
		payment_details=payment_details,
		reference=_build_reference("ELEC"),
	)


@router.post("/bills/cable-tv")
async def pay_cable_tv(
	request: CableTVPaymentRequest,
	current_user: User = Depends(get_current_user),
):
	payment_details = {
		"smartcard_number": request.smartcard_number,
		"provider": request.provider,
		"bouquet_code": request.bouquet_code,
		"recipient_id": request.smartcard_number,
		"user_address": request.user_address,
	}
	return await _process_bridge_payment(
		user=current_user,
		payment_type="cable_tv",
		fiat_amount=request.amount,
		crypto_token=request.crypto_token,
		requested_amount=request.crypto_amount,
		chain=request.chain,
		payment_details=payment_details,
		reference=_build_reference("CABLE"),
	)


async def _bank_transfer_flow(request: BankTransferRequest, user: User) -> Dict[str, Any]:
	payment_details = {
		"account_number": request.account_number,
		"bank_code": request.bank_code,
		"beneficiary_name": request.beneficiary_name,
		"narration": request.narration,
		"recipient_id": request.account_number,
		"user_address": request.user_address,
	}
	return await _process_bridge_payment(
		user=user,
		payment_type="transfer",
		fiat_amount=request.amount,
		crypto_token=request.crypto_token,
		requested_amount=request.crypto_amount,
		chain=request.chain,
		payment_details=payment_details,
		reference=_build_reference("XFER"),
	)


@router.post("/transfer/bank")
async def bank_transfer(
	request: BankTransferRequest,
	current_user: User = Depends(get_current_user),
):
	return await _bank_transfer_flow(request, current_user)


@router.post("/bank/transfer")
async def bank_transfer_legacy(
	request: BankTransferRequest,
	current_user: User = Depends(get_current_user),
):
	return await _bank_transfer_flow(request, current_user)


# =============================================================================
# ORM-backed utilities
# =============================================================================


@router.post("/data/purchase", response_model=PaymentResponse)
async def purchase_data(
	request: DataPurchaseRequest,
	current_user: User = Depends(get_current_user),
):
	metadata = {
		"token_address": request.token_address,
		"from_token": request.from_token,
		"blockchain_network": request.blockchain_network,
		"transaction_hash": request.transaction_hash,
	}
	payment = await _create_payment_record(
		user=current_user,
		payment_type="internet",
		amount=request.amount,
		currency=request.currency,
		status="pending",
		provider=request.provider,
		recipient_id=request.phone_number,
		package_code=request.data_plan_id,
		reference=_build_reference("DATA"),
		metadata={k: v for k, v in metadata.items() if v is not None},
	)

	return PaymentResponse(
		success=True,
		message="Data bundle purchase initiated",
		transaction_id=str(payment.id),
		reference=payment.reference,
		metadata=payment.metadata,
	)


@router.post("/p2p/send", response_model=PaymentResponse)
async def p2p_transfer(
	request: P2PTransferRequest,
	current_user: User = Depends(get_current_user),
):
	metadata = {
		"recipient_address": request.recipient_address,
		"token_symbol": request.token_symbol,
		"from_token": request.from_token,
		"blockchain_network": request.blockchain_network,
		"transaction_hash": request.transaction_hash,
		"message": request.message,
	}
	payment = await _create_payment_record(
		user=current_user,
		payment_type="transfer",
		amount=request.amount,
		currency=request.currency,
		status="pending",
		provider="P2P Transfer",
		recipient_id=request.recipient_address,
		reference=_build_reference("P2P"),
		metadata={k: v for k, v in metadata.items() if v is not None},
	)

	return PaymentResponse(
		success=True,
		message="P2P transfer initiated",
		transaction_id=str(payment.id),
		reference=payment.reference,
		metadata=payment.metadata,
	)


@router.post("/swap", response_model=PaymentResponse)
async def token_swap(
	request: TokenSwapRequest,
	current_user: User = Depends(get_current_user),
):
	metadata = {
		"from_token": request.from_token,
		"to_token": request.to_token,
		"slippage": request.slippage,
	}
	payment = await _create_payment_record(
		user=current_user,
		payment_type="other",
		amount=request.amount,
		currency="NGN",
		status="pending",
		provider="Token Swap",
		recipient_id=str(current_user.id),
		reference=_build_reference("SWAP"),
		metadata=metadata,
	)

	return PaymentResponse(
		success=True,
		message=f"Token swap from {request.from_token} to {request.to_token} initiated",
		transaction_id=str(payment.id),
		reference=payment.reference,
		metadata=payment.metadata,
	)


@router.post("/withdraw/generate-code", response_model=PaymentResponse)
async def generate_withdrawal_code(
	request: WithdrawalRequest,
	current_user: User = Depends(get_current_user),
):
	withdrawal_code = uuid.uuid4().hex[:6].upper()
	metadata = {
		"withdrawal_code": withdrawal_code,
		"token_address": request.token_address,
		"blockchain_network": request.blockchain_network,
		"transaction_hash": request.transaction_hash,
		"merchant_id": request.merchant_id,
	}
	payment = await _create_payment_record(
		user=current_user,
		payment_type="other",
		amount=request.amount,
		currency=request.currency,
		status="pending",
		provider="Withdrawal",
		recipient_id=str(current_user.id),
		reference=_build_reference("WD"),
		metadata={k: v for k, v in metadata.items() if v is not None},
	)

	return PaymentResponse(
		success=True,
		message=f"Withdrawal code generated: {withdrawal_code}",
		transaction_id=str(payment.id),
		reference=payment.reference,
		metadata=payment.metadata,
	)


# =============================================================================
# Utility endpoints
# =============================================================================


@router.get("/providers/airtime")
async def get_airtime_providers():
	providers = await _get_billers_by_category("airtime")
	return {"providers": providers, "country": "Nigeria"}


@router.get("/providers/electricity")
async def get_electricity_providers():
	providers = await _get_billers_by_category("electricity")
	return {"providers": providers, "country": "Nigeria"}


@router.get("/providers/cable-tv")
async def get_cable_tv_providers():
	providers = await _get_billers_by_category("cable_tv")
	return {"providers": providers, "country": "Nigeria"}


@router.get("/banks")
async def get_nigerian_banks():
	response = await paystack.get_banks()
	if response.get("status") != "success":
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail=response.get("message", "Unable to fetch banks from Paystack"),
		)
	return {"banks": response.get("data", [])}


@router.post("/validate/account")
async def validate_bank_account_query(
	account_number: str,
	bank_code: str,
	current_user: User = Depends(get_current_user),
):
	return await _validate_bank_account(account_number, bank_code)


@router.post("/bank/validate")
async def validate_bank_account_body(
	data: BankAccountValidationRequest,
	current_user: User = Depends(get_current_user),
):
	return await _validate_bank_account(data.account_number, data.bank_code)


# =============================================================================
# Payment history
# =============================================================================


@router.get("/")
async def list_payments(
	status_filter: Optional[str] = Query(default=None, alias="status"),
	payment_type: Optional[str] = Query(default=None, alias="type"),
	limit: int = Query(default=20, ge=1, le=100),
	offset: int = Query(default=0, ge=0),
	current_user: User = Depends(get_current_user),
):
	def fetch() -> Dict[str, Any]:
		queryset = Payment.objects.filter(user=current_user).order_by("-created_at")
		if status_filter:
			queryset = queryset.filter(status=status_filter)
		if payment_type:
			queryset = queryset.filter(payment_type=payment_type)

		total = queryset.count()
		results = list(queryset[offset : offset + limit])
		return {"total": total, "results": results}

	data = await sync_to_async(fetch)()
	return {
		"count": data["total"],
		"limit": limit,
		"offset": offset,
		"results": [_serialize_payment(payment) for payment in data["results"]],
	}


@router.get("/{payment_id}")
async def get_payment(
	payment_id: str,
	current_user: User = Depends(get_current_user),
):
	try:
		payment_uuid = UUID(payment_id)
	except ValueError as exc:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Invalid payment identifier",
		) from exc

	def fetch() -> Payment:
		return Payment.objects.select_related("transaction").get(
			id=payment_uuid,
			user=current_user,
		)

	try:
		payment = await sync_to_async(fetch)()
	except Payment.DoesNotExist as exc:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Payment not found",
		) from exc

	return _serialize_payment(payment)

