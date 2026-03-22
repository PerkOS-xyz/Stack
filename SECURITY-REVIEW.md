# PerkOS Stack Security Review

**Date:** 2026-03-09  
**Branch:** `main`  
**Reviewer:** Automated Security Audit  
**Scope:** `StackApp/` — Next.js API routes, middleware, config, secrets, dependencies

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 5 |
| MEDIUM | 5 |
| LOW | 4 |
| INFO | 3 |

---

## CRITICAL

### C1: Admin Endpoints Authenticate via Self-Reported Query Parameter (Auth Bypass)

**Files:** All `app/api/admin/*/route.ts` (vendors, invoices, agents, cleanup, coupons, transactions, users, wallets, stats, performance, subscriptions, verify)

**Description:** Every admin endpoint authenticates by accepting an `address` query parameter and checking it against `ADMIN_WALLETS`. There is **no cryptographic verification** (no signature, no session token, no JWT). Any attacker who knows or guesses an admin wallet address can call:

```
GET /api/admin/vendors?address=0xADMIN_WALLET_HERE
POST /api/admin/cleanup?address=0xADMIN_WALLET_HERE
```

And gain full admin access. Admin wallet addresses are often publicly visible on-chain.

**Risk:** Complete admin panel bypass. Attacker can list all users, vendors, wallets, subscriptions, coupons, modify data, run cleanup operations.

**Fix:** Require a signed message (EIP-191/EIP-712) proving ownership of the admin wallet, similar to how `POST /api/v2/agents/register` already does it. Or use session-based auth (JWT from wallet connect).

---

### C2: Sponsor Wallet Send Endpoint Has No Authentication

**File:** `app/api/sponsor/wallets/send/route.ts`

**Description:** The `POST /api/sponsor/wallets/send` endpoint accepts `{ walletId, toAddress, amount, network }` and sends native tokens from a server-controlled sponsor wallet. There is **no authentication whatsoever** — no wallet signature, no session, no API key. Anyone who knows or brute-forces a `walletId` (UUID) can drain sponsor wallet funds.

**Risk:** Theft of all funds in sponsor wallets. The endpoint uses server-side signing (Para wallet), so the server executes the transfer immediately.

**Fix:** Require proof of ownership — verify the caller is the `user_wallet_address` associated with the wallet via signed message. At minimum, check `body.userWalletAddress` matches `wallet.user_wallet_address` (though this is still spoofable without signatures).

---

## HIGH

### H1: Sponsor Wallet Management Endpoints Lack Auth

**File:** `app/api/sponsor/wallets/route.ts`

**Description:** `GET /api/sponsor/wallets?address=0x...` returns all sponsor wallets for any address (including `para_wallet_id`). `POST` creates wallets, `DELETE` removes them — all with only a self-reported `userWalletAddress` in the body, no signature verification.

**Risk:** Information disclosure (wallet IDs needed for C2), unauthorized wallet creation/deletion.

**Fix:** Require wallet signature verification for all mutating operations. For GET, ensure returned data doesn't include sensitive fields like `para_wallet_id` or `para_user_share`.

---

### H2: CORS Allows All Origins for Sensitive Payment Endpoints

**File:** `lib/utils/cors.ts`

**Description:** `Access-Control-Allow-Origin: *` is applied globally to all API routes including settle, verify, admin, and sponsor wallet endpoints.

**Risk:** Any malicious website can make authenticated requests to these endpoints from a user's browser if cookies/sessions are ever added.

**Fix:** For x402 payment endpoints (verify/settle), wildcard CORS may be intentional (public protocol). But admin and sponsor endpoints should restrict origins to the app's domain only.

---

### H3: No Input Validation on Most `req.json()` Calls

**Files:** ~28 endpoints parse `req.json()` without schema validation

**Description:** Most endpoints destructure the JSON body and use values directly in database queries and contract calls without type/schema validation (no zod, joi, etc.). Examples:
- `app/api/subscription/pay/route.ts` — payment amounts used without validation
- `app/api/sponsor/wallets/route.ts` — `userWalletAddress` used directly in DB queries  
- `app/api/admin/coupons/route.ts` — coupon data inserted without sanitization

**Risk:** Type confusion, NoSQL injection patterns (if Firestore/Supabase supports operators), unexpected behavior from malformed input.

**Fix:** Add input validation with zod or similar. At minimum, validate types and formats for all user-supplied values.

---

### H4: No Rate Limiting on Public Endpoints

**Description:** While the API key middleware has rate limiting, public endpoints have none:
- `/verify` and `/settle` (root-level x402 endpoints)
- `/api/v2/x402/verify` and `/api/v2/x402/settle`
- `/api/contact` (email sending)
- `/api/ens` (ENS resolution)
- `/api/erc8004/*` (contract reads)
- All admin endpoints (compounding C1)

**Risk:** DoS via spamming expensive RPC calls, email bombing via contact endpoint, resource exhaustion.

**Fix:** Add rate limiting middleware (e.g., `@upstash/ratelimit` or Vercel's edge rate limiting). The contact/email endpoint is especially urgent.

---

### H5: `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` Are Enabled

**File:** `next.config.mjs`

**Description:** Both TypeScript and ESLint errors are suppressed during builds. This means type errors (which could indicate security issues like wrong types being passed to auth functions) are silently ignored.

**Risk:** Security-relevant type errors ship to production undetected.

**Fix:** Fix existing type errors and re-enable strict builds. At minimum, run `tsc --noEmit` in CI as a gate.

---

## MEDIUM

### M1: Private Key in `.env.local` with Placeholder Pattern

**File:** `StackApp/.env.local` line 2

**Description:** `PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000` — while this is a zero key (placeholder), the `.env.local` file is gitignored and not committed. However, the pattern of having a raw private key in env vars means production likely has a real key there. If Vercel env vars are ever leaked, the facilitator wallet is compromised.

**Risk:** Single point of failure for facilitator operations if env vars leak.

**Fix:** Consider using a KMS (AWS KMS, GCP KMS) or a vault service for the facilitator private key instead of raw env vars.

---

### M2: No Next.js Middleware for Route Protection

**Description:** There is no `middleware.ts` at the app root. All authentication is handled per-route. This means it's easy to add new admin/sponsor routes and forget to add auth checks.

**Fix:** Add a Next.js middleware that enforces authentication for `/api/admin/*` and `/api/sponsor/*` routes centrally.

---

### M3: Health Endpoint May Expose Infrastructure Details

**File:** `app/api/v2/x402/health/route.ts`

**Description:** The health endpoint returns database status, network health, uptime, configured endpoints, and capability details. While useful for monitoring, this is publicly accessible and provides an attacker with a map of the system.

**Fix:** Add basic auth or API key requirement for detailed health info. Return only `{ status: "ok" }` publicly.

---

### M4: `console.log` Statements Log Potentially Sensitive Data

**Files:** Multiple API routes

**Description:** While `next.config.mjs` strips console.log in production (keeping only error/warn), several routes use `console.log` for:
- Wallet IDs and sponsor addresses (`sponsor/wallets/send/route.ts:92`)
- Payment payload details (`v2/x402/settle/route.ts:85-86`)
- Chain configurations

In development or if the compiler setting is changed, these would log sensitive operational data.

**Risk:** Low in production (stripped), medium in development/staging.

**Fix:** Use structured logging with log levels. Ensure sensitive fields are redacted.

---

### M5: `README.md` Contains Secret Key Placeholders That Look Real

**File:** `StackApp/README.md:134`

**Description:** `THIRDWEB_SECRET_KEY=your-secret-key` and references to `encrypted_private_key` in schema docs. While these are placeholders, they establish patterns that could lead to accidental real secret commits.

**Risk:** Low — informational, but sets bad documentation patterns.

**Fix:** Use clearly fake values like `THIRDWEB_SECRET_KEY=<YOUR_THIRDWEB_SECRET_KEY>`.

---

## LOW

### L1: No Security Headers Configuration

**Description:** No CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers are configured. Next.js provides some defaults but explicit configuration is best practice.

**Fix:** Add security headers in `next.config.mjs` or middleware:
```js
headers: [{ key: 'X-Frame-Options', value: 'DENY' }, ...]
```

---

### L2: Duplicate Root-Level and V2 Endpoints

**Files:** `app/verify/route.ts`, `app/settle/route.ts` + `app/api/v2/x402/verify/route.ts`, `app/api/v2/x402/settle/route.ts`

**Description:** The root `/verify` and `/settle` routes duplicate V2 logic for backward compatibility. Double the attack surface, double the maintenance burden.

**Fix:** Have root routes proxy to V2 routes to maintain single implementation.

---

### L3: `generateRequestId` Uses `Math.random()` in Root Endpoints

**Files:** `app/verify/route.ts:14`, `app/settle/route.ts:14`

**Description:** `Math.random().toString(36).substring(7)` is not cryptographically random and produces short, predictable IDs. The V2 endpoints use a proper `generateRequestId()` from utils.

**Fix:** Use `crypto.randomUUID()` consistently.

---

### L4: Error Responses Sometimes Leak Internal Details

**Description:** Some catch blocks return `error.message` directly:
- `app/api/v2/x402/settle/route.ts` returns raw error messages
- Various endpoints return Firestore error details

**Fix:** Return generic error messages to clients; log details server-side only.

---

## INFO

### I1: `.env.local` Is Properly Gitignored

The `.gitignore` correctly excludes `.env`, `.env.local`, and all `.env*.local` variants. No env files are committed to the repository. Only `.env.example` files exist in git with placeholder values. ✅

### I2: API Key Auth Middleware Is Well-Implemented

`lib/middleware/apiKeyAuth.ts` uses SHA-256 hashing, rate limiting, scope-based authorization, and proper key format validation. The issue is that it's only used by V2 agent endpoints, not admin/sponsor endpoints. ✅

### I3: Agent Registration Uses Proper Signature Verification

`app/api/v2/agents/register/route.ts` correctly verifies EIP-191 signatures before issuing API keys. This pattern should be extended to admin and sponsor endpoints. ✅

---

## Priority Action Items

1. **🚨 IMMEDIATE:** Fix admin auth bypass (C1) — require wallet signatures
2. **🚨 IMMEDIATE:** Fix sponsor wallet send auth (C2) — require wallet signatures
3. **ASAP:** Add auth to all sponsor wallet endpoints (H1)
4. **ASAP:** Restrict CORS for admin/sponsor routes (H2)
5. **Soon:** Add input validation schemas (H3)
6. **Soon:** Add rate limiting to public endpoints (H4)
7. **Soon:** Add central middleware for route protection (M2)
