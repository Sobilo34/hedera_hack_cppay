"""
Crypto-to-Fiat Bridge Service

Handles:
- Crypto → Stablecoin conversion (via DEX)
- Stablecoin → Fiat conversion (via payment gateway)
- Complete crypto-to-fiat flow for payments
- Automatic routing and optimization
"""
import logging
from typing import Dict, Optional
from decimal import Decimal
from datetime import datetime

from .dex_aggregation_service import DEXAggregationService
from .price_oracle_service import PriceOracleService
from .paystack_service import PaystackService
from apps.transactions.models import Transaction
from apps.payments.models import Payment

logger = logging.getLogger(__name__)


class CryptoToFiatBridge:
    """
    Bridge between cryptocurrency and fiat payments

    Flow:
    1. User has crypto (ETH, USDC, etc.)
    2. If not stablecoin, swap to USDC/USDT via DEX
    3. Convert stablecoin to NGN using current rates
    4. Execute fiat payment via Paystack

    Example:
    - User wants to buy NGN 5,000 airtime
    - User has 0.01 ETH ($30 worth)
    - Bridge swaps ETH → USDC (~$30)
    - Bridge calculates USDC needed (~6 USDC at 800 NGN/USD)
    - Bridge executes Paystack airtime purchase
    """
    
    # Preferred stablecoins for conversion
    PREFERRED_STABLECOINS = ['USDC', 'USDT', 'DAI']
    
    # Default slippage for DEX swaps
    DEFAULT_SLIPPAGE = 1.0  # 1%
    
    def __init__(self):
        """Initialize crypto-to-fiat bridge"""
        self.dex = DEXAggregationService()
        self.oracle = PriceOracleService()
        self.paystack = PaystackService()
        
    async def calculate_crypto_needed(
        self,
        fiat_amount: Decimal,
        fiat_currency: str,
        crypto_token: str,
        chain: str
    ) -> Optional[Dict]:
        """
        Calculate how much crypto is needed for a fiat payment
        
        Args:
            fiat_amount: Amount in fiat (e.g., 5000 NGN)
            fiat_currency: Fiat currency code (NGN, USD, etc.)
            crypto_token: Crypto token user has (ETH, USDC, etc.)
            chain: Blockchain network
            
        Returns:
            Dict with calculation breakdown
        """
        # Convert fiat to USD first if needed
        if fiat_currency.upper() == 'NGN':
            # Get NGN/USD rate
            ngn_rate = await self.oracle.get_ngn_rate()
            if not ngn_rate:
                logger.error("Failed to get NGN exchange rate")
                return None
            
            usd_needed = fiat_amount / ngn_rate
        else:
            usd_needed = fiat_amount
        
        # If user already has stablecoin, no swap needed
        if crypto_token.upper() in self.PREFERRED_STABLECOINS:
            return {
                'crypto_token': crypto_token,
                'crypto_amount': usd_needed,
                'usd_value': usd_needed,
                'fiat_amount': fiat_amount,
                'fiat_currency': fiat_currency,
                'swap_needed': False,
                'exchange_rate': ngn_rate if fiat_currency.upper() == 'NGN' else Decimal('1'),
            }
        
        # Get crypto price in USD
        crypto_price = await self.oracle.get_token_price(crypto_token, 'usd')
        if not crypto_price:
            logger.error(f"Failed to get price for {crypto_token}")
            return None
        
        # Calculate crypto amount needed
        crypto_amount = usd_needed / crypto_price
        
        # Get swap quote to stablecoin
        # Convert to wei (assuming 18 decimals for simplicity)
        amount_wei = int(crypto_amount * (10 ** 18))
        swap_quote = await self.dex.get_best_quote(
            chain=chain,
            from_token=crypto_token,
            to_token='USDC',
            amount=amount_wei
        )
        
        if not swap_quote:
            logger.error(f"Failed to get swap quote for {crypto_token} → USDC")
            return None
        
        # Calculate actual USDC received after swap
        usdc_received = Decimal(swap_quote['to_amount']) / (10 ** 6)  # USDC has 6 decimals
        
        return {
            'crypto_token': crypto_token,
            'crypto_amount': crypto_amount,
            'usd_value': usd_needed,
            'fiat_amount': fiat_amount,
            'fiat_currency': fiat_currency,
            'swap_needed': True,
            'swap_to': 'USDC',
            'usdc_received': usdc_received,
            'swap_quote': swap_quote,
            'exchange_rate': ngn_rate if fiat_currency.upper() == 'NGN' else Decimal('1'),
            'crypto_price_usd': crypto_price,
        }
    
    async def execute_crypto_to_fiat_payment(
        self,
        user,
        payment_type: str,  # 'airtime', 'electricity', etc.
        fiat_amount: Decimal,
        crypto_token: str,
        crypto_amount: Decimal,
        chain: str,
        payment_details: Dict,  # Details specific to payment type
        reference: str
    ) -> Dict:
        """
        Execute complete crypto-to-fiat payment
        
        Args:
            user: User making payment
            payment_type: Type of payment (airtime, electricity, etc.)
            fiat_amount: Amount in fiat
            crypto_token: Token user is paying with
            crypto_amount: Amount of crypto
            chain: Blockchain network
            payment_details: Payment-specific details (phone, meter number, etc.)
            reference: Unique payment reference
            
        Returns:
            Dict with payment result
        """
        logger.info(
            f"Starting crypto-to-fiat payment: {payment_type}, {fiat_amount} NGN "
            f"from {crypto_amount} {crypto_token}"
        )
        
        # Step 1: Calculate what's needed
        calculation = await self.calculate_crypto_needed(
            fiat_amount=fiat_amount,
            fiat_currency='NGN',
            crypto_token=crypto_token,
            chain=chain
        )
        
        if not calculation:
            return {
                'status': 'error',
                'message': 'Failed to calculate payment requirements'
            }
        
        # Step 2: If swap needed, prepare swap transaction
        if calculation.get('swap_needed'):
            # This returns transaction data that frontend will execute
            swap_tx = await self.dex.get_swap_calldata(
                chain=chain,
                from_token=crypto_token,
                to_token='USDC',
                amount=int(crypto_amount * (10 ** 18)),
                from_address=payment_details.get('user_address'),
                slippage=self.DEFAULT_SLIPPAGE
            )
            
            if not swap_tx:
                return {
                    'status': 'error',
                    'message': 'Failed to prepare swap transaction'
                }
            
            # Return swap transaction for frontend to execute
            return {
                'status': 'pending_swap',
                'message': 'Swap transaction prepared. Please sign and submit.',
                'swap_transaction': swap_tx,
                'calculation': calculation,
                'next_step': 'execute_swap',
            }
        
        # Step 3: Execute fiat payment (if no swap needed or swap already done)
        payment_result = await self._execute_fiat_payment(
            payment_type=payment_type,
            fiat_amount=fiat_amount,
            payment_details=payment_details,
            reference=reference,
            user=user
        )
        
        if payment_result.get('status') != 'success':
            return payment_result
        
        # Step 4: Create payment record
        payment = Payment.objects.create(
            user=user,
            payment_type=payment_type,
            amount=fiat_amount,
            currency='NGN',
            provider='paystack',
            reference=reference,
            recipient_id=payment_details.get('recipient_id'),
            status='completed',
            metadata={
                'crypto_token': crypto_token,
                'crypto_amount': str(crypto_amount),
                'chain': chain,
                'calculation': str(calculation),
                'payment_details': payment_details,
                'paystack_response': payment_result,
            }
        )
        
        return {
            'status': 'success',
            'message': 'Payment completed successfully',
            'payment_id': payment.id,
            'paystack_data': payment_result,
            'calculation': calculation,
        }
    
    async def _execute_fiat_payment(
        self,
        payment_type: str,
        fiat_amount: Decimal,
        payment_details: Dict,
        reference: str,
        user
    ) -> Dict:
        """
        Execute the actual fiat payment via Paystack
        
        Args:
            payment_type: Type of payment
            fiat_amount: Amount in NGN
            payment_details: Payment-specific details
            reference: Payment reference
            user: Authenticated user initiating the payment
            
        Returns:
            Paystack API response
        """
        customer_email = getattr(user, 'email', None) or 'test@cppay.local'

        if payment_type == 'airtime':
            return await self.paystack.purchase_airtime(
                phone_number=payment_details['phone_number'],
                amount=float(fiat_amount),
                provider=payment_details['provider'],
                customer_email=customer_email,
                reference=reference
            )

        elif payment_type == 'electricity':
            return await self.paystack.pay_electricity(
                meter_number=payment_details['meter_number'],
                amount=float(fiat_amount),
                provider=payment_details['provider'],
                customer_email=customer_email,
                meter_type=payment_details['meter_type'],
                reference=reference
            )

        elif payment_type == 'cable_tv':
            return await self.paystack.pay_cable_tv(
                smart_card_number=payment_details['smartcard_number'],
                amount=float(fiat_amount),
                provider=payment_details['provider'],
                customer_email=customer_email,
                bouquet_code=payment_details['bouquet_code'],
                reference=reference
            )

        elif payment_type == 'transfer':
            return await self.paystack.initiate_transfer(
                account_number=payment_details['account_number'],
                bank_code=payment_details['bank_code'],
                amount=float(fiat_amount),
                reason=payment_details.get('narration', 'CPPay transfer'),
                reference=reference,
                beneficiary_name=payment_details.get('beneficiary_name') or payment_details.get('recipient_name')
            )

        else:
            return {
                'status': 'error',
                'message': f'Unsupported payment type: {payment_type}'
            }
    
    async def get_payment_estimate(
        self,
        payment_type: str,
        fiat_amount: Decimal,
        crypto_token: str,
        chain: str
    ) -> Optional[Dict]:
        """
        Get estimate for crypto-to-fiat payment without executing
        
        Args:
            payment_type: Type of payment
            fiat_amount: Amount in fiat
            crypto_token: Token user wants to use
            chain: Blockchain network
            
        Returns:
            Estimate with fees, rates, and amounts
        """
        calculation = await self.calculate_crypto_needed(
            fiat_amount=fiat_amount,
            fiat_currency='NGN',
            crypto_token=crypto_token,
            chain=chain
        )
        
        if not calculation:
            return None
        
        # Add fee estimates
        paystack_fee = fiat_amount * Decimal('0.01')  # ~1% illustrative fee
        dex_gas_estimate = Decimal('0')
        
        if calculation.get('swap_needed'):
            # Estimate DEX swap gas cost
            swap_quote = calculation.get('swap_quote', {})
            gas_cost_wei = swap_quote.get('estimated_gas', 0)
            # Convert to ETH and then to USD
            gas_cost_eth = Decimal(gas_cost_wei) / (10 ** 18)
            eth_price = await self.oracle.get_token_price('ETH', 'usd')
            if eth_price:
                dex_gas_estimate = gas_cost_eth * eth_price
        
        total_cost_usd = calculation['usd_value'] + dex_gas_estimate
        
        return {
            'payment_type': payment_type,
            'fiat_amount': fiat_amount,
            'fiat_currency': 'NGN',
            'crypto_token': crypto_token,
            'crypto_amount_needed': calculation['crypto_amount'],
            'usd_value': calculation['usd_value'],
            'swap_needed': calculation.get('swap_needed', False),
            'paystack_fee': paystack_fee,
            'dex_gas_cost_usd': dex_gas_estimate,
            'total_cost_usd': total_cost_usd,
            'exchange_rate': calculation['exchange_rate'],
            'crypto_price_usd': calculation.get('crypto_price_usd'),
        }
