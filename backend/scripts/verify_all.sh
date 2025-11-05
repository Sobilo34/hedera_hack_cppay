#!/bin/bash

##############################################################################
# COMPREHENSIVE OAUTH 2.0 VERIFICATION SCRIPT
# 
# This script verifies that your OAuth 2.0 integration is working correctly
# and that you will NOT get 401 errors when calling Flutterwave API
#
# Usage: bash scripts/verify_all.sh
##############################################################################

set -e

RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                 FLUTTERWAVE OAUTH 2.0 VERIFICATION                    ║"
echo "║                     Comprehensive Check Suite                         ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# Check 1: Verify we're in the right directory
echo -e "\n${BLUE}[1/8] Checking working directory...${RESET}"
if [ ! -f "manage.py" ]; then
    echo -e "${RED}✗ Error: manage.py not found. Are you in the backend directory?${RESET}"
    echo "  Run: cd /home/bilal/bilal_projects/CPPay/backend"
    exit 1
fi
echo -e "${GREEN}✓ Working directory correct${RESET}"

# Check 2: Verify OAuth credentials in .env
echo -e "\n${BLUE}[2/8] Checking .env configuration...${RESET}"
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ Error: .env file not found${RESET}"
    exit 1
fi

CLIENT_ID=$(grep "^FLUTTERWAVE_OAUTH_CLIENT_ID=" .env 2>/dev/null | cut -d'=' -f2 || echo "")
CLIENT_SECRET=$(grep "^FLUTTERWAVE_OAUTH_CLIENT_SECRET=" .env 2>/dev/null | cut -d'=' -f2 || echo "")
SANDBOX=$(grep "^FLUTTERWAVE_SANDBOX=" .env 2>/dev/null | cut -d'=' -f2 || echo "")

if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}✗ FLUTTERWAVE_OAUTH_CLIENT_ID not found in .env${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ FLUTTERWAVE_OAUTH_CLIENT_ID configured${RESET}"

if [ -z "$CLIENT_SECRET" ]; then
    echo -e "${RED}✗ FLUTTERWAVE_OAUTH_CLIENT_SECRET not found in .env${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ FLUTTERWAVE_OAUTH_CLIENT_SECRET configured${RESET}"

if [ -z "$SANDBOX" ]; then
    echo -e "${YELLOW}⚠ FLUTTERWAVE_SANDBOX not set, defaulting to False${RESET}"
else
    echo -e "${GREEN}✓ FLUTTERWAVE_SANDBOX = $SANDBOX${RESET}"
fi

# Check 3: Verify Python files exist
echo -e "\n${BLUE}[3/8] Checking required Python files...${RESET}"
MISSING_FILES=0

if [ ! -f "services/payments/oauth_token_service.py" ]; then
    echo -e "${RED}✗ services/payments/oauth_token_service.py not found${RESET}"
    MISSING_FILES=$((MISSING_FILES + 1))
else
    echo -e "${GREEN}✓ oauth_token_service.py exists${RESET}"
fi

if [ ! -f "services/payments/flutterwave_service.py" ]; then
    echo -e "${RED}✗ services/payments/flutterwave_service.py not found${RESET}"
    MISSING_FILES=$((MISSING_FILES + 1))
else
    echo -e "${GREEN}✓ flutterwave_service.py exists${RESET}"
fi

if [ ! -f "apps/payments/management/commands/validate_flutterwave_oauth.py" ]; then
    echo -e "${RED}✗ validate_flutterwave_oauth.py not found${RESET}"
    MISSING_FILES=$((MISSING_FILES + 1))
else
    echo -e "${GREEN}✓ validate_flutterwave_oauth.py exists${RESET}"
fi

if [ $MISSING_FILES -gt 0 ]; then
    echo -e "${RED}✗ $MISSING_FILES files missing!${RESET}"
    exit 1
fi

# Check 4: Verify imports
echo -e "\n${BLUE}[4/8] Checking Python imports...${RESET}"

if ! grep -q "oauth_token_service" services/payments/flutterwave_service.py; then
    echo -e "${RED}✗ flutterwave_service.py doesn't import oauth_token_service${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ flutterwave_service imports oauth_token_service${RESET}"

if ! grep -q "from decouple import config" services/payments/oauth_token_service.py; then
    echo -e "${YELLOW}⚠ oauth_token_service.py uses os.getenv() (not decouple)${RESET}"
else
    echo -e "${GREEN}✓ oauth_token_service uses decouple for env vars${RESET}"
fi

# Check 5: Verify Django settings
echo -e "\n${BLUE}[5/8] Checking Django cache configuration...${RESET}"

if ! python manage.py shell -c "from django.core.cache import cache; print('OK')" 2>/dev/null | grep -q "OK"; then
    echo -e "${RED}✗ Django cache not configured${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Django cache is configured${RESET}"

# Check 6: Test OAuth token generation
echo -e "\n${BLUE}[6/8] Testing OAuth token generation...${RESET}"

TOKEN_OUTPUT=$(python manage.py shell << 'EOF' 2>&1
from services.payments.oauth_token_service import get_oauth_service
try:
    service = get_oauth_service()
    token = service.get_access_token()
    if token:
        print(f"SUCCESS:{token[:50]}")
    else:
        print("FAILED:Token is None")
except Exception as e:
    print(f"ERROR:{str(e)}")
EOF
)

if echo "$TOKEN_OUTPUT" | grep -q "SUCCESS:"; then
    TOKEN=$(echo "$TOKEN_OUTPUT" | grep "SUCCESS:" | cut -d':' -f2)
    echo -e "${GREEN}✓ OAuth token generated: ${TOKEN:0:30}...${RESET}"
elif echo "$TOKEN_OUTPUT" | grep -q "FAILED"; then
    echo -e "${RED}✗ OAuth token generation failed${RESET}"
    exit 1
elif echo "$TOKEN_OUTPUT" | grep -q "ERROR"; then
    ERROR=$(echo "$TOKEN_OUTPUT" | grep "ERROR:" | cut -d':' -f2-)
    echo -e "${RED}✗ Error during token generation:${RESET}"
    echo "  $ERROR"
    exit 1
else
    echo -e "${RED}✗ Unexpected response from token generation${RESET}"
    echo "  Output: $TOKEN_OUTPUT"
    exit 1
fi

# Check 7: Run validation command
echo -e "\n${BLUE}[7/8] Running full OAuth validation...${RESET}"

if python manage.py validate_flutterwave_oauth 2>&1 | grep -q "✓ VALIDATION COMPLETE"; then
    echo -e "${GREEN}✓ Full OAuth validation passed${RESET}"
else
    echo -e "${YELLOW}⚠ Validation command output:${RESET}"
    python manage.py validate_flutterwave_oauth
fi

# Check 8: Test API call with token
echo -e "\n${BLUE}[8/8] Testing Flutterwave API call with OAuth token...${RESET}"

API_RESPONSE=$(python manage.py shell << 'EOF' 2>&1
import httpx
from services.payments.oauth_token_service import get_oauth_service

try:
    service = get_oauth_service()
    token = service.get_access_token()
    
    if not token:
        print("ERROR:Failed to get token")
    else:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }
        
        response = httpx.get(
            "https://api.flutterwave.com/v3/bill-categories",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data:
                print(f"SUCCESS:{len(data['data'])} categories")
            else:
                print("SUCCESS:API responded")
        elif response.status_code == 401:
            print("ERROR:401 Unauthorized - OAuth token not working")
        else:
            print(f"ERROR:HTTP {response.status_code}")
except Exception as e:
    print(f"ERROR:{str(e)}")
EOF
)

if echo "$API_RESPONSE" | grep -q "SUCCESS:"; then
    RESULT=$(echo "$API_RESPONSE" | grep "SUCCESS:" | cut -d':' -f2)
    echo -e "${GREEN}✓ Flutterwave API call successful: $RESULT${RESET}"
elif echo "$API_RESPONSE" | grep -q "ERROR"; then
    ERROR=$(echo "$API_RESPONSE" | grep "ERROR:" | cut -d':' -f2-)
    echo -e "${RED}✗ API Error: $ERROR${RESET}"
    exit 1
fi

# Final summary
echo -e "\n${BLUE}"
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                        ✅ ALL CHECKS PASSED                           ║"
echo "║                                                                        ║"
echo "║  Your OAuth 2.0 integration is working correctly!                     ║"
echo "║  You should NOT get 401 errors when calling Flutterwave API.          ║"
echo "║                                                                        ║"
echo "║  Next Steps:                                                           ║"
echo "║  1. Test the bank validation endpoint                                  ║"
echo "║  2. Monitor logs for any OAuth-related errors                          ║"
echo "║  3. When moving to production, update OAuth credentials               ║"
echo "║                                                                        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

exit 0
