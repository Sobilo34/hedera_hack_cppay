#!/bin/bash

# Bank Validation Endpoint Test with OAuth
# Tests the /api/v1/payments/validate/account endpoint

set -e

BASE_URL="http://localhost:8000/api/v1"
BACKEND_DIR="/home/bilal/bilal_projects/CPPay/backend"

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                        ║"
echo "║    BANK VALIDATION ENDPOINT TEST                                      ║"
echo "║                                                                        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Verify OAuth is working
echo "STEP 1: Verify OAuth Token Generation"
echo "====================================="
echo ""

cd "$BACKEND_DIR"
OAUTH_STATUS=$(python manage.py validate_flutterwave_oauth 2>&1 | grep "Token obtained" | head -1)

if [[ $OAUTH_STATUS == *"✓"* ]]; then
    echo "✓ OAuth token generation: SUCCESS"
else
    echo "✗ OAuth token generation: FAILED"
    echo "Run: python manage.py validate_flutterwave_oauth --show-metadata"
    exit 1
fi

echo ""
echo "STEP 2: Get Backend Authentication Token"
echo "========================================"
echo ""

# Create a test user and get token (or use existing)
USER_TOKEN=$(python manage.py shell << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.users.models import User
from rest_framework_simplejwt.tokens import RefreshToken

# Get first user or create test user
try:
    user = User.objects.first()
    if not user:
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
    
    # Generate JWT token
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    print(access_token)
except Exception as e:
    print(f"Error: {e}")
    exit(1)
EOF
)

if [ -z "$USER_TOKEN" ] || [[ "$USER_TOKEN" == *"Error"* ]]; then
    echo "✗ Failed to get authentication token"
    echo "Error: $USER_TOKEN"
    exit 1
fi

echo "✓ Backend token obtained: ${USER_TOKEN:0:40}..."

echo ""
echo "STEP 3: Test Bank Validation Endpoint"
echo "===================================="
echo ""

echo "Endpoint: POST $BASE_URL/payments/validate/account"
echo "Parameters:"
echo "  - account_number: 3036377991"
echo "  - bank_code: 011"
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/payments/validate/account" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "account_number": "3036377991",
    "bank_code": "011"
  }')

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

echo ""
echo "STEP 4: Analyze Response"
echo "======================="
echo ""

if echo "$RESPONSE" | grep -q "401 Unauthorized"; then
    echo "✗ STILL GETTING 401 ERROR!"
    echo ""
    echo "Debugging steps:"
    echo "  1. Check if Flutterwave API credentials are correct"
    echo "  2. Verify OAuth token is being passed to Flutterwave"
    echo "  3. Check backend logs for errors"
    echo ""
    echo "Backend logs:"
    tail -50 logs/django.log 2>/dev/null | grep -i "flutterwave\|oauth" | tail -20
    
elif echo "$RESPONSE" | grep -q '"status":"success"'; then
    echo "✓ SUCCESS! Bank validation worked!"
    
elif echo "$RESPONSE" | grep -q '"detail"'; then
    ERROR=$(echo "$RESPONSE" | jq -r '.detail' 2>/dev/null)
    echo "⚠ Response error: $ERROR"
    
else
    echo "? Unexpected response format"
fi

echo ""
echo "STEP 5: Manual OAuth Token Test"
echo "==============================="
echo ""

echo "Testing if OAuth token works directly with Flutterwave API:"
echo ""

OAUTH_TOKEN=$(python manage.py shell << 'EOF'
from services.payments.oauth_token_service import get_oauth_service
service = get_oauth_service()
token = service.get_access_token()
print(token)
EOF
)

echo "OAuth Token: ${OAUTH_TOKEN:0:50}..."

if [ -z "$OAUTH_TOKEN" ] || [[ "$OAUTH_TOKEN" == "None" ]]; then
    echo "✗ OAuth token is empty or None!"
else
    echo "✓ OAuth token obtained, testing against Flutterwave API..."
    
    FLUTTERWAVE_TEST=$(curl -s -X GET "https://api.flutterwave.com/v3/bill-categories" \
      -H "Authorization: Bearer $OAUTH_TOKEN" \
      -H "Content-Type: application/json")
    
    if echo "$FLUTTERWAVE_TEST" | grep -q '"status":"success"'; then
        echo "✓ OAuth token works with Flutterwave API!"
    elif echo "$FLUTTERWAVE_TEST" | grep -q "401"; then
        echo "✗ OAuth token returned 401 from Flutterwave"
        echo "Response: $FLUTTERWAVE_TEST"
    else
        echo "? Unexpected response from Flutterwave"
        echo "Response: $FLUTTERWAVE_TEST"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "TEST COMPLETE"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
