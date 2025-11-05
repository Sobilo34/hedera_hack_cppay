# Crypto-to-Naira API Reference

## Overview

Complete API reference for all crypto-to-naira transaction endpoints. All endpoints require authentication (JWT token) unless otherwise noted.

## Base URL

```
Production: https://api.cppay.io/api/v1/payments/crypto-to-naira
Development: http://localhost:8000/api/v1/payments/crypto-to-naira
```

## Authentication

All authenticated endpoints require:

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

## Transaction Endpoints

### 1. Create Crypto-to-Naira Transaction

Initialize a new crypto-to-naira transaction with all details.

**Endpoint:**
```
POST /create
```

**Authentication:** Required

**Request Body:**
```json
{
  "crypto_token": "ETH",
  "naira_amount": 50000,
  "recipient_bank_code": "011",
  "recipient_account_number": "1234567890",
  "recipient_account_name": "John Doe",
  "chain_id": 8453,
  "memo": "Payment for services"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| crypto_token | string | Yes | Token symbol (ETH, USDC, USDT, DAI) |
| naira_amount | float | Yes | Amount in NGN to send |
| recipient_bank_code | string | Yes | Bank code (e.g., "011" for First Bank) |
| recipient_account_number | string | Yes | 10-digit account number |
| recipient_account_name | string | Yes | Account holder name |
| chain_id | integer | Yes | Blockchain chain ID (8453 for Base) |
| memo | string | No | Optional transaction note |

**Response:**
```json
{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "initiated",
  "crypto_amount": 0.025,
  "naira_amount": 50000,
  "exchange_rate": 2000000,
  "gas_fee": 0.001,
  "total_crypto_needed": 0.026,
  "estimated_settlement_time": 5
}
```

**Status Codes:**
- `200 OK`: Transaction created successfully
- `400 Bad Request`: Invalid input or insufficient balance
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Server error

**Errors:**
```json
{
  "detail": "Invalid bank account details"
}
```

---

### 2. Calculate Crypto Needed

Calculate how much crypto is needed for a given naira amount.

**Endpoint:**
```
POST /calculate
```

**Authentication:** Not required

**Request Body:**
```json
{
  "crypto_token": "ETH",
  "naira_amount": 50000,
  "chain_id": 8453
}
```

**Response:**
```json
{
  "crypto_amount": 0.025,
  "total_crypto_needed": 0.026,
  "gas_fee": 0.001,
  "exchange_rate": 2000000,
  "stablecoin": "USDC"
}
```

**Description:**
Includes exchange rate, gas fee estimation, and slippage calculation. Amounts are approximate and updated every 5 seconds.

---

### 3. Get Transaction Status

Get complete status of a transaction including all stages and progress.

**Endpoint:**
```
GET /transactions/{transaction_id}
```

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| transaction_id | string (UUID) | Transaction ID from creation |

**Response:**
```json
{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "swap_confirmed",
  "crypto_amount": 0.025,
  "naira_amount": 50000,
  "exchange_rate": 2000000,
  "gas_fee": 0.001,
  "progress": [
    {
      "stage": "initiated",
      "progress": 5,
      "timestamp": 1704067200000,
      "message": "Transaction initiated"
    },
    {
      "stage": "crypto_calculated",
      "progress": 25,
      "timestamp": 1704067205000,
      "message": "Crypto amount calculated"
    },
    {
      "stage": "signing",
      "progress": 40,
      "timestamp": 1704067210000,
      "message": "Waiting for transaction signature..."
    },
    {
      "stage": "swap_initiated",
      "progress": 60,
      "timestamp": 1704067220000,
      "message": "Swap transaction submitted"
    },
    {
      "stage": "swap_confirmed",
      "progress": 75,
      "timestamp": 1704067225000,
      "message": "Swap confirmed on blockchain"
    }
  ],
  "current_stage": "swap_confirmed",
  "user_operation_hash": "0x1234567890abcdef"
}
```

---

### 4. Complete Transaction

Mark a transaction as completed (settled).

**Endpoint:**
```
POST /transactions/{transaction_id}/complete
```

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| transaction_id | string (UUID) | Transaction ID |

**Response:**
```json
{
  "status": "success",
  "message": "Transaction marked as completed"
}
```

---

## UserOperation Endpoints

### 5. Create UserOperation

Create an Account Abstraction UserOperation for the swap transaction.

**Endpoint:**
```
POST /user-operations/create
```

**Authentication:** Required

**Request Body:**
```json
{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_address": "0x1234567890123456789012345678901234567890",
  "call_data": "0x...",
  "chain_id": 8453
}
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| transaction_id | string (UUID) | Transaction ID |
| sender_address | string | Smart account address |
| call_data | string | Encoded call to SmartAccount.execute() |
| chain_id | integer | Blockchain chain ID |

**Response:**
```json
{
  "user_operation_hash": "0x...",
  "nonce": 5,
  "call_gas_limit": 100000,
  "pre_verification_gas": 21000,
  "verification_gas_limit": 100000,
  "max_fee_per_gas": "20000000000",
  "max_priority_fee_per_gas": "1000000000"
}
```

**Description:**
Returns a UserOperation ready for signing. Frontend must sign this with user's private key before submission.

---

### 6. Submit UserOperation

Submit a signed UserOperation to the bundler for execution.

**Endpoint:**
```
POST /user-operations/submit
```

**Authentication:** Required

**Request Body:**
```json
{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_operation": {
    "sender": "0x...",
    "nonce": 5,
    "initCode": "0x",
    "callData": "0x...",
    "accountGasLimits": "0x...",
    "preVerificationGas": 21000,
    "gasFees": "0x...",
    "paymasterAndData": "0x",
    "signature": "0x..."
  },
  "chain_id": 8453
}
```

**Response:**
```json
{
  "user_operation_hash": "0x...",
  "status": "submitted"
}
```

**Description:**
Submits to Pimlico bundler. Returns operation hash that can be used to track on-chain execution.

---

### 7. Get UserOperation Status

Get the execution status of a submitted UserOperation.

**Endpoint:**
```
GET /user-operations/{user_op_hash}?chain_id={chain_id}
```

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| user_op_hash | string | UserOperation hash from submission |
| chain_id | integer | Blockchain chain ID (query param) |

**Response:**
```json
{
  "confirmed": true,
  "transaction_hash": "0x1234567890abcdef",
  "block_number": 12345678,
  "status": "confirmed"
}
```

**Polling:**
- Poll every 3-5 seconds for updates
- Timeout after 5 minutes of waiting
- Returns `confirmed: true` once included in block

---

## Smart Account Endpoints

### 8. Build Swap Call Data

Generate encoded call data for smart contract swap execution.

**Endpoint:**
```
POST /smart-account/build-swap-call
```

**Authentication:** Not required

**Request Body:**
```json
{
  "smart_account_address": "0x...",
  "token_in": "ETH",
  "amount_in": 0.025,
  "token_out": "USDC"
}
```

**Response:**
```json
{
  "call_data": "0x..."
}
```

**Description:**
Encodes call data that will be executed by SmartAccount.execute(). This call data goes through SwapRouter to convert tokens.

---

### 9. Get Smart Account Address

Get or derive the smart account address for a user EOA.

**Endpoint:**
```
GET /smart-account/{user_address}
```

**Authentication:** Not required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| user_address | string | User's externally owned account (EOA) address |

**Response:**
```json
{
  "smart_account_address": "0x..."
}
```

**Description:**
If smart account doesn't exist, derives the deterministic address. Actual deployment happens when first UserOperation is submitted.

---

## Paystack Endpoints

### 10. Initiate Bank Transfer

Initiate a naira bank transfer via Paystack.

**Endpoint:**
```
POST /paystack/transfer
```

**Authentication:** Required

**Request Body:**
```json
{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "naira_amount": 50000,
  "recipient_bank_code": "011",
  "recipient_account_number": "1234567890",
  "recipient_account_name": "John Doe",
  "memo": "Payment for services"
}
```

**Response:**
```json
{
  "reference": "PK_ref_123456789",
  "status": "initiated"
}
```

**Description:**
Submits transfer request to Paystack. Transfer typically completes within 1-10 seconds depending on the bank.

---

### 11. Get Paystack Transfer Status

Check the status of a bank transfer.

**Endpoint:**
```
GET /paystack/transfer/{reference}
```

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| reference | string | Paystack transfer reference |

**Response (Success):**
```json
{
  "reference": "PK_ref_123456789",
  "status": "success",
  "successful": true,
  "failed": false
}
```

**Response (Pending):**
```json
{
  "reference": "PK_ref_123456789",
  "status": "pending",
  "successful": false,
  "failed": false
}
```

**Response (Failed):**
```json
{
  "reference": "PK_ref_123456789",
  "status": "failed",
  "successful": false,
  "failed": true,
  "reason": "Account suspended"
}
```

**Polling:**
- Poll every 2-3 seconds
- Timeout after 2 minutes
- Check for `successful: true` for completion

---

## Bank Endpoints

### 12. Validate Bank Account

Validate a bank account before transfer.

**Endpoint:**
```
POST /banks/validate-account
```

**Authentication:** Not required

**Request Body:**
```json
{
  "bank_code": "011",
  "account_number": "1234567890"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "account_name": "John Doe"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "account_name": null
}
```

**Description:**
Validates account against bank records via Paystack. Account name must match the recipient name provided in transaction.

---

### 13. Get Banks List

Get list of all supported Nigerian banks.

**Endpoint:**
```
GET /banks/list
```

**Authentication:** Not required

**Response:**
```json
{
  "banks": [
    {
      "code": "011",
      "name": "First Bank Nigeria",
      "short_name": "FB"
    },
    {
      "code": "044",
      "name": "Access Bank Nigeria",
      "short_name": "Access"
    },
    {
      "code": "050",
      "name": "Ecobank Nigeria",
      "short_name": "Ecobank"
    },
    ...
  ]
}
```

**Pagination:**
- Currently returns all banks
- Typically 50-100 banks total
- Response cached for 24 hours

---

## Error Codes

### Standard HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid parameters or validation failed |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User not allowed to perform this action |
| 404 | Not Found | Resource not found (e.g., transaction ID) |
| 422 | Unprocessable Entity | Request validation error |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | External service unavailable (Paystack, DEX, etc) |

### Error Response Format

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common Error Messages

| Message | Cause | Solution |
|---------|-------|----------|
| "Invalid bank account details" | Account doesn't exist or is invalid | Verify account number and bank code |
| "Insufficient balance" | Not enough crypto to send | Add more tokens to wallet |
| "Invalid bank account details" | Account number format wrong | Enter 10-digit account number |
| "Failed to create UserOperation" | Invalid call data or gas estimation | Retry with new parameters |
| "Bundler rejected UserOperation" | Signature invalid or gas too low | Retry with new gas prices |
| "Bank transfer failed" | Paystack error or bank issue | Check reference on Paystack dashboard |

---

## Rate Limits

- **Per User**: 10 transactions per hour
- **Per IP**: 100 requests per minute
- **Paystack API**: 50 requests per second
- **Price Oracle**: 100 requests per minute

Exceeding limits returns `429 Too Many Requests`.

---

## Timeouts

| Operation | Timeout |
|-----------|---------|
| API Request | 30 seconds |
| UserOperation Confirmation | 5 minutes |
| Bank Transfer | 2 minutes |
| Price Quote | 10 seconds |

---

## Webhooks (Future)

Paystack webhooks can be configured to notify your server of transfer status changes instead of polling.

```json
POST /webhooks/paystack

{
  "event": "charge.success",
  "data": {
    "reference": "PK_ref_123456789",
    "status": "success",
    "amount": 5000000,
    "transaction_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Examples

### Complete Transaction Flow

```bash
# 1. Calculate crypto needed
curl -X POST http://localhost:8000/api/v1/payments/crypto-to-naira/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "crypto_token": "ETH",
    "naira_amount": 50000,
    "chain_id": 8453
  }'

# 2. Create transaction
curl -X POST http://localhost:8000/api/v1/payments/crypto-to-naira/create \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "crypto_token": "ETH",
    "naira_amount": 50000,
    "recipient_bank_code": "011",
    "recipient_account_number": "1234567890",
    "recipient_account_name": "John Doe",
    "chain_id": 8453
  }'

# 3. Create UserOperation
curl -X POST http://localhost:8000/api/v1/payments/crypto-to-naira/user-operations/create \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
    "sender_address": "0x...",
    "call_data": "0x...",
    "chain_id": 8453
  }'

# 4. Submit signed UserOperation
curl -X POST http://localhost:8000/api/v1/payments/crypto-to-naira/user-operations/submit \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_operation": {...},
    "chain_id": 8453
  }'

# 5. Monitor UserOperation
curl http://localhost:8000/api/v1/payments/crypto-to-naira/user-operations/0x... \
  -H "Authorization: Bearer {token}"

# 6. Initiate bank transfer
curl -X POST http://localhost:8000/api/v1/payments/crypto-to-naira/paystack/transfer \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
    "naira_amount": 50000,
    "recipient_bank_code": "011",
    "recipient_account_number": "1234567890",
    "recipient_account_name": "John Doe"
  }'

# 7. Check transfer status
curl http://localhost:8000/api/v1/payments/crypto-to-naira/paystack/transfer/PK_ref_123456789 \
  -H "Authorization: Bearer {token}"
```

---

**Last Updated:** 2024-01-01
**API Version:** 1.0.0
