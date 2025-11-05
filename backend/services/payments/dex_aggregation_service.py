"""
DEX Aggregation Service

Handles:
- Multi-DEX quote aggregation (1inch, Paraswap)
- Best price discovery
- Swap route optimization
- Slippage protection
- Gas-efficient token swaps
"""
import os
import logging
from typing import Dict, List, Optional
from decimal import Decimal
import httpx
from django.core.cache import cache

logger = logging.getLogger(__name__)


class DEXAggregationService:
    """
    DEX aggregator for finding best swap rates
    
    Supported Aggregators:
    1. 1inch - Wide DEX coverage, smart routing
    2. Paraswap - Multi-path routing, good for large trades
    
    Features:
    - Compare quotes from multiple aggregators
    - Find best execution price
    - Gas-optimized routing
    - Slippage protection
    """
    
    # Supported chains
    CHAIN_IDS = {
        'ethereum': 1,
        'base': 8453,
        'arbitrum': 42161,
        'optimism': 10,
        'polygon': 137,
    }
    
    # 1inch API endpoints by chain
    ONEINCH_URLS = {
        1: 'https://api.1inch.dev/swap/v6.0/1',
        8453: 'https://api.1inch.dev/swap/v6.0/8453',
        42161: 'https://api.1inch.dev/swap/v6.0/42161',
        10: 'https://api.1inch.dev/swap/v6.0/10',
        137: 'https://api.1inch.dev/swap/v6.0/137',
    }
    
    # Paraswap API endpoint
    PARASWAP_URL = 'https://api.paraswap.io'
    
    # Token addresses (for swaps to/from fiat-backed stablecoins)
    STABLECOIN_ADDRESSES = {
        # Ethereum
        1: {
            'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        },
        # Base
        8453: {
            'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            'DAI': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        },
        # Arbitrum
        42161: {
            'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        },
        # Optimism
        10: {
            'USDC': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            'USDT': '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        },
        # Polygon
        137: {
            'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        },
    }
    
    def __init__(self):
        """Initialize DEX aggregation service"""
        self.oneinch_api_key = os.getenv('ONEINCH_API_KEY', '')
        self.paraswap_api_key = os.getenv('PARASWAP_API_KEY', '')
        
    def _get_oneinch_headers(self) -> Dict[str, str]:
        """Generate headers for 1inch API"""
        headers = {'Accept': 'application/json'}
        if self.oneinch_api_key:
            headers['Authorization'] = f'Bearer {self.oneinch_api_key}'
        return headers
    
    async def get_quote_1inch(
        self,
        chain: str,
        from_token: str,
        to_token: str,
        amount: int,  # Amount in smallest unit (wei, satoshi, etc.)
        slippage: float = 1.0  # Slippage tolerance in percent (default 1%)
    ) -> Optional[Dict]:
        """
        Get swap quote from 1inch
        
        Args:
            chain: Chain name (ethereum, base, etc.)
            from_token: Source token address or symbol
            to_token: Destination token address or symbol
            amount: Amount in smallest unit
            slippage: Slippage tolerance (1.0 = 1%)
            
        Returns:
            Quote with estimated output amount and gas cost
        """
        chain_id = self.CHAIN_IDS.get(chain.lower())
        if not chain_id:
            logger.error(f"Unsupported chain: {chain}")
            return None
        
        base_url = self.ONEINCH_URLS.get(chain_id)
        if not base_url:
            logger.error(f"1inch not available on chain {chain}")
            return None
        
        # Convert token symbols to addresses if needed
        from_address = self._resolve_token_address(chain_id, from_token)
        to_address = self._resolve_token_address(chain_id, to_token)
        
        params = {
            'src': from_address,
            'dst': to_address,
            'amount': str(amount),
            'includeGas': 'true',
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{base_url}/quote",
                    params=params,
                    headers=self._get_oneinch_headers(),
                    timeout=15.0
                )
                response.raise_for_status()
                data = response.json()
                
                return {
                    'provider': '1inch',
                    'from_token': from_address,
                    'to_token': to_address,
                    'from_amount': amount,
                    'to_amount': int(data.get('dstAmount', 0)),
                    'estimated_gas': int(data.get('estimatedGas', 0)),
                    'protocols': data.get('protocols', []),
                }
                
        except httpx.HTTPError as e:
            logger.error(f"1inch API error: {e}")
            return None
    
    async def get_quote_paraswap(
        self,
        chain: str,
        from_token: str,
        to_token: str,
        amount: int,
        slippage: float = 1.0
    ) -> Optional[Dict]:
        """
        Get swap quote from Paraswap
        
        Args:
            chain: Chain name
            from_token: Source token address
            to_token: Destination token address
            amount: Amount in smallest unit
            slippage: Slippage tolerance
            
        Returns:
            Quote with price route
        """
        chain_id = self.CHAIN_IDS.get(chain.lower())
        if not chain_id:
            return None
        
        from_address = self._resolve_token_address(chain_id, from_token)
        to_address = self._resolve_token_address(chain_id, to_token)
        
        params = {
            'srcToken': from_address,
            'destToken': to_address,
            'srcDecimals': 18,  # Will need to fetch actual decimals
            'destDecimals': 18,
            'amount': str(amount),
            'side': 'SELL',
            'network': chain_id,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.PARASWAP_URL}/prices",
                    params=params,
                    timeout=15.0
                )
                response.raise_for_status()
                data = response.json()
                
                price_route = data.get('priceRoute', {})
                
                return {
                    'provider': 'paraswap',
                    'from_token': from_address,
                    'to_token': to_address,
                    'from_amount': amount,
                    'to_amount': int(price_route.get('destAmount', 0)),
                    'estimated_gas': int(price_route.get('gasCost', 0)),
                    'dest_usd': price_route.get('destUSD'),
                    'src_usd': price_route.get('srcUSD'),
                }
                
        except httpx.HTTPError as e:
            logger.error(f"Paraswap API error: {e}")
            return None
    
    async def get_best_quote(
        self,
        chain: str,
        from_token: str,
        to_token: str,
        amount: int,
        slippage: float = 1.0
    ) -> Optional[Dict]:
        """
        Get best quote from all available DEX aggregators
        
        Args:
            chain: Chain name
            from_token: Source token
            to_token: Destination token
            amount: Amount to swap
            slippage: Slippage tolerance
            
        Returns:
            Best quote with highest output amount
        """
        # Fetch quotes from all providers in parallel
        oneinch_quote = await self.get_quote_1inch(chain, from_token, to_token, amount, slippage)
        paraswap_quote = await self.get_quote_paraswap(chain, from_token, to_token, amount, slippage)
        
        # Filter out None values
        quotes = [q for q in [oneinch_quote, paraswap_quote] if q is not None]
        
        if not quotes:
            logger.error("No quotes available from any provider")
            return None
        
        # Find quote with highest output amount
        best_quote = max(quotes, key=lambda q: q['to_amount'])
        
        logger.info(f"Best quote from {best_quote['provider']}: {best_quote['to_amount']} output")
        
        return best_quote
    
    def _resolve_token_address(self, chain_id: int, token: str) -> str:
        """
        Resolve token symbol to address or return address if already an address
        
        Args:
            chain_id: Chain ID
            token: Token symbol or address
            
        Returns:
            Token contract address
        """
        # If already an address (starts with 0x), return as-is
        if token.startswith('0x'):
            return token
        
        # Otherwise look up symbol
        token_upper = token.upper()
        
        # Check if native token (ETH, MATIC, etc.)
        if token_upper in ['ETH', 'MATIC', 'AVAX', 'BNB']:
            # Use zero address for native tokens
            return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        
        # Look up in stablecoin addresses
        chain_tokens = self.STABLECOIN_ADDRESSES.get(chain_id, {})
        return chain_tokens.get(token_upper, token)
    
    async def estimate_output_amount(
        self,
        chain: str,
        from_token: str,
        to_token: str,
        amount_in: Decimal,
        from_decimals: int = 18,
        to_decimals: int = 18
    ) -> Optional[Decimal]:
        """
        Estimate output amount for a swap
        
        Args:
            chain: Chain name
            from_token: Source token
            to_token: Destination token
            amount_in: Input amount in human-readable units
            from_decimals: Source token decimals
            to_decimals: Destination token decimals
            
        Returns:
            Estimated output amount in human-readable units
        """
        # Convert to smallest unit
        amount_wei = int(amount_in * (10 ** from_decimals))
        
        # Get best quote
        quote = await self.get_best_quote(chain, from_token, to_token, amount_wei)
        
        if quote:
            # Convert from smallest unit to human-readable
            output_amount = Decimal(quote['to_amount']) / (10 ** to_decimals)
            return output_amount
        
        return None
    
    async def get_swap_calldata(
        self,
        chain: str,
        from_token: str,
        to_token: str,
        amount: int,
        from_address: str,
        slippage: float = 1.0,
        referrer: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Get swap transaction calldata for execution
        
        Args:
            chain: Chain name
            from_token: Source token address
            to_token: Destination token address
            amount: Amount in smallest unit
            from_address: User's wallet address
            slippage: Slippage tolerance
            referrer: Optional referrer address for fee sharing
            
        Returns:
            Transaction data ready for signing and submission
        """
        chain_id = self.CHAIN_IDS.get(chain.lower())
        if not chain_id:
            return None
        
        base_url = self.ONEINCH_URLS.get(chain_id)
        if not base_url:
            return None
        
        from_addr = self._resolve_token_address(chain_id, from_token)
        to_addr = self._resolve_token_address(chain_id, to_token)
        
        params = {
            'src': from_addr,
            'dst': to_addr,
            'amount': str(amount),
            'from': from_address,
            'slippage': slippage,
            'disableEstimate': 'false',
            'allowPartialFill': 'false',
        }
        
        if referrer:
            params['referrer'] = referrer
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{base_url}/swap",
                    params=params,
                    headers=self._get_oneinch_headers(),
                    timeout=15.0
                )
                response.raise_for_status()
                data = response.json()
                
                tx = data.get('tx', {})
                
                return {
                    'to': tx.get('to'),
                    'data': tx.get('data'),
                    'value': tx.get('value', '0'),
                    'gas': tx.get('gas'),
                    'gasPrice': tx.get('gasPrice'),
                    'estimated_output': data.get('dstAmount'),
                }
                
        except httpx.HTTPError as e:
            logger.error(f"1inch swap calldata error: {e}")
            return None
