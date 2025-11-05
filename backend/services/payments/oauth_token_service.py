"""
Flutterwave OAuth 2.0 Token Management Service

Handles automatic token generation, caching, and refresh for Flutterwave API.
Implements OAuth 2.0 client credentials flow for sandbox/production environments.
"""
import logging
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from decouple import config
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class FlutterwaveOAuthService:
    """
    Manages OAuth 2.0 token lifecycle for Flutterwave API.
    
    Features:
    - Automatic token generation using client credentials
    - Token caching with TTL
    - Automatic token refresh before expiry
    - Support for both sandbox (test) and production environments
    - Error handling and logging
    """
    
    # OAuth2 token endpoint
    TOKEN_ENDPOINT = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token"
    
    # Cache keys
    CACHE_KEY_ACCESS_TOKEN = "flutterwave:oauth:access_token"
    CACHE_KEY_TOKEN_EXPIRY = "flutterwave:oauth:token_expiry"
    CACHE_KEY_TOKEN_METADATA = "flutterwave:oauth:token_metadata"
    
    # Token refresh buffer (refresh 60 seconds before actual expiry)
    REFRESH_BUFFER_SECONDS = 60
    
    # Request timeout
    REQUEST_TIMEOUT = 30.0
    
    def __init__(self):
        """Initialize OAuth service with credentials from environment"""
        # Use decouple to read from .env with proper fallbacks
        self.client_id = config('FLUTTERWAVE_OAUTH_CLIENT_ID', default=None)
        self.client_secret = config('FLUTTERWAVE_OAUTH_CLIENT_SECRET', default=None)
        self.is_sandbox = config('FLUTTERWAVE_SANDBOX', default='True', cast=lambda x: x.lower() == 'true')
        self.environment = 'sandbox' if self.is_sandbox else 'production'
        
        if not all([self.client_id, self.client_secret]):
            logger.warning(
                "Flutterwave OAuth credentials not configured. "
                "Set FLUTTERWAVE_OAUTH_CLIENT_ID and FLUTTERWAVE_OAUTH_CLIENT_SECRET in .env"
            )
        else:
            logger.info(f"Flutterwave OAuth Service initialized ({self.environment})")
    
    def get_access_token(self, force_refresh: bool = False) -> Optional[str]:
        """
        Get valid access token, using cache or generating new one if needed.
        
        Args:
            force_refresh (bool): Force token refresh even if cached version exists
            
        Returns:
            str: Valid access token or None if unable to obtain
        """
        # Check if we have a cached token that's still valid
        if not force_refresh:
            cached_token = self._get_cached_token()
            if cached_token:
                logger.debug("Using cached Flutterwave access token")
                return cached_token
        
        # Generate new token
        logger.info(f"Generating new Flutterwave access token ({self.environment})")
        token_data = self._request_new_token()
        
        if token_data:
            self._cache_token(token_data)
            return token_data.get('access_token')
        
        logger.error("Failed to generate Flutterwave access token")
        return None
    
    def _get_cached_token(self) -> Optional[str]:
        """
        Get access token from cache if it exists and hasn't expired.
        
        Returns:
            str: Cached access token or None if expired/missing
        """
        try:
            token = cache.get(self.CACHE_KEY_ACCESS_TOKEN)
            expiry = cache.get(self.CACHE_KEY_TOKEN_EXPIRY)
            
            if token and expiry:
                # Check if token is still valid (with buffer)
                now = datetime.utcnow()
                if now < expiry:
                    remaining = (expiry - now).total_seconds()
                    logger.debug(
                        f"Cached Flutterwave token valid for {remaining:.0f} more seconds"
                    )
                    return token
                else:
                    logger.debug("Cached Flutterwave token expired, will refresh")
                    # Clear expired cache
                    cache.delete(self.CACHE_KEY_ACCESS_TOKEN)
                    cache.delete(self.CACHE_KEY_TOKEN_EXPIRY)
            
            return None
        except Exception as e:
            logger.warning(f"Error retrieving cached token: {e}")
            return None
    
    def _request_new_token(self) -> Optional[Dict[str, Any]]:
        """
        Request new access token from Flutterwave OAuth endpoint.
        
        Returns:
            Dict with token data or None if request fails
        """
        if not self.client_id or not self.client_secret:
            logger.error("Flutterwave OAuth credentials not configured")
            return None
        
        try:
            payload = {
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'grant_type': 'client_credentials',
            }
            
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
            
            logger.debug(f"Requesting token from {self.TOKEN_ENDPOINT}")
            
            response = httpx.post(
                self.TOKEN_ENDPOINT,
                data=payload,
                headers=headers,
                timeout=self.REQUEST_TIMEOUT
            )
            
            response.raise_for_status()
            token_data = response.json()
            
            # Validate response
            if 'access_token' not in token_data:
                logger.error(f"Invalid token response: {token_data}")
                return None
            
            logger.info(
                f"Successfully obtained Flutterwave access token "
                f"(expires in {token_data.get('expires_in', 0)} seconds)"
            )
            
            return token_data
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during token request: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    logger.error(f"Response: {e.response.json()}")
                except:
                    logger.error(f"Response text: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during token request: {e}")
            return None
    
    def _cache_token(self, token_data: Dict[str, Any]) -> None:
        """
        Cache access token with appropriate TTL.
        
        Args:
            token_data: Response from OAuth token endpoint
        """
        try:
            access_token = token_data.get('access_token')
            expires_in = token_data.get('expires_in', 600)  # Default 10 minutes
            
            # Calculate expiry time (subtract buffer for safety)
            expiry_seconds = max(expires_in - self.REFRESH_BUFFER_SECONDS, 60)
            expiry_datetime = datetime.utcnow() + timedelta(seconds=expiry_seconds)
            
            # Cache token
            cache.set(
                self.CACHE_KEY_ACCESS_TOKEN,
                access_token,
                timeout=expiry_seconds
            )
            
            # Cache expiry timestamp for comparison
            cache.set(
                self.CACHE_KEY_TOKEN_EXPIRY,
                expiry_datetime,
                timeout=expiry_seconds
            )
            
            # Cache full metadata for debugging
            metadata = {
                'cached_at': datetime.utcnow().isoformat(),
                'expires_at': expiry_datetime.isoformat(),
                'expires_in_seconds': expires_in,
                'environment': self.environment,
                'scope': token_data.get('scope', ''),
            }
            cache.set(
                self.CACHE_KEY_TOKEN_METADATA,
                metadata,
                timeout=expiry_seconds
            )
            
            logger.debug(
                f"Cached Flutterwave token for {expiry_seconds} seconds "
                f"(original TTL: {expires_in}s)"
            )
            
        except Exception as e:
            logger.warning(f"Error caching token: {e}")
    
    def get_token_metadata(self) -> Optional[Dict[str, Any]]:
        """
        Get cached token metadata for debugging/monitoring.
        
        Returns:
            Dict with token metadata or None
        """
        return cache.get(self.CACHE_KEY_TOKEN_METADATA)
    
    def clear_cache(self) -> None:
        """Clear all cached token data"""
        cache.delete(self.CACHE_KEY_ACCESS_TOKEN)
        cache.delete(self.CACHE_KEY_TOKEN_EXPIRY)
        cache.delete(self.CACHE_KEY_TOKEN_METADATA)
        logger.info("Cleared Flutterwave OAuth token cache")
    
    def validate_credentials(self) -> bool:
        """
        Validate that OAuth credentials are properly configured.
        
        Returns:
            bool: True if credentials are valid and token can be obtained
        """
        if not self.client_id or not self.client_secret:
            logger.error("OAuth credentials not configured")
            return False
        
        try:
            token_data = self._request_new_token()
            if token_data and 'access_token' in token_data:
                logger.info("✓ Flutterwave OAuth credentials validated successfully")
                return True
            else:
                logger.error("✗ Flutterwave OAuth credentials validation failed")
                return False
        except Exception as e:
            logger.error(f"✗ Error validating credentials: {e}")
            return False


# Singleton instance
_oauth_service = None


def get_oauth_service() -> FlutterwaveOAuthService:
    """Get or create singleton OAuth service instance"""
    global _oauth_service
    if _oauth_service is None:
        _oauth_service = FlutterwaveOAuthService()
    return _oauth_service


async def get_flutterwave_access_token(force_refresh: bool = False) -> Optional[str]:
    """
    Async helper to get Flutterwave access token.
    Can be called from async code without blocking.
    
    Args:
        force_refresh: Force token refresh
        
    Returns:
        str: Valid access token or None
    """
    service = get_oauth_service()
    return service.get_access_token(force_refresh=force_refresh)


def validate_flutterwave_oauth() -> bool:
    """
    Validate Flutterwave OAuth configuration on startup.
    Call this in Django ready() to ensure credentials are valid.
    
    Returns:
        bool: True if validation successful
    """
    service = get_oauth_service()
    return service.validate_credentials()
