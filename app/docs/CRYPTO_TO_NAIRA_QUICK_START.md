# Crypto-to-Naira Quick Start Guide

## Overview

This guide shows developers how to integrate and use the crypto-to-naira transaction system in their applications.

## Installation

### Frontend Setup

1. **Install dependencies** (already in package.json):
```bash
cd frontend
npm install
```

2. **Update environment variables** (.env or .env.local):
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_PUBLIC_API_VERSION=v1
```

### Backend Setup

1. **Ensure services are running**:
```bash
cd backend
python manage.py migrate
uvicorn config.asgi:application --reload
```

2. **Configure Paystack credentials** in .env:
```
PAYSTACK_SECRET_KEY=your_paystack_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

## Quick Integration

### Basic Usage

```typescript
// In your screen/component
import CryptoToNairaTransactionFlow from '@/app/screens/CryptoToNairaTransactionFlow';

export default function PaymentScreen() {
  const [showCryptoNaira, setShowCryptoNaira] = useState(false);
  const userPrivateKey = ... // Get from secure storage

  if (showCryptoNaira) {
    return (
      <CryptoToNairaTransactionFlow
        chainId={8453}  // Base
        userPrivateKey={userPrivateKey}
        onClose={() => setShowCryptoNaira(false)}
      />
    );
  }

  return (
    <View>
      <Button 
        title="Send Crypto as Naira"
        onPress={() => setShowCryptoNaira(true)}
      />
    </View>
  );
}
```

### Custom Implementation

If you want more control over the flow:

```typescript
import CryptoToNairaService from '@/services/CryptoToNairaService';
import BackendApiService from '@/services/BackendApiService';

// Initialize service
const service = new CryptoToNairaService(8453);

// Step 1: Calculate crypto needed
const calculation = await BackendApiService.calculateCryptoNeeded({
  cryptoToken: 'ETH',
  nairaAmount: 50000,
  chainId: 8453,
});
console.log(`Need ${calculation.cryptoAmount} ETH + ${calculation.gasFee} ETH gas`);

// Step 2: Initiate transaction
const txResult = await service.initiateTransaction({
  cryptoToken: 'ETH',
  nairaAmount: 50000,
  recipientBankCode: '011',
  recipientAccountNumber: '1234567890',
  recipientAccountName: 'John Doe',
  chainId: 8453,
});
const transactionId = txResult.transactionId;

// Step 3: Sign and execute
const swapResult = await service.signAndExecuteSwap(
  transactionId,
  userPrivateKey,
  {
    cryptoToken: 'ETH',
    nairaAmount: 50000,
    recipientBankCode: '011',
    recipientAccountNumber: '1234567890',
    recipientAccountName: 'John Doe',
    chainId: 8453,
  }
);

// Step 4: Monitor completion
await service.waitForSwapConfirmation(
  transactionId,
  swapResult.userOperationHash,
  { /* request */ }
);

// Step 5: Track status
const progress = service.getTransactionProgress(transactionId);
progress.forEach(p => {
  console.log(`[${p.stage}] ${p.message} (${p.progress}%)`);
});
```

## Frontend File Structure

```
frontend/
├── services/
│   ├── CryptoToNairaService.ts       # Main orchestration service
│   ├── SmartAccountService.ts        # AA operations
│   └── BackendApiService.ts          # (Updated with new endpoints)
│
├── app/screens/
│   ├── AmountInputScreen.tsx         # Step 1: Amount input
│   ├── BankRecipientScreen.tsx       # Step 2: Bank selection
│   ├── TransactionReviewScreen.tsx   # Step 3: Review
│   ├── TransactionStatusScreen.tsx   # Step 4: Status tracking
│   └── CryptoToNairaTransactionFlow.tsx # Master flow orchestrator
│
└── docs/
    └── CRYPTO_TO_NAIRA_IMPLEMENTATION.md # Full documentation
```

## Backend File Structure

```
backend/
├── api/routers/
│   ├── crypto_to_naira.py           # All endpoints
│   ├── main.py                       # (Updated with router)
│   └── ...
│
├── services/
│   ├── payments/                     # CryptoToFiatBridge
│   ├── blockchain/                   # TransactionService
│   └── ...
│
└── apps/
    ├── transactions/models.py        # Transaction model
    └── ...
```

## API Endpoints Reference

### Calculate Crypto
```
POST /api/v1/payments/crypto-to-naira/calculate

Request:
{
  "crypto_token": "ETH",
  "naira_amount": 50000,
  "chain_id": 8453
}

Response:
{
  "crypto_amount": 0.025,
  "total_crypto_needed": 0.026,
  "gas_fee": 0.001,
  "exchange_rate": 2000000,
  "stablecoin": "USDC"
}
```

### Initialize Transaction
```
POST /api/v1/payments/crypto-to-naira/create

Request:
{
  "crypto_token": "ETH",
  "naira_amount": 50000,
  "recipient_bank_code": "011",
  "recipient_account_number": "1234567890",
  "recipient_account_name": "John Doe",
  "chain_id": 8453,
  "memo": "Payment for services"
}

Response:
{
  "transaction_id": "uuid-string",
  "status": "initiated",
  "crypto_amount": 0.025,
  "naira_amount": 50000,
  "exchange_rate": 2000000,
  "gas_fee": 0.001,
  "total_crypto_needed": 0.026,
  "estimated_settlement_time": 5
}
```

### Create UserOperation
```
POST /api/v1/payments/crypto-to-naira/user-operations/create

Request:
{
  "transaction_id": "uuid",
  "sender_address": "0x...",
  "call_data": "0x...",
  "chain_id": 8453
}

Response:
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

## Testing

### Manual Testing Flow

1. **Start backend server**:
```bash
cd backend
python manage.py runserver
# or
uvicorn config.asgi:application --reload
```

2. **Start frontend app**:
```bash
cd frontend
npm start
# or
expo start
```

3. **Test flow**:
   - Navigate to payment screen
   - Click "Send Crypto as Naira"
   - Enter amount: 5000 NGN
   - Select token: ETH
   - View calculation
   - Select bank: First Bank (011)
   - Enter account: 1234567890
   - Review transaction
   - Confirm and sign
   - Monitor status

### Common Test Values

```
Network: Base (chainId: 8453)
Amount: 5000 NGN
Crypto: ETH
Gas Fee: ~0.001 ETH
Exchange Rate: ~2,000,000 NGN/ETH

Bank: First Bank (011)
Account: 1234567890
Holder: John Doe
```

## Troubleshooting

### "Insufficient Balance"
- **Cause**: User doesn't have enough crypto
- **Fix**: Add more tokens to wallet
- **Check**: Use balance hook to verify

### "Invalid Bank Account"
- **Cause**: Account number doesn't match bank code or is invalid
- **Fix**: Verify account number and bank code
- **Check**: Use Paystack API to validate

### "UserOperation Rejected by Bundler"
- **Cause**: Signature invalid, gas prices too low, or nonce mismatch
- **Fix**: Retry with new gas prices
- **Check**: Verify signature generation

### "Swap Failed - Slippage"
- **Cause**: Token price moved > slippage tolerance
- **Fix**: Retry transaction
- **Check**: Adjust slippage tolerance if needed

### "Bank Transfer Timeout"
- **Cause**: Paystack API slow or bank processing
- **Fix**: Check status manually using reference
- **Check**: Retry after 5 minutes

## Performance Optimization

### Frontend
```typescript
// Use memoization for expensive calculations
const memoizedCrypto = useMemo(() => 
  calculateCryptoNeeded(nairaAmount, exchangeRate), 
  [nairaAmount, exchangeRate]
);

// Debounce API calls
const debouncedValidate = useMemo(
  () => debounce(validateBankAccount, 500),
  []
);

// Optimize re-renders
const BankItem = memo(({ bank, onSelect }) => {
  return <TouchableOpacity onPress={() => onSelect(bank)}>
    <Text>{bank.name}</Text>
  </TouchableOpacity>;
});
```

### Backend
```python
# Cache exchange rates
@cached(cache=TTLCache(maxsize=1000, ttl=300))
async def get_exchange_rate(token, currency):
    return await price_oracle.get_rate(token, currency)

# Batch database queries
transactions = Transaction.objects.select_related('user').filter(...)

# Use indexes on frequently queried fields
class Transaction(models.Model):
    transaction_id = models.UUIDField(db_index=True)
    user = models.ForeignKey(User, db_index=True)
    status = models.CharField(db_index=True)
```

## Security Best Practices

### Frontend
```typescript
// Never log private keys
console.log(privateKey);  // ❌ NEVER

// Use secure storage
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('private_key', encryptedKey);

// Validate all user inputs
const validationSchema = z.object({
  accountNumber: z.string().regex(/^\d{10}$/),
  nairaAmount: z.number().positive().max(1000000),
});
```

### Backend
```python
# Validate signatures
def verify_user_operation_signature(user_op, expected_sender):
    # Verify signature matches sender
    # Prevent signature reuse
    
# Rate limit transactions
@rate_limit("10/hour")  # 10 transactions per hour per user
async def create_transaction(request):
    ...

# Sanitize all inputs
from bleach import clean
account_name = clean(request.account_name, strip=True)
```

## Deployment Checklist

- [ ] Backend
  - [ ] Set production environment variables
  - [ ] Enable CORS for production domain
  - [ ] Configure database backups
  - [ ] Set up error logging (Sentry)
  - [ ] Configure rate limiting
  - [ ] Enable HTTPS/SSL
  - [ ] Test all endpoints

- [ ] Frontend
  - [ ] Update API base URL to production
  - [ ] Enable error tracking
  - [ ] Test on iOS and Android devices
  - [ ] Verify network security
  - [ ] Test all transaction flows
  - [ ] Performance profiling

- [ ] Payments
  - [ ] Update Paystack keys to live
  - [ ] Test bank transfers with real amounts
  - [ ] Configure webhooks
  - [ ] Test error scenarios

- [ ] Blockchain
  - [ ] Deploy smart contracts
  - [ ] Configure EntryPoint address
  - [ ] Set up bundler (Pimlico)
  - [ ] Test UserOperation submissions

## Support & Resources

- **Documentation**: See `CRYPTO_TO_NAIRA_IMPLEMENTATION.md`
- **Services**: All services fully typed with JSDoc comments
- **UI Components**: Built with React Native best practices
- **Backend**: FastAPI with async/await throughout

## Next Steps

1. **Run the app** - Start backend and frontend
2. **Test the flow** - Go through all transaction steps
3. **Verify endpoints** - Check API responses
4. **Monitor logs** - Watch for any errors
5. **Deploy** - Follow deployment checklist
6. **Monitor** - Set up error tracking and analytics

---

**The entire crypto-to-naira system is now ready for integration. All frontend screens, backend endpoints, and services are implemented and documented.**
