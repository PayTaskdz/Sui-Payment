# Sui-Payment

## Payment backend requirements (Gaian integration)

### Goal
Build a backend that lets a user connect a Sui wallet on the frontend, pay by transferring stablecoin (e.g., USDC/USDT) to the merchant, and use **Gaian prefunded** flow to complete the bank payout.

In other words:
- crypto rail: user -> merchant wallet (on Sui)
- fiat rail: merchant/Gaian prefunded -> bank payout (via Gaian)

The backend integrates with Gaian to:

- enforce KYC before payment (if required by Gaian for payout)
- create payout orders via `POST /api/v1/placeOrder/prefund`
- poll order status until bank transfer completes

### Required header (all Gaian API calls)
```
"x-api-key": "<api_key>"
```
Store the API key in environment variables/secrets. Do not hardcode.

---

## Scope
### In-scope
- KYC flow (Gaian link or partner KYC sharing)
- Order creation via prefunded endpoint (`POST /api/v1/placeOrder/prefund`)
- Poll status until completed/failed
- Persist users/orders and expose your own API to the frontend

---

## Chain assumption (Sui)
For this project we assume Gaian supports `chain = "Sui"`.

- Frontend may still connect a Sui wallet for identity/reference.
- For prefunded payments, there is no per-order on-chain stablecoin transfer performed by the end user.
- Backend passes `chain` to Gaian and processes the returned order status.

## DB

### Overview
The backend must support the flow: frontend submits `username` -> backend loads `qrString` from DB -> backend calls Gaian `POST /api/v1/placeOrder/prefund`.

To make payment processing reliable (polling, retries, history), store orders locally.

### Table/Collection: `payment_targets`
Mapping of payment receiver config by `username`.

Required fields:
- `id` (primary key)
- `username` (unique, indexed)
- `qrString` (text)
- `fiatCurrency` (`VND` | `PHP`) (recommended to store here to avoid mismatch)
- `isActive` (boolean)
- `createdAt`, `updatedAt`

Optional fields (UI/display only):
- `displayName` / `merchantName`
- `country`
- `notes`

Constraints:
- `username` must be unique.
- `qrString` must be non-empty.

### Table/Collection: `orders`
Local mirror of Gaian order lifecycle.

Required fields:
- `id` (primary key)
- `orderId` (unique, Gaian order id)
- `username` (references `payment_targets.username`)
- `payerWalletAddress` (Sui wallet address; used for attribution/reference)
- `status` (`processing` | `completed` | `failed`)
- `fiatAmount`, `fiatCurrency`
- `cryptoAmount`, `cryptoCurrency` (if provided by Gaian)
- `chain` (expect `Sui`)
- `bankTransferStatus` (nullable)
- `bankTransactionReference` (json/nullable)
- `createdAt`, `updatedAt`

Recommended fields:
- `clientRequestId` (idempotency key from frontend)
- `exchangeRate` (snapshot, if provided)
- `expiresAt` (if provided by Gaian)
- `pollCount`, `lastCheckedAt`
- `gaianRaw` (json snapshot; or store only a safe subset)

Indexes:
- unique: `orderId`
- index: `payerWalletAddress`
- index: `username`
- index: `status`

### Idempotency
To avoid duplicate orders when the user retries:
- Frontend sends `clientRequestId` (UUID) with `POST /api/payments/orders`.
- Backend enforces uniqueness on (`payerWalletAddress`, `clientRequestId`).

---
Frontend only submits a `username`. Backend loads the bank `qrString` from DB.

Backend responsibilities:
- Validate `username` (format + existence + active flag).
- Lookup `qrString` (and optional display metadata) from DB by `username`.
---
- Use this `qrString` as input for `POST /api/v1/placeOrder/prefund`.

Data model requirements:
- A DB table/collection mapping:
  - `username` (unique)
  - `qrString`
  - optional: `fiatCurrency`, `merchantName`, `country`, `isActive`, `createdAt`, `updatedAt`

Required errors:
- `USERNAME_NOT_FOUND` (unknown or inactive)
- `QR_NOT_CONFIGURED` (missing/invalid qrString)

### FR-1: User identity
- Frontend connects Sui wallet and obtains `walletAddress`.
- Backend treats wallet address as user primary key (email optional).`

### FR-2: KYC gating
User must be KYC-approved before creating an order.

Support one (or both) KYC methods:

#### FR-2A: External KYC link (Gaian websdk)
- Backend calls:
  - `POST /api/v1/kyc/link`
- Backend returns `websdkUrl` to frontend.

#### FR-2B: Partner KYC sharing
- Backend calls:
  - `POST /api/v1/submit-kyc-information`
- Do **not** call register user separately in this path (Gaian auto-creates user).

#### FR-2C: Check KYC status
- Backend must be able to fetch user info from Gaian:
  - `GET /api/v1/users/?walletAddress=...` (or `?email=...`)
- If `kyc.status != "approved"`, backend must block payments and return `KYC_REQUIRED` to frontend.

### FR-3: Create order (prefunded)
- Backend calls:
  - `POST /api/v1/placeOrder/prefund`
- Input required (from frontend + DB):
  - `username` (frontend)
  - `qrString` (backend loads from DB)
  - `amount` (frontend)
  - `fiatCurrency` (from DB or frontend; must match supported list)
  - `cryptoCurrency` (USDC/USDT as enabled by Gaian)
  - `fromAddress` (Sui wallet address for reference)
  - `transactionReference` (optional)

Notes:
- With prefunded flow, the order is processed automatically by Gaian after placement.
- No client-side stablecoin transfer is required for each order.

- Backend returns to frontend:
  - `orderId`
  - current `status`
  - `cryptoAmount`, `exchangeRate` (if provided)
  - `qrInfo` (for UI confirmation)
  - `isPrefunded = true` (if returned)

Backend persistence:
- store full Gaian response for audit/debug (mask sensitive fields)
- store order state from Gaian response (often `processing` or similar)

### FR-4: Poll order status
- Backend periodically calls:
  - `GET /api/v1/status` with `orderId`
- Backend updates local order state machine until terminal:
  - `processing`
  - `completed` or `failed`

Polling requirements:
- polling interval: 10s-30s (configurable)
- max attempts / timeout (configurable)
- polling should be implemented via background job (queue/cron), not a long HTTP request

### FR-7: Order history
Backend should expose order history by wallet address and/or username (from DB) and optionally reconcile with Gaian.
---

## Suggested backend API (your service)
These are recommended endpoints to keep Gaian hidden from the frontend and to centralize state.

- `POST /api/kyc/link`
- `POST /api/kyc/submit` (if using partner KYC sharing)
- `GET /api/users/me` (by wallet session)
- `POST /api/payments/orders`
- `GET /api/payments/orders/{orderId}`
- `GET /api/payments/orders?walletAddress=...`

---

## Acceptance criteria
- KYC not approved => `POST /api/payments/orders` returns `KYC_REQUIRED`.
- Prefunded order is created via `POST /api/v1/placeOrder/prefund` using `qrString` loaded from DB.
- polling updates order to `completed` or `failed`.
- restart-safe: order state and polling can resume without data loss.

---

## Notes
- Sandbox QR strings in the Gaian doc must not be used in production.
- Base64 image payloads can be large; enforce size limits and timeouts.