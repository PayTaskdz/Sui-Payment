# Sui-Payment

## Payment backend requirements (Gaian integration)

### Goal
Build a backend that lets a user connect a Sui wallet on the frontend and pay a bank QR (VND/PHP) by transferring stablecoin (e.g., USDC/USDT). The backend integrates with Gaian to:

- enforce KYC before payment
- create payment orders from QR
- verify on-chain payment proof
- track order status until bank transfer completes

### Required header (all Gaian API calls)
```
"x-api-key": "<api_key>"
```
Store the API key in environment variables/secrets. Do not hardcode.

---

## Scope
### In-scope
- KYC flow (Gaian link or partner KYC sharing)
- Order creation (placeOrder)
- Client-side signing/submission of stablecoin transfer tx
- Verify order with transaction proof
- Poll status until completed/failed
- Persist users/orders and expose your own API to the frontend

---

## Chain assumption (Sui)
For this project we assume Gaian supports `chain = "Sui"`.

- Frontend signing is done using a Sui wallet.
- Backend passes `chain` to Gaian and expects `cryptoTransferInfo` to be valid for Sui.
- `transactionProof` is the submitted Sui transaction digest/hash.

## DB

### Overview
The backend must support the flow: frontend submits `username` -> backend loads `qrString` from DB -> backend calls Gaian `placeOrder`.

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
- `payerWalletAddress` (Sui wallet address)
- `status` (`awaiting_crypto_transfer` | `verified` | `processing` | `completed` | `failed`)
- `fiatAmount`, `fiatCurrency`
- `cryptoAmount`, `cryptoCurrency`
- `chain` (expect `Sui`)
- `toAddress` (from `cryptoTransferInfo`)
- `token` (token identifier/address from `cryptoTransferInfo`)
- `transactionProof` (Sui tx digest/hash; nullable until submitted)
- `bankTransferStatus` (nullable)
- `bankTransactionReference` (json/nullable)
- `createdAt`, `updatedAt`

Recommended fields:
- `clientRequestId` (idempotency key from frontend)
- `exchangeRate` (snapshot)
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
## Flow table

| Step | Actor | Input | Action | Output | DB writes |
|---|---|---|---|---|---|
| 0 | Admin/Backoffice | `username`, `qrString`, `fiatCurrency` | Create/update `payment_targets` entry (receiver config) | Active payment target | `payment_targets` upsert |
| 1 | Frontend | User enters `username` + `amount` and is already connected to Sui wallet | Call backend `POST /api/payments/orders` | `orderId`, `cryptoTransferInfo`, amounts, rate, `qrInfo` | Create `orders` with `status=awaiting_crypto_transfer` |
| 2 | Backend | `username` | Validate + load `qrString` from DB | `qrString` | none |
| 3 | Backend -> Gaian | `qrString`, `amount`, `fiatCurrency`, `cryptoCurrency`, `chain=Sui`, `fromAddress` | Call `POST /api/v1/placeOrder` with `x-api-key` | Gaian order response | Store snapshot in `orders` |
| 4 | Frontend | `cryptoTransferInfo` | Build transfer tx on Sui and sign/submit with Sui wallet | `transactionProof` (Sui tx digest/hash) | none |
| 5 | Frontend -> Backend | `orderId`, `transactionProof` | Call `POST /api/payments/orders/{orderId}/submit-proof` | ack + current status | Update `orders.transactionProof`, set `status=verifying` (optional) |
| 6 | Backend -> Gaian | `orderId`, `transactionProof` | Call `POST /api/v1/verifyOrder` | `status=verified`, `bankTransferStatus=queued` | Update `orders.status=verified` + `bankTransferStatus` |
| 7 | Backend (job) -> Gaian | `orderId` | Poll `GET /api/v1/status` until terminal state | `processing` -> `completed` or `failed` | Update `orders.status`, `pollCount`, `lastCheckedAt`, `bankTransactionReference` |
| 8 | Frontend | `orderId` | Call backend `GET /api/payments/orders/{orderId}` to show progress | Order details | none |

---
- Use this `qrString` as input for `POST /api/v1/placeOrder`.

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
- Backend treats wallet address as user primary key (email optional).

### FR-1A: Session / request auth (recommended)
Backend should not trust a raw `walletAddress` sent from frontend. Require proof-of-wallet via one of:
- SIWS (Sign-In With Sui) message signature, or
- a backend-issued nonce challenge signed by the wallet.

Backend stores a short-lived session token (JWT or server session) that binds:
- `walletAddress`
- `issuedAt`, `expiresAt`

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

### FR-3: Create order (non-prefunded)
- Backend calls:
  - `POST /api/v1/placeOrder`
- Input required (from frontend + DB):
  - `username` (frontend)
  - `qrString` (backend loads from DB)
  - `amount` (frontend)
  - `fiatCurrency` (from DB or frontend; must match supported list)
  - `cryptoCurrency` (USDC; confirm other stablecoins)
  - `chain` (supported by Gaian)
  - `fromAddress` (payer wallet on that chain)
  - `transactionReference` (optional)
- Backend returns to frontend:
  - `orderId`
  - `cryptoAmount`, `exchangeRate`
  - `cryptoTransferInfo` (toAddress/token/amount/encodedTransaction if any)
  - `qrInfo` (for UI confirmation)

Backend persistence:
- store full Gaian response for audit/debug (mask sensitive fields)
- store order state = `awaiting_crypto_transfer`

### FR-4: Client signs & submits transfer transaction
- Frontend builds and signs the stablecoin transfer transaction using the returned transfer info.
- After submission, frontend sends `transactionHash` (or Sui tx digest) to backend.

### FR-5: Verify order (non-prefunded)
- Backend calls:
  - `POST /api/v1/verifyOrder`
- Request:
  - `orderId`
  - `transactionProof` = tx hash/digest
- Backend updates order state to `verified` and stores `bankTransferStatus`.

### FR-6: Poll order status
- Backend periodically calls:
  - `GET /api/v1/status` with `orderId`
- Backend updates local order state machine:
  - `awaiting_crypto_transfer`
  - `verified`
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
- `POST /api/payments/orders/{orderId}/submit-proof`
- `GET /api/payments/orders/{orderId}`
- `GET /api/payments/orders?walletAddress=...`

---

## Acceptance criteria
- KYC not approved => `POST /api/payments/orders` returns `KYC_REQUIRED`.
- placeOrder returns enough data for frontend to build/sign tx.
- submit-proof triggers verifyOrder; order becomes `verified`.
- polling updates order to `completed` or `failed`.
- restart-safe: order state and polling can resume without data loss.

---

## Notes
- Sandbox QR strings in the Gaian doc must not be used in production.
- Base64 image payloads can be large; enforce size limits and timeouts.