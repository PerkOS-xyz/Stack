# Payment Envelope Execution Flow

Complete analysis of how the x402 facilitator processes and executes payment envelopes according to the x402 standard.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Layers](#architecture-layers)
3. [Exact Scheme (EIP-3009) Flow](#exact-scheme-eip-3009-flow)
4. [Deferred Scheme (EIP-712) Flow](#deferred-scheme-eip-712-flow)
5. [Security Considerations](#security-considerations)
6. [Error Handling](#error-handling)

---

## Overview

The x402 facilitator processes payment envelopes through a layered architecture:

```
API Layer (HTTP)
    ↓
Orchestration Layer (X402Service)
    ↓
Scheme Layer (ExactSchemeService | DeferredSchemeService)
    ↓
Blockchain Layer (viem + smart contracts)
```

**Two Payment Schemes**:
- **Exact Scheme**: Immediate on-chain settlement using EIP-3009 (transferWithAuthorization)
- **Deferred Scheme**: Two-phase settlement using EIP-712 (voucher storage + claim)

---

## Architecture Layers

### Layer 1: API Endpoints

**Location**: `app/api/v2/x402/`

#### `/verify` - Payment Verification
```typescript
// app/api/v2/x402/verify/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json() as X402VerifyRequest;
  const result = await x402Service.verify(body);

  if (!result.isValid) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
```

**Input**: X402VerifyRequest
```typescript
{
  x402Version: 1,
  paymentPayload: {
    x402Version: 1,
    scheme: "exact" | "deferred",
    network: "avalanche" | "base" | "celo",
    payload: ExactPayload | DeferredPayload
  },
  paymentRequirements: {
    scheme: "exact" | "deferred",
    network: "avalanche",
    maxAmountRequired: "1000000", // 1 USDC
    resource: "/api/data",
    payTo: "0x...",
    maxTimeoutSeconds: 3600,
    asset: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" // USDC
  }
}
```

**Output**: VerifyResponse
```typescript
{
  isValid: true,
  invalidReason: null,
  payer: "0x..." // buyer address
}
```

#### `/settle` - Payment Settlement
```typescript
// app/api/v2/x402/settle/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json() as X402SettleRequest;
  const result = await x402Service.settle(body);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
```

**Output**: SettleResponse
```typescript
{
  success: true,
  error: null,
  payer: "0x...",
  transaction: "0x...", // tx hash (exact) or null (deferred)
  network: "avalanche"
}
```

---

### Layer 2: Orchestration Service

**Location**: `lib/services/X402Service.ts`

**Responsibilities**:
- Validate x402 protocol compliance
- Route requests to appropriate scheme handler
- Manage multi-network support

#### Core Validation Logic

```typescript
async verify(request: X402VerifyRequest): Promise<VerifyResponse> {
  const { paymentPayload, paymentRequirements } = request;

  // 1. Validate x402 version (must be 1)
  if (request.x402Version !== 1 || paymentPayload.x402Version !== 1) {
    return {
      isValid: false,
      invalidReason: "Unsupported x402 version",
      payer: null,
    };
  }

  // 2. Validate network support
  const network = paymentPayload.network as SupportedNetwork;
  if (!this.exactSchemes.has(network) && !this.deferredSchemes.has(network)) {
    return {
      isValid: false,
      invalidReason: `Unsupported network: ${paymentPayload.network}`,
      payer: null,
    };
  }

  // 3. Validate scheme consistency
  if (paymentPayload.scheme !== paymentRequirements.scheme) {
    return {
      isValid: false,
      invalidReason: "Scheme mismatch between payload and requirements",
      payer: null,
    };
  }

  // 4. Route to scheme-specific handler
  if (paymentPayload.scheme === "exact") {
    const exactScheme = this.exactSchemes.get(network);
    return exactScheme.verify(paymentPayload.payload, paymentRequirements);
  } else if (paymentPayload.scheme === "deferred") {
    const deferredScheme = this.deferredSchemes.get(network);
    return deferredScheme.verify(paymentPayload.payload, paymentRequirements);
  }
}
```

**Key Features**:
- Per-network scheme instances (one ExactSchemeService per network)
- Scheme-agnostic validation at orchestration layer
- Clean separation between protocol logic and scheme implementation

---

## Exact Scheme (EIP-3009) Flow

**Location**: `lib/services/ExactSchemeService.ts`

**Protocol**: Immediate on-chain settlement using USDC's `transferWithAuthorization`

### Verification Flow

```typescript
async verify(payload: ExactPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
  const { signature, authorization } = payload;

  // 1. Validate authorization fields
  if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return { isValid: false, invalidReason: "Incorrect recipient", payer: null };
  }

  if (BigInt(authorization.value) < BigInt(requirements.maxAmountRequired)) {
    return { isValid: false, invalidReason: "Insufficient amount", payer: null };
  }

  // 2. Recover signer from EIP-712 signature
  const signer = await this.recoverSigner(authorization, signature, requirements.asset);

  // 3. Verify signer matches 'from' address
  if (signer.toLowerCase() !== authorization.from.toLowerCase()) {
    return { isValid: false, invalidReason: "Invalid signature", payer: null };
  }

  // 4. Check token balance
  const hasBalance = await this.checkBalance(
    authorization.from,
    authorization.value,
    requirements.asset
  );

  if (!hasBalance) {
    return { isValid: false, invalidReason: "Insufficient balance", payer: null };
  }

  // 5. Verify timing constraints
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < BigInt(authorization.validAfter)) {
    return { isValid: false, invalidReason: "Authorization not yet valid", payer: null };
  }

  if (now > BigInt(authorization.validBefore)) {
    return { isValid: false, invalidReason: "Authorization expired", payer: null };
  }

  return { isValid: true, invalidReason: null, payer: authorization.from };
}
```

**Verification Steps**:
1. ✅ Validate recipient matches payTo
2. ✅ Validate amount ≥ maxAmountRequired
3. ✅ Recover signer using EIP-712 typed data
4. ✅ Verify signer === from address
5. ✅ Check USDC balance ≥ value
6. ✅ Verify validAfter ≤ now ≤ validBefore

### Settlement Flow

```typescript
async settle(payload: ExactPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
  // 1. First verify payment
  const verifyResult = await this.verify(payload, requirements);
  if (!verifyResult.isValid) {
    return {
      success: false,
      error: verifyResult.invalidReason,
      payer: null,
      transaction: null,
      network: this.network,
    };
  }

  const { authorization, signature } = payload;

  // 2. Parse signature into v, r, s components
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
  const r = `0x${sig.slice(0, 64)}`;
  const s = `0x${sig.slice(64, 128)}`;
  const v = parseInt(sig.slice(128, 130), 16);

  // 3. Call USDC transferWithAuthorization on-chain
  const hash = await this.walletClient.writeContract({
    address: requirements.asset,
    abi: TRANSFER_WITH_AUTHORIZATION_ABI,
    functionName: "transferWithAuthorization",
    args: [
      authorization.from,
      authorization.to,
      BigInt(authorization.value),
      BigInt(authorization.validAfter),
      BigInt(authorization.validBefore),
      authorization.nonce,
      v,
      r,
      s,
    ],
  });

  // 4. Wait for transaction receipt
  const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "success") {
    logger.info("Exact scheme payment settled", {
      from: authorization.from,
      to: authorization.to,
      value: authorization.value,
      txHash: hash,
    });

    return {
      success: true,
      error: null,
      payer: authorization.from,
      transaction: hash,
      network: this.network,
    };
  } else {
    return {
      success: false,
      error: "Transaction reverted",
      payer: authorization.from,
      transaction: hash,
      network: this.network,
    };
  }
}
```

**Settlement Steps**:
1. ✅ Re-verify payment (safety check)
2. ✅ Parse signature into (v, r, s) components
3. ⛓️ Submit `transferWithAuthorization` transaction to blockchain
4. ⏳ Wait for transaction confirmation
5. ✅ Return transaction hash on success

**EIP-712 Domain & Types**:
```typescript
const domain = {
  name: "USD Coin",
  version: "2",
  chainId: Number(chainId),
  verifyingContract: assetAddress,
};

const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};
```

---

## Deferred Scheme (EIP-712) Flow

**Location**: `lib/services/DeferredSchemeService.ts`

**Protocol**: Two-phase settlement with voucher storage + on-chain claim

### Phase 1: Verification & Storage

```typescript
async verify(payload: DeferredPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
  const { voucher, signature } = payload;

  // 1. Validate voucher fields
  if (!this.validateVoucher(voucher, requirements)) {
    return { isValid: false, invalidReason: "Voucher fields invalid", payer: null };
  }

  // 2. Verify EIP-712 signature
  const signer = await this.recoverSigner(voucher, signature);

  // 3. Verify signer matches buyer
  if (signer.toLowerCase() !== voucher.buyer.toLowerCase()) {
    return { isValid: false, invalidReason: "Signer does not match buyer", payer: null };
  }

  // 4. Check if already claimed
  const claimed = await this.isVoucherClaimed(voucher.id, BigInt(voucher.nonce));
  if (claimed) {
    return { isValid: false, invalidReason: "Voucher already claimed", payer: null };
  }

  // 5. Check escrow balance
  const balance = await this.getEscrowBalance(
    voucher.buyer,
    voucher.seller,
    voucher.asset
  );

  if (balance < BigInt(voucher.valueAggregate)) {
    return { isValid: false, invalidReason: "Insufficient escrow balance", payer: null };
  }

  return { isValid: true, invalidReason: null, payer: voucher.buyer };
}
```

**Verification Steps**:
1. ✅ Validate escrow address, chainId, seller, amount, asset
2. ✅ Recover signer using EIP-712 typed data
3. ✅ Verify signer === buyer address
4. ✅ Check voucher not already claimed on-chain
5. ✅ Check escrow balance ≥ valueAggregate

**Voucher Storage**:
```typescript
async settle(payload: DeferredPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
  // First verify
  const verifyResult = await this.verify(payload, requirements);
  if (!verifyResult.isValid) {
    return {
      success: false,
      error: verifyResult.invalidReason,
      payer: null,
      transaction: null,
      network: this.network,
    };
  }

  const { voucher, signature } = payload;

  // Store voucher in memory (or database in production)
  const storedVoucher: StoredVoucher = {
    id: voucher.id,
    voucher,
    signature,
    buyer: voucher.buyer,
    seller: voucher.seller,
    asset: voucher.asset,
    nonce: BigInt(voucher.nonce),
    valueAggregate: BigInt(voucher.valueAggregate),
    timestamp: BigInt(voucher.timestamp),
    settled: false, // Not yet claimed on-chain
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  this.voucherStore.set(key, storedVoucher);

  return {
    success: true,
    error: null,
    payer: voucher.buyer,
    transaction: null, // No tx yet - just stored
    network: this.network,
  };
}
```

**Storage Step**:
- 💾 Store voucher + signature in facilitator database (or in-memory Map)
- ⚠️ No on-chain transaction yet
- ✅ Return success immediately

### Phase 2: On-Chain Claim

```typescript
async claimVoucher(voucherId: Hex, nonce: bigint): Promise<SettleResponse> {
  // Retrieve stored voucher
  const storedVoucher = this.voucherStore.get(key);

  if (!storedVoucher) {
    return { success: false, error: "Voucher not found", ... };
  }

  if (storedVoucher.settled) {
    return { success: false, error: "Voucher already settled", ... };
  }

  // Prepare voucher tuple for contract call
  const voucherTuple = {
    id: storedVoucher.voucher.id,
    buyer: storedVoucher.voucher.buyer,
    seller: storedVoucher.voucher.seller,
    valueAggregate: BigInt(storedVoucher.voucher.valueAggregate),
    asset: storedVoucher.voucher.asset,
    timestamp: BigInt(storedVoucher.voucher.timestamp),
    nonce: BigInt(storedVoucher.voucher.nonce),
    escrow: storedVoucher.voucher.escrow,
    chainId: BigInt(storedVoucher.voucher.chainId),
  };

  // Call claimVoucher on escrow contract
  const hash = await this.walletClient.writeContract({
    address: this.escrowAddress,
    abi: ESCROW_ABI,
    functionName: "claimVoucher",
    args: [voucherTuple, storedVoucher.signature],
  });

  // Wait for confirmation
  const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "success") {
    // Mark as settled
    storedVoucher.settled = true;
    storedVoucher.settledTxHash = hash;
    this.voucherStore.set(key, storedVoucher);

    return {
      success: true,
      error: null,
      payer: storedVoucher.buyer,
      transaction: hash,
      network: this.network,
    };
  }
}
```

**Claim Steps**:
1. 📦 Retrieve stored voucher from database
2. ✅ Verify not already settled
3. ⛓️ Submit `claimVoucher(voucher, signature)` to escrow contract
4. ⏳ Wait for transaction confirmation
5. 💾 Mark voucher as settled in database
6. ✅ Return transaction hash

**EIP-712 Domain & Types**:
```typescript
const domain = {
  name: "X402DeferredEscrow",
  version: "1",
  chainId: Number(voucher.chainId),
  verifyingContract: escrowAddress,
};

const types = {
  Voucher: [
    { name: "id", type: "bytes32" },
    { name: "buyer", type: "address" },
    { name: "seller", type: "address" },
    { name: "valueAggregate", type: "uint256" },
    { name: "asset", type: "address" },
    { name: "timestamp", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "escrow", type: "address" },
    { name: "chainId", type: "uint256" },
  ],
};
```

---

## Security Considerations

### 1. Signature Verification

**Exact Scheme**:
```typescript
// Recover signer from EIP-712 signature
const domain = {
  name: "USD Coin",
  version: "2",
  chainId: Number(chainId),
  verifyingContract: assetAddress,
};

const recoveredAddress = await recoverTypedDataAddress({
  domain,
  types: { TransferWithAuthorization: [...] },
  primaryType: "TransferWithAuthorization",
  message: authorization,
  signature,
});

// MUST match 'from' address
if (recoveredAddress.toLowerCase() !== authorization.from.toLowerCase()) {
  throw new Error("Invalid signature");
}
```

**Deferred Scheme**:
```typescript
// Recover signer from EIP-712 voucher signature
const recoveredAddress = await recoverTypedDataAddress({
  domain: {
    name: "X402DeferredEscrow",
    version: "1",
    chainId: Number(voucher.chainId),
    verifyingContract: escrowAddress,
  },
  types: { Voucher: [...] },
  primaryType: "Voucher",
  message: voucher,
  signature,
});

// MUST match buyer address
if (recoveredAddress.toLowerCase() !== voucher.buyer.toLowerCase()) {
  throw new Error("Invalid signature");
}
```

### 2. Balance Verification

**Exact Scheme** - Check USDC balance:
```typescript
const balance = await this.publicClient.readContract({
  address: assetAddress,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [fromAddress],
});

if (balance < BigInt(value)) {
  return { isValid: false, invalidReason: "Insufficient balance", ... };
}
```

**Deferred Scheme** - Check escrow balance:
```typescript
const balance = await this.publicClient.readContract({
  address: escrowAddress,
  abi: ESCROW_ABI,
  functionName: "getAvailableBalance",
  args: [buyer, seller, asset],
});

if (balance < BigInt(valueAggregate)) {
  return { isValid: false, invalidReason: "Insufficient escrow balance", ... };
}
```

### 3. Replay Protection

**Exact Scheme**:
- EIP-3009 uses unique `nonce` (bytes32 random value)
- USDC contract prevents reusing same nonce

**Deferred Scheme**:
- Voucher ID + nonce combination must be unique
- Check `voucherClaimed(voucherId, nonce)` on escrow contract
- Prevents double-spending of same voucher

### 4. Timing Constraints

**Exact Scheme** - validAfter/validBefore:
```typescript
const now = BigInt(Math.floor(Date.now() / 1000));

if (now < BigInt(authorization.validAfter)) {
  return { isValid: false, invalidReason: "Authorization not yet valid", ... };
}

if (now > BigInt(authorization.validBefore)) {
  return { isValid: false, invalidReason: "Authorization expired", ... };
}
```

**Deferred Scheme** - No hard timing constraints, but:
- Voucher can be claimed any time if escrow has balance
- Facilitator can implement custom timeout logic

### 5. Amount Validation

**Both schemes verify amount ≥ required**:
```typescript
// Exact
if (BigInt(authorization.value) < BigInt(requirements.maxAmountRequired)) {
  return { isValid: false, invalidReason: "Insufficient amount", ... };
}

// Deferred
if (BigInt(voucher.valueAggregate) > BigInt(requirements.maxAmountRequired)) {
  return { isValid: false, invalidReason: "Amount exceeds maximum", ... };
}
```

### 6. Network & Chain Validation

**Deferred scheme validates chain ID**:
```typescript
const expectedChainId = this.getChainIdForNetwork(this.network);

if (BigInt(voucher.chainId) !== BigInt(expectedChainId)) {
  return { isValid: false, invalidReason: "Chain ID mismatch", ... };
}
```

---

## Error Handling

### API Layer Errors

```typescript
try {
  const body = await request.json() as X402VerifyRequest;
  const result = await x402Service.verify(body);

  if (!result.isValid) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
} catch (error) {
  return NextResponse.json(
    {
      isValid: false,
      invalidReason: error instanceof Error ? error.message : "Verification failed",
      payer: null,
    },
    { status: 400 }
  );
}
```

### Orchestration Layer Errors

**X402Service validates**:
- ❌ x402Version !== 1 → "Unsupported x402 version"
- ❌ Unsupported network → "Unsupported network: {network}"
- ❌ Scheme mismatch → "Scheme mismatch between payload and requirements"

### Scheme Layer Errors

**ExactSchemeService**:
- ❌ Wrong recipient → "Incorrect recipient"
- ❌ Insufficient amount → "Insufficient amount"
- ❌ Invalid signature → "Invalid signature"
- ❌ Insufficient balance → "Insufficient balance"
- ❌ Timing violation → "Authorization not yet valid" | "Authorization expired"
- ❌ Transaction reverted → "Transaction reverted"

**DeferredSchemeService**:
- ❌ Invalid voucher fields → "Voucher fields invalid"
- ❌ Invalid signature → "Invalid signature"
- ❌ Signer mismatch → "Signer does not match buyer"
- ❌ Already claimed → "Voucher already claimed"
- ❌ Insufficient escrow → "Insufficient escrow balance"
- ❌ Voucher not found → "Voucher not found"
- ❌ Already settled → "Voucher already settled"

### Blockchain Layer Errors

**Transaction failures**:
```typescript
const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

if (receipt.status === "success") {
  return { success: true, transaction: hash, ... };
} else {
  return { success: false, error: "Transaction reverted", ... };
}
```

**Network errors** - wrapped with try/catch:
```typescript
try {
  const balance = await this.publicClient.readContract({...});
  return balance;
} catch (error) {
  logger.error("Error getting balance", { error });
  return 0n;
}
```

---

## Flow Diagrams

### Exact Scheme Complete Flow

```
User                    API                 X402Service          ExactScheme         Blockchain
  |                      |                       |                    |                   |
  |-- POST /verify ----->|                       |                    |                   |
  |                      |-- verify() ---------->|                    |                   |
  |                      |                       |-- validate x402 -->|                   |
  |                      |                       |                    |                   |
  |                      |                       |-- verify(payload)->|                   |
  |                      |                       |                    |-- validate fields |
  |                      |                       |                    |-- recover signer  |
  |                      |                       |                    |-- verify signer   |
  |                      |                       |                    |-- check balance ->|
  |                      |                       |                    |<-- balance -------|
  |                      |                       |                    |-- verify timing   |
  |                      |                       |<-- VerifyResponse--|                   |
  |                      |<-- VerifyResponse ----|                    |                   |
  |<-- 200 OK -----------|                       |                    |                   |
  |                      |                       |                    |                   |
  |-- POST /settle ----->|                       |                    |                   |
  |                      |-- settle() ---------->|                    |                   |
  |                      |                       |-- settle(payload)->|                   |
  |                      |                       |                    |-- re-verify ------|
  |                      |                       |                    |-- parse sig       |
  |                      |                       |                    |-- writeContract ->|
  |                      |                       |                    |<-- tx hash -------|
  |                      |                       |                    |-- waitForReceipt->|
  |                      |                       |                    |<-- receipt -------|
  |                      |                       |<-- SettleResponse--|                   |
  |                      |<-- SettleResponse ----|                    |                   |
  |<-- 200 OK -----------|                       |                    |                   |
```

### Deferred Scheme Complete Flow

```
User                    API                 X402Service       DeferredScheme        Escrow         Database
  |                      |                       |                 |                  |                |
  |-- POST /verify ----->|                       |                 |                  |                |
  |                      |-- verify() ---------->|                 |                  |                |
  |                      |                       |-- verify() ---->|                  |                |
  |                      |                       |                 |-- validate fields|                |
  |                      |                       |                 |-- recover signer |                |
  |                      |                       |                 |-- verify signer  |                |
  |                      |                       |                 |-- voucherClaimed->|                |
  |                      |                       |                 |<-- false ---------|                |
  |                      |                       |                 |-- getBalance ---->|                |
  |                      |                       |                 |<-- balance -------|                |
  |                      |                       |<-- VerifyResponse|                  |                |
  |                      |<-- VerifyResponse ----|                 |                  |                |
  |<-- 200 OK -----------|                       |                 |                  |                |
  |                      |                       |                 |                  |                |
  |-- POST /settle ----->|                       |                 |                  |                |
  |                      |-- settle() ---------->|                 |                  |                |
  |                      |                       |-- settle() ---->|                  |                |
  |                      |                       |                 |-- re-verify ------|                |
  |                      |                       |                 |-- store voucher ->|                |
  |                      |                       |                 |                  |                |-- INSERT
  |                      |                       |<-- SettleResponse|                  |                |
  |                      |<-- SettleResponse ----|                 |                  |                |
  |<-- 200 OK -----------|                       |                 |                  |                |
  |   (no tx hash)       |                       |                 |                  |                |
  |                      |                       |                 |                  |                |
  |                      |                       |                 |                  |                |
  [Later: Facilitator claims voucher]           |                 |                  |                |
                                                 |                 |                  |                |
Facilitator                                      |                 |                  |                |
  |                                              |                 |                  |                |
  |-- claimVoucher(id, nonce) ---------------------------------------->|                |                |
  |                                              |                 |-- get voucher -->|                |
  |                                              |                 |                  |                |-- SELECT
  |                                              |                 |<-- voucher ------|                |
  |                                              |                 |-- claimVoucher -->|                |
  |                                              |                 |<-- tx hash -------|                |
  |                                              |                 |-- waitForReceipt->|                |
  |                                              |                 |<-- receipt -------|                |
  |                                              |                 |-- mark settled -->|                |
  |                                              |                 |                  |                |-- UPDATE
  |<-- SettleResponse (with tx hash) -----------------------------|                  |                |
```

---

## Summary

### Exact Scheme Characteristics
- ✅ **Immediate Settlement**: One-step on-chain transaction
- ✅ **No Storage Required**: Stateless verification and settlement
- ✅ **Direct Transfer**: Uses USDC's native `transferWithAuthorization`
- ⚠️ **Higher Gas Cost**: On-chain tx for each payment
- ✅ **Instant Finality**: Transaction confirmed = payment complete

### Deferred Scheme Characteristics
- ✅ **Two-Phase Settlement**: Verify/store → claim later
- 💾 **Storage Required**: Vouchers stored in facilitator database
- ✅ **Batch Claiming**: Multiple vouchers can be claimed together
- ✅ **Lower Gas for Users**: User only signs, facilitator pays gas
- ⚠️ **Delayed Finality**: Payment complete only after claim transaction

### Key Takeaways

1. **Layered Architecture**: API → Orchestration → Scheme → Blockchain
2. **Scheme Isolation**: Each payment scheme has independent implementation
3. **Security First**: Signature verification, balance checks, replay protection
4. **Multi-Network**: Same logic across Avalanche, Base, Celo
5. **Production Ready**: Comprehensive error handling, logging, event indexing

---

## Related Documentation

- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Database setup for voucher storage
- [DATABASE_TABLES.md](DATABASE_TABLES.md) - Table schemas (perkos_vouchers)
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Production deployment steps
- [ERC-8004 Standard](../app/api/.well-known/erc-8004.json/route.ts) - Agent discovery
