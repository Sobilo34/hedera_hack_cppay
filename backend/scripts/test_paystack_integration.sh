#!/bin/bash

# Paystack Integration - Quick Start Test Guide
# Run these commands after adding your Paystack keys to .env

set -e

BACKEND_URL="http://localhost:8000"
API_VERSION="v1"

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                   PAYSTACK INTEGRATION TEST GUIDE                      ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if backend is running
echo "🔍 Step 1: Checking if backend is running..."
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1 || curl -s "$BACKEND_URL/api/$API_VERSION/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running${NC}"
    echo "Start it with: python manage.py runserver"
    exit 1
fi

echo ""
echo "🔍 Step 2: Testing Paystack Integration"
echo "==========================================="
echo ""

# Test data (these are valid for Paystack test mode)
TEST_ACCOUNT="0000000000"  # Test account for Paystack
TEST_BANK_CODE="001"        # Test bank code
TEST_PHONE="08012345678"    # Test phone number
TEST_METER="12345678901"    # Test meter number
TEST_SMARTCARD="1234567890" # Test smartcard number

# Generate unique reference
REFERENCE="test_$(date +%s)"
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjk5OTk5OTk5OTksInR5cGUiOiJhY2Nlc3MifQ.test"

echo "Test Reference: $REFERENCE"
echo "Test JWT Token: $JWT_TOKEN"
echo ""

# Test 1: Resolve Account Number
echo "📍 Test 1: Resolve Bank Account Number"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Request: Resolve NGN bank account"
echo "Endpoint: POST /api/$API_VERSION/payments/validate/account"
echo ""

curl -X POST "$BACKEND_URL/api/$API_VERSION/payments/validate/account" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"account_number\": \"$TEST_ACCOUNT\",
    \"bank_code\": \"$TEST_BANK_CODE\"
  }" 2>/dev/null | python -m json.tool

echo ""
echo "---"
echo ""

# Test 2: Get Banks List
echo "📍 Test 2: Get List of Nigerian Banks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: GET /api/$API_VERSION/payments/banks"
echo ""

curl -X GET "$BACKEND_URL/api/$API_VERSION/payments/banks" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" 2>/dev/null | python -m json.tool | head -50

echo ""
echo "... (truncated)"
echo ""
echo "---"
echo ""

# Test 3: Purchase Airtime
echo "📍 Test 3: Purchase Airtime (MTN)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: POST /api/$API_VERSION/payments/airtime"
echo ""

curl -X POST "$BACKEND_URL/api/$API_VERSION/payments/airtime" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone_number\": \"$TEST_PHONE\",
    \"amount\": 1000,
    \"provider\": \"mtn\"
  }" 2>/dev/null | python -m json.tool

echo ""
echo "---"
echo ""

# Test 4: Pay Electricity Bill
echo "📍 Test 4: Pay Electricity Bill (IKEDC)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: POST /api/$API_VERSION/payments/electricity"
echo ""

curl -X POST "$BACKEND_URL/api/$API_VERSION/payments/electricity" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"meter_number\": \"$TEST_METER\",
    \"amount\": 5000,
    \"provider\": \"ikedc\",
    \"meter_type\": \"prepaid\"
  }" 2>/dev/null | python -m json.tool

echo ""
echo "---"
echo ""

# Test 5: Pay Cable TV
echo "📍 Test 5: Pay Cable TV (DSTV)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: POST /api/$API_VERSION/payments/cable-tv"
echo ""

curl -X POST "$BACKEND_URL/api/$API_VERSION/payments/cable-tv" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"smart_card_number\": \"$TEST_SMARTCARD\",
    \"amount\": 3000,
    \"provider\": \"dstv\"
  }" 2>/dev/null | python -m json.tool

echo ""
echo "---"
echo ""

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                        TESTS COMPLETED                                ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Check that all responses have 'status': 'success' or similar"
echo "2. Verify data is returned correctly"
echo "3. Try with different providers and amounts"
echo "4. Check backend logs for any errors"
echo ""
echo "To view logs:"
echo "  tail -f backend/logs/app.log"
echo ""
echo "Paystack documentation: https://paystack.com/docs/"
echo ""
