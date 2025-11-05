# Flutterwave 401 Error Prevention & Testing Guide

**Date**: October 19, 2025  
**Issue**: "Client error '401 Unauthorized' for url 'https://api.flutterwave.com/v3/accounts/resolve'"  
**Root Cause**: Backend not using OAuth token for API calls  
**Solution**: Verify OAuth integration and test endpoints

---

## 🔍 Understanding the Error

```
{
  "detail": "Client error '401 Unauthorized' for url 'https://api.flutterwave.com/v3/accounts/resolve'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401"
}
```

**This means**:
- ✗ Backend is calling Flutterwave API
- ✗ But using invalid/expired/missing authentication
- ✓ OAuth token generation is working (we verified earlier)
- ✗ OAuth token NOT being used in API calls

---

## ✅ Step 1: Verify OAuth Token is Generated

```bash
cd /home/bilal/bilal_projects/CPPay/backend

# Test OAuth token generation
python manage.py validate_flutterwave_oauth --show-metadata
```

**Expected Output**:
```
✓ Token obtained successfully
  Token: eyJhbGciOiJSUzI1NiIs...
  Length: 1847 characters

TOKEN METADATA:
  Cached At: 2025-10-19T14:32:15.123456
  Expires At: 2025-10-19T14:41:15.123456
  TTL: 540 seconds
  Environment: sandbox
  Scope: email profile
```

✅ If you see this, OAuth tokens ARE being generated correctly.

---

## ✅ Step 2: Verify OAuth Token is Being Used

The backend should automatically use OAuth tokens. Let me create a diagnostic script:
<function_calls>
<invoke name="create_file">
<parameter name="content">#!/bin/bash

# Flutterwave OAuth Usage Diagnostic Script
# Verifies that OAuth tokens are being used correctly

set -e

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                        ║"
echo "║    FLUTTERWAVE OAUTH DIAGNOSTIC - Verify Token Usage                  ║"
echo "║                                                                        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

BASE_DIR="/home/bilal/bilal_projects/CPPay/backend"
cd "$BASE_DIR"

echo "STEP 1: Check .env Configuration"
echo "================================="
echo ""

if grep -q "FLUTTERWAVE_OAUTH_CLIENT_ID" .env; then
    echo "✓ FLUTTERWAVE_OAUTH_CLIENT_ID is set"
    CLIENT_ID=$(grep "FLUTTERWAVE_OAUTH_CLIENT_ID" .env | cut -d'=' -f2)
    echo "  Value: ${CLIENT_ID:0:20}..."
else
    echo "✗ FLUTTERWAVE_OAUTH_CLIENT_ID NOT found in .env"
fi

if grep -q "FLUTTERWAVE_OAUTH_CLIENT_SECRET" .env; then
    echo "✓ FLUTTERWAVE_OAUTH_CLIENT_SECRET is set"
    echo "  Value: ******* (hidden for security)"
else
    echo "✗ FLUTTERWAVE_OAUTH_CLIENT_SECRET NOT found in .env"
fi

if grep -q "FLUTTERWAVE_SANDBOX=True" .env; then
    echo "✓ FLUTTERWAVE_SANDBOX is set to True (sandbox mode)"
else
    echo "⚠ FLUTTERWAVE_SANDBOX might not be True"
fi

echo ""
echo "STEP 2: Check OAuth Service Code"
echo "================================="
echo ""

if grep -q "get_oauth_service" services/payments/flutterwave_service.py; then
    echo "✓ FlutterwaveService imports OAuth service"
else
    echo "✗ FlutterwaveService does NOT import OAuth service"
fi

if grep -q "oauth_service.get_access_token()" services/payments/flutterwave_service.py; then
    echo "✓ FlutterwaveService calls OAuth token method"
else
    echo "✗ FlutterwaveService does NOT call OAuth token method"
fi

echo ""
echo "STEP 3: Verify OAuth Token Generation"
echo "====================================="
echo ""

python manage.py validate_flutterwave_oauth 2>&1 | grep -E "(✓|✗|Token obtained|Failed)" | head -5

echo ""
echo "STEP 4: Check Cache Configuration"
echo "=================================="
echo ""

grep -A 5 "CACHES" config/settings/base.py | head -10

echo ""
echo "STEP 5: Test OAuth Service Directly"
echo "===================================="
echo ""

python manage.py shell << 'EOF'
from services.payments.oauth_token_service import get_oauth_service

service = get_oauth_service()
print(f"Client ID configured: {bool(service.client_id)}")
print(f"Client Secret configured: {bool(service.client_secret)}")
print(f"Environment: {service.environment}")

token = service.get_access_token()
if token:
    print(f"✓ Token generated: {token[:40]}...{token[-10:]}")
    metadata = service.get_token_metadata()
    if metadata:
        print(f"  Expires at: {metadata['expires_at']}")
else:
    print("✗ Failed to generate token")
EOF

echo ""
echo "✅ DIAGNOSTIC COMPLETE"
echo ""
