# Firebase Collection Structure: Vendor Analytics & Rate Limiting

This document describes the Firestore collection structure for the vendor analytics and rate limiting system. These collections are used by the services: `VendorOwnershipService`, `RateLimitService`, and `UsageAggregationService`.

---

## Collection: `perkos_user_vendor_domains`

Associates vendor domains with user accounts via sponsor wallets. Users can claim ownership of vendor domains and manage rate limits.

### Document Structure

```typescript
interface UserVendorDomain {
  id: string;                           // Auto-generated document ID

  // User ownership (links to sponsor wallet)
  user_wallet_address: string;          // Wallet address (lowercase)
  sponsor_wallet_id: string;            // References perkos_sponsor_wallets

  // Domain association
  domain_url: string;                   // e.g., "api.myservice.com"
  vendor_id: string | null;             // References perkos_vendors (optional)

  // Verification (supports DNS TXT, meta tag, file upload)
  verification_status: 'pending' | 'verified' | 'failed' | 'expired';
  verification_method: 'dns_txt' | 'meta_tag' | 'file_upload' | null;
  verification_token: string;           // Token user must place for verification
  verification_attempts: number;        // Default: 0
  last_verification_at: string | null;  // ISO timestamp
  verified_at: string | null;           // ISO timestamp
  verification_expires_at: string | null; // Token expiry (24 hours)

  // Rate limits (null = use subscription tier default)
  custom_requests_per_minute: number | null;
  custom_requests_per_hour: number | null;
  custom_requests_per_day: number | null;

  // Status
  is_active: boolean;                   // Default: true
  notes: string | null;                 // Admin notes
  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
}
```

### Indexes Required

Create composite indexes in Firebase Console or via `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "perkos_user_vendor_domains",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_wallet_address", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "perkos_user_vendor_domains",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "domain_url", "order": "ASCENDING" },
        { "fieldPath": "verification_status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "perkos_user_vendor_domains",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sponsor_wallet_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Uniqueness Constraints

Firebase doesn't enforce uniqueness at the database level. Enforce in application code:
- `(user_wallet_address, domain_url)` - One claim per user per domain
- `domain_url` - One owner per domain globally

---

## Collection: `perkos_endpoint_usage`

Real-time request tracking for rate limiting. Uses sliding window approach with minute/hour/day granularity.

### Document Structure

```typescript
interface EndpointUsage {
  id: string;                           // Auto-generated document ID

  // What was called
  vendor_id: string | null;             // References perkos_vendors
  endpoint_id: string | null;           // References perkos_vendor_endpoints
  domain_url: string;
  endpoint_path: string;
  http_method: string;                  // Default: 'POST'

  // Who called it
  caller_address: string;               // Wallet that made the request (empty string if unknown)

  // Request tracking (for rate limiting)
  request_count: number;                // Default: 1
  window_start: string;                 // ISO timestamp - start of time window
  window_type: 'minute' | 'hour' | 'day';

  // Response tracking
  success_count: number;                // Default: 0
  error_count: number;                  // Default: 0
  total_latency_ms: number;             // Sum for avg calculation

  // Volume tracking
  total_amount_usd: number;             // Default: 0

  created_at: string;                   // ISO timestamp
}
```

### Indexes Required

```json
{
  "indexes": [
    {
      "collectionGroup": "perkos_endpoint_usage",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "domain_url", "order": "ASCENDING" },
        { "fieldPath": "window_type", "order": "ASCENDING" },
        { "fieldPath": "window_start", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "perkos_endpoint_usage",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "domain_url", "order": "ASCENDING" },
        { "fieldPath": "endpoint_path", "order": "ASCENDING" },
        { "fieldPath": "window_type", "order": "ASCENDING" },
        { "fieldPath": "window_start", "order": "ASCENDING" },
        { "fieldPath": "caller_address", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### Data Retention

Implement cleanup via Cloud Functions or scheduled jobs:
- Minute-level data: Keep 7 days
- Hour-level data: Keep 30 days
- Day-level data: Keep 90 days

---

## Collection: `perkos_monthly_vendor_stats`

Pre-aggregated monthly statistics per vendor. Updated daily via aggregation job for dashboard display.

### Document Structure

```typescript
interface MonthlyVendorStats {
  id: string;                           // Auto-generated document ID

  // Period (YYYY-MM format)
  year_month: string;                   // e.g., "2026-01"

  // Vendor association
  user_wallet_address: string;
  vendor_id: string | null;
  domain_url: string;

  // Transaction metrics
  total_transactions: number;           // Default: 0
  successful_transactions: number;      // Default: 0
  failed_transactions: number;          // Default: 0

  // Volume metrics
  total_volume_usd: number;             // Default: 0

  // Request metrics
  total_requests: number;               // Default: 0
  unique_callers: number;               // Default: 0

  // Endpoint breakdown (JSON for flexibility)
  endpoint_breakdown: {
    [path: string]: {
      requests: number;
      volume_usd: string;
      errors: number;
      avg_latency_ms: number;
    };
  };

  // Performance metrics
  avg_latency_ms: number | null;
  error_rate: number;                   // 0.0000 to 1.0000

  // Platform fees (for billing)
  platform_fees_usd: number;            // Default: 0

  // Metadata
  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
}
```

### Indexes Required

```json
{
  "indexes": [
    {
      "collectionGroup": "perkos_monthly_vendor_stats",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_wallet_address", "order": "ASCENDING" },
        { "fieldPath": "year_month", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "perkos_monthly_vendor_stats",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "domain_url", "order": "ASCENDING" },
        { "fieldPath": "year_month", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Uniqueness Constraints

Enforce in application code:
- `(year_month, vendor_id)` - One record per vendor per month

---

## Collection: `perkos_rate_limit_overages`

Tracks rate limit violations for monitoring. Soft block mode allows overages but logs them here.

### Document Structure

```typescript
interface RateLimitOverage {
  id: string;                           // Auto-generated document ID

  // Who exceeded
  user_wallet_address: string;
  domain_url: string;

  // What limit was exceeded
  limit_type: 'minute' | 'hour' | 'day';
  limit_value: number;                  // The limit that was exceeded
  actual_value: number;                 // Actual count when exceeded
  overage_percent: number;              // How much over (e.g., 125.50 = 25.5% over)

  // When
  window_start: string;                 // ISO timestamp
  occurred_at: string;                  // ISO timestamp (default: now)

  // Subscription context
  subscription_tier: string | null;

  // Metadata
  created_at: string;                   // ISO timestamp
}
```

### Indexes Required

```json
{
  "indexes": [
    {
      "collectionGroup": "perkos_rate_limit_overages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_wallet_address", "order": "ASCENDING" },
        { "fieldPath": "occurred_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "perkos_rate_limit_overages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "domain_url", "order": "ASCENDING" },
        { "fieldPath": "limit_type", "order": "ASCENDING" },
        { "fieldPath": "window_start", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### Data Retention

Delete records older than 90 days via scheduled cleanup.

---

## Security Rules

Add these rules to your `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Vendor domains - read/write by owner or admin
    match /perkos_user_vendor_domains/{domainId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (resource == null || resource.data.user_wallet_address == request.auth.token.wallet_address);
    }

    // Endpoint usage - server-only write, authenticated read
    match /perkos_endpoint_usage/{usageId} {
      allow read: if request.auth != null;
      allow write: if false; // Server-side only via Admin SDK
    }

    // Monthly stats - server-only write, authenticated read
    match /perkos_monthly_vendor_stats/{statsId} {
      allow read: if request.auth != null;
      allow write: if false; // Server-side only via Admin SDK
    }

    // Rate limit overages - server-only write, authenticated read
    match /perkos_rate_limit_overages/{overageId} {
      allow read: if request.auth != null;
      allow write: if false; // Server-side only via Admin SDK
    }
  }
}
```

---

## Cloud Functions (Optional)

### Cleanup Function

Schedule via Cloud Scheduler to run daily:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const cleanupOldUsageData = functions.pubsub
  .schedule('0 2 * * *') // 2 AM daily
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();

    // Delete minute-level data older than 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await deleteOldUsage(db, 'minute', sevenDaysAgo);

    // Delete hour-level data older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await deleteOldUsage(db, 'hour', thirtyDaysAgo);

    // Delete day-level data older than 90 days
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    await deleteOldUsage(db, 'day', ninetyDaysAgo);

    // Delete rate limit overages older than 90 days
    const overagesQuery = db.collection('perkos_rate_limit_overages')
      .where('occurred_at', '<', ninetyDaysAgo.toISOString());
    await deleteQueryBatch(db, overagesQuery);
  });

async function deleteOldUsage(db: admin.firestore.Firestore, windowType: string, olderThan: Date) {
  const query = db.collection('perkos_endpoint_usage')
    .where('window_type', '==', windowType)
    .where('window_start', '<', olderThan.toISOString());
  await deleteQueryBatch(db, query);
}

async function deleteQueryBatch(db: admin.firestore.Firestore, query: admin.firestore.Query) {
  const snapshot = await query.limit(500).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // Recurse for more deletions
  await deleteQueryBatch(db, query);
}
```

---

## Migration Notes

When migrating from SQL to Firebase:

1. **No foreign key constraints**: Enforce referential integrity in application code
2. **No unique constraints**: Check for duplicates before insert
3. **No triggers**: Use Cloud Functions for `updated_at` if needed, or update in application code
4. **No views**: Create queries in application code or use callable functions
5. **JSONB → Object**: Firebase natively supports nested objects (endpoint_breakdown)
6. **DECIMAL → Number**: JavaScript numbers (consider storing USD as cents for precision)
7. **UUID → String**: Use Firestore auto-generated IDs or generate UUIDs in code

---

## Related Services

- `VendorOwnershipService.ts` - Domain claiming and verification
- `RateLimitService.ts` - Rate limit checking and usage logging
- `UsageAggregationService.ts` - Monthly stats aggregation
