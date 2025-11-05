"""
Price Oracle Service

Handles:
- Real-time cryptocurrency price fetching
- Multi-provider price aggregation (CoinGecko, Binance)
- Price caching and update strategies
- Historical price data
- Price alerts and notifications
"""
import os
import logging
from typing import Dict, List, Optional
from decimal import Decimal
from datetime import datetime, timedelta
import httpx
from django.core.cache import cache

logger = logging.getLogger(__name__)


class PriceOracleService:
    """
    Multi-provider price oracle with automatic failover
    
    Providers:
    1. CoinGecko (Primary) - Free tier: 50 calls/minute
    2. Binance (Secondary) - High reliability, no API key needed
    
    Features:
    - Automatic failover between providers
    - Intelligent caching (30s for volatile, 5m for stable)
    - Batch price fetching
    - Multi-currency support (USD, NGN, EUR, GBP)
    """
    
    # CoinGecko token IDs
    COINGECKO_IDS = {
        'ETH': 'ethereum',
        'USDC': 'usd-coin',
        'USDT': 'tether',
        'DAI': 'dai',
        'MATIC': 'matic-network',
        'ARB': 'arbitrum',
        'OP': 'optimism',
        'BTC': 'bitcoin',
        'BNB': 'binancecoin',
    }
    
    # Binance trading pairs
    BINANCE_PAIRS = {
        'ETH': 'ETHUSDT',
        'USDC': 'USDCUSDT',
        'USDT': 'USDTUSDT',
        'DAI': 'DAIUSDT',
        'MATIC': 'MATICUSDT',
        'ARB': 'ARBUSDT',
        'OP': 'OPUSDT',
        'BTC': 'BTCUSDT',
        'BNB': 'BNBUSDT',
    }
    
    # Supported fiat currencies
    FIAT_CURRENCIES = ['usd', 'ngn', 'eur', 'gbp']
    
    def __init__(self):
        """Initialize price oracle service"""
        self.coingecko_api_key = os.getenv('COINGECKO_API_KEY', '')  # Optional
        self.use_coingecko_pro = bool(self.coingecko_api_key)
        
        # Base URLs
        self.coingecko_base = "https://pro-api.coingecko.com/api/v3" if self.use_coingecko_pro else "https://api.coingecko.com/api/v3"
        self.binance_base = "https://api.binance.com/api/v3"
        
        # Cache TTLs
        self.volatile_ttl = 30  # 30 seconds for ETH, BTC
        self.stable_ttl = 300   # 5 minutes for stablecoins
        
    def _is_stablecoin(self, token: str) -> bool:
        """Check if token is a stablecoin"""
        return token.upper() in ['USDC', 'USDT', 'DAI']
    
    def _get_cache_ttl(self, token: str) -> int:
        """Get appropriate cache TTL based on token type"""
        return self.stable_ttl if self._is_stablecoin(token) else self.volatile_ttl
    
    def _get_coingecko_headers(self) -> Dict[str, str]:
        """Generate headers for CoinGecko API"""
        headers = {'Accept': 'application/json'}
        if self.coingecko_api_key:
            headers['x-cg-pro-api-key'] = self.coingecko_api_key
        return headers
    
    async def get_token_price(
        self,
        token: str,
        currency: str = 'usd',
        use_cache: bool = True
    ) -> Optional[Decimal]:
        """
        Get current price for a single token
        
        Args:
            token: Token symbol (ETH, USDC, etc.)
            currency: Fiat currency (usd, ngn, eur, gbp)
            use_cache: Whether to use cached prices
            
        Returns:
            Decimal price or None if unavailable
        """
        token = token.upper()
        currency = currency.lower()
        
        if currency not in self.FIAT_CURRENCIES:
            logger.error(f"Unsupported currency: {currency}")
            return None
        
        # Check cache first
        if use_cache:
            cache_key = f"price:{token}:{currency}"
            cached_price = cache.get(cache_key)
            if cached_price:
                return Decimal(str(cached_price))
        
        # Try CoinGecko first
        price = await self._fetch_coingecko_price(token, currency)
        
        # Fallback to Binance if CoinGecko fails (only USD)
        if price is None and currency == 'usd':
            price = await self._fetch_binance_price(token)
        
        # Cache the price if retrieved
        if price and use_cache:
            cache_key = f"price:{token}:{currency}"
            ttl = self._get_cache_ttl(token)
            cache.set(cache_key, float(price), ttl)
        
        return price
    
    async def get_multiple_prices(
        self,
        tokens: List[str],
        currency: str = 'usd'
    ) -> Dict[str, Optional[Decimal]]:
        """
        Get prices for multiple tokens in a single request
        
        Args:
            tokens: List of token symbols
            currency: Fiat currency
            
        Returns:
            Dict mapping token symbols to prices
        """
        tokens = [t.upper() for t in tokens]
        currency = currency.lower()
        
        # Try batch fetch from CoinGecko
        prices = await self._fetch_coingecko_batch(tokens, currency)
        
        # Fill in missing prices from Binance (USD only)
        if currency == 'usd':
            for token in tokens:
                if token not in prices or prices[token] is None:
                    price = await self._fetch_binance_price(token)
                    if price:
                        prices[token] = price
        
        # Cache all retrieved prices
        for token, price in prices.items():
            if price:
                cache_key = f"price:{token}:{currency}"
                ttl = self._get_cache_ttl(token)
                cache.set(cache_key, float(price), ttl)
        
        return prices
    
    async def _fetch_coingecko_price(
        self,
        token: str,
        currency: str
    ) -> Optional[Decimal]:
        """Fetch price from CoinGecko"""
        coin_id = self.COINGECKO_IDS.get(token)
        if not coin_id:
            logger.warning(f"Token {token} not supported by CoinGecko")
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.coingecko_base}/simple/price",
                    params={
                        'ids': coin_id,
                        'vs_currencies': currency,
                    },
                    headers=self._get_coingecko_headers(),
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                price = data.get(coin_id, {}).get(currency)
                if price:
                    return Decimal(str(price))
                else:
                    logger.warning(f"Price not found in CoinGecko response for {token}")
                    return None
                    
        except httpx.HTTPError as e:
            logger.error(f"CoinGecko API error for {token}: {e}")
            return None
        except (KeyError, ValueError) as e:
            logger.error(f"CoinGecko data parsing error for {token}: {e}")
            return None
    
    async def _fetch_coingecko_batch(
        self,
        tokens: List[str],
        currency: str
    ) -> Dict[str, Optional[Decimal]]:
        """Fetch multiple prices from CoinGecko in one request"""
        coin_ids = [self.COINGECKO_IDS.get(t) for t in tokens if t in self.COINGECKO_IDS]
        
        if not coin_ids:
            return {token: None for token in tokens}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.coingecko_base}/simple/price",
                    params={
                        'ids': ','.join(coin_ids),
                        'vs_currencies': currency,
                    },
                    headers=self._get_coingecko_headers(),
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                prices = {}
                for token in tokens:
                    coin_id = self.COINGECKO_IDS.get(token)
                    if coin_id and coin_id in data:
                        price = data[coin_id].get(currency)
                        prices[token] = Decimal(str(price)) if price else None
                    else:
                        prices[token] = None
                
                return prices
                
        except httpx.HTTPError as e:
            logger.error(f"CoinGecko batch API error: {e}")
            return {token: None for token in tokens}
    
    async def _fetch_binance_price(self, token: str) -> Optional[Decimal]:
        """Fetch price from Binance (USD only)"""
        pair = self.BINANCE_PAIRS.get(token)
        if not pair:
            logger.warning(f"Token {token} not supported by Binance")
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.binance_base}/ticker/price",
                    params={'symbol': pair},
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                price = data.get('price')
                if price:
                    return Decimal(str(price))
                else:
                    return None
                    
        except httpx.HTTPError as e:
            logger.error(f"Binance API error for {token}: {e}")
            return None
        except (KeyError, ValueError) as e:
            logger.error(f"Binance data parsing error for {token}: {e}")
            return None
    
    async def get_historical_price(
        self,
        token: str,
        timestamp: datetime,
        currency: str = 'usd'
    ) -> Optional[Decimal]:
        """
        Get historical price for a token at specific timestamp
        
        Args:
            token: Token symbol
            timestamp: Unix timestamp
            currency: Fiat currency
            
        Returns:
            Historical price or None
        """
        coin_id = self.COINGECKO_IDS.get(token.upper())
        if not coin_id:
            return None
        
        # Convert datetime to Unix timestamp
        unix_timestamp = int(timestamp.timestamp())
        
        # Format: DD-MM-YYYY
        date_str = timestamp.strftime('%d-%m-%Y')
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.coingecko_base}/coins/{coin_id}/history",
                    params={
                        'date': date_str,
                        'localization': 'false'
                    },
                    headers=self._get_coingecko_headers(),
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                price = data.get('market_data', {}).get('current_price', {}).get(currency)
                if price:
                    return Decimal(str(price))
                else:
                    return None
                    
        except httpx.HTTPError as e:
            logger.error(f"CoinGecko historical price error: {e}")
            return None
    
    async def get_price_change_24h(self, token: str) -> Optional[Dict]:
        """
        Get 24h price change percentage
        
        Args:
            token: Token symbol
            
        Returns:
            Dict with price_change_percentage_24h and current price
        """
        coin_id = self.COINGECKO_IDS.get(token.upper())
        if not coin_id:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.coingecko_base}/coins/{coin_id}",
                    params={
                        'localization': 'false',
                        'tickers': 'false',
                        'market_data': 'true',
                        'community_data': 'false',
                        'developer_data': 'false',
                        'sparkline': 'false'
                    },
                    headers=self._get_coingecko_headers(),
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                market_data = data.get('market_data', {})
                
                return {
                    'current_price_usd': market_data.get('current_price', {}).get('usd'),
                    'price_change_24h': market_data.get('price_change_24h'),
                    'price_change_percentage_24h': market_data.get('price_change_percentage_24h'),
                    'market_cap_usd': market_data.get('market_cap', {}).get('usd'),
                    'total_volume_usd': market_data.get('total_volume', {}).get('usd'),
                }
                
        except httpx.HTTPError as e:
            logger.error(f"CoinGecko market data error: {e}")
            return None
    
    async def convert_amount(
        self,
        amount: Decimal,
        from_token: str,
        to_currency: str = 'usd'
    ) -> Optional[Decimal]:
        """
        Convert token amount to fiat currency
        
        Args:
            amount: Token amount
            from_token: Source token symbol
            to_currency: Target fiat currency
            
        Returns:
            Converted amount in fiat
        """
        price = await self.get_token_price(from_token, to_currency)
        if price:
            return amount * price
        return None
    
    async def get_ngn_rate(self) -> Optional[Decimal]:
        """
        Get USD to NGN exchange rate
        Uses CoinGecko's fiat rates
        
        Returns:
            NGN per 1 USD
        """
        cache_key = "fiat:usd_ngn_rate"
        cached = cache.get(cache_key)
        if cached:
            return Decimal(str(cached))
        
        # Fetch ETH price in both USD and NGN, then calculate rate
        eth_usd = await self.get_token_price('ETH', 'usd', use_cache=False)
        eth_ngn = await self.get_token_price('ETH', 'ngn', use_cache=False)
        
        if eth_usd and eth_ngn:
            rate = eth_ngn / eth_usd
            # Cache for 5 minutes
            cache.set(cache_key, float(rate), 300)
            return rate
        
        return None
