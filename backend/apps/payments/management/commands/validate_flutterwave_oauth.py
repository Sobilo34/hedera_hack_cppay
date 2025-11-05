"""
Django management command to validate Flutterwave OAuth configuration
Usage: python manage.py validate_flutterwave_oauth
"""
from django.core.management.base import BaseCommand, CommandError
from services.payments.oauth_token_service import get_oauth_service


class Command(BaseCommand):
    help = 'Validate Flutterwave OAuth 2.0 configuration and test token generation'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force-refresh',
            action='store_true',
            help='Force refresh token even if cached',
        )
        parser.add_argument(
            '--show-metadata',
            action='store_true',
            help='Show cached token metadata',
        )
        parser.add_argument(
            '--clear-cache',
            action='store_true',
            help='Clear cached token',
        )

    def handle(self, *args, **options):
        self.stdout.write("=" * 70)
        self.stdout.write("FLUTTERWAVE OAUTH 2.0 CONFIGURATION VALIDATION")
        self.stdout.write("=" * 70)
        self.stdout.write("")

        service = get_oauth_service()

        # Show configuration
        self.stdout.write(self.style.HTTP_INFO("CONFIGURATION:"))
        self.stdout.write(f"  Client ID: {service.client_id[:20] if service.client_id else 'NOT SET'}...")
        self.stdout.write(f"  Client Secret: {'*' * 10 if service.client_secret else 'NOT SET'}")
        self.stdout.write(f"  Environment: {service.environment}")
        self.stdout.write(f"  Token Endpoint: {service.TOKEN_ENDPOINT}")
        self.stdout.write("")

        # Clear cache if requested
        if options['clear_cache']:
            self.stdout.write(self.style.WARNING("Clearing cached token..."))
            service.clear_cache()
            self.stdout.write(self.style.SUCCESS("✓ Cache cleared"))
            self.stdout.write("")

        # Get token
        self.stdout.write(self.style.HTTP_INFO("ATTEMPTING TOKEN GENERATION:"))
        force_refresh = options['force_refresh']
        if force_refresh:
            self.stdout.write("  (Force refresh enabled)")
        
        token = service.get_access_token(force_refresh=force_refresh)

        if token:
            self.stdout.write(self.style.SUCCESS(f"✓ Token obtained successfully"))
            self.stdout.write(f"  Token: {token[:40]}...{token[-10:]}")
            self.stdout.write(f"  Length: {len(token)} characters")
            self.stdout.write("")

            # Show metadata if requested
            if options['show_metadata']:
                metadata = service.get_token_metadata()
                if metadata:
                    self.stdout.write(self.style.HTTP_INFO("TOKEN METADATA:"))
                    self.stdout.write(f"  Cached At: {metadata.get('cached_at')}")
                    self.stdout.write(f"  Expires At: {metadata.get('expires_at')}")
                    self.stdout.write(f"  TTL: {metadata.get('expires_in_seconds')} seconds")
                    self.stdout.write(f"  Environment: {metadata.get('environment')}")
                    self.stdout.write(f"  Scope: {metadata.get('scope')}")
                    self.stdout.write("")

            # Test API call with token
            self.stdout.write(self.style.HTTP_INFO("TESTING API CALL:"))
            self.stdout.write("  Making test request to Flutterwave API...")
            
            try:
                import httpx
                headers = {
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json',
                }
                
                # Test with bill categories endpoint (read-only, safe)
                response = httpx.get(
                    "https://api.flutterwave.com/v3/bill-categories",
                    headers=headers,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('status') == 'success':
                        count = len(data.get('data', []))
                        self.stdout.write(self.style.SUCCESS(
                            f"✓ API call successful! Found {count} bill categories"
                        ))
                    else:
                        self.stdout.write(self.style.WARNING(
                            f"⚠ API returned non-success status: {data.get('status')}"
                        ))
                else:
                    self.stdout.write(self.style.ERROR(
                        f"✗ API returned status {response.status_code}"
                    ))
                    self.stdout.write(f"  Response: {response.text[:200]}")
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"✗ API call failed: {e}"))
            
            self.stdout.write("")

        else:
            self.stdout.write(self.style.ERROR("✗ Failed to obtain token"))
            self.stdout.write("")
            self.stdout.write(self.style.ERROR("TROUBLESHOOTING:"))
            self.stdout.write("  1. Check FLUTTERWAVE_OAUTH_CLIENT_ID is set in .env")
            self.stdout.write("  2. Check FLUTTERWAVE_OAUTH_CLIENT_SECRET is set in .env")
            self.stdout.write("  3. Verify credentials are correct in Flutterwave Dashboard")
            self.stdout.write("  4. Check network connectivity to Flutterwave auth server")
            raise CommandError("OAuth token generation failed")

        # Final summary
        self.stdout.write("=" * 70)
        self.stdout.write(self.style.SUCCESS("✓ VALIDATION COMPLETE"))
        self.stdout.write("=" * 70)
        self.stdout.write("")
        self.stdout.write("You can now use Flutterwave API endpoints!")
        self.stdout.write("")
        self.stdout.write("Usage in your code:")
        self.stdout.write("  from services.payments import FlutterwaveService")
        self.stdout.write("  service = FlutterwaveService()")
        self.stdout.write("  # Token will be automatically managed")
        self.stdout.write("")
