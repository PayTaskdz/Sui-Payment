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

### Out-of-scope (unless you confirm)
- Prefunded flow (`/placeOrder/prefund`) because it requires Gaian enablement
- Backend custody/signing (backend signs on behalf of user)
- Bridging/swap between Sui and other chains (unless required by Gaian)

---

## Key open dependency: Sui support
The Gaian doc you provided shows `chain` values like `Solana`, `Ethereum`, `Polygon`, `Arbitrum`, `Base` and includes Solana example code.

Before implementation, confirm with Gaian:
- Do they support `chain = "Sui"`?
- What is the required `transactionProof` format on Sui (tx digest)?
- Which stablecoins/tokens are supported on Sui?

If Gaian does **not** support Sui directly, you must choose one of these product/tech approaches:
- **Approach A**: user connects Sui for login/identity, but payment happens on a supported chain (EVM/Solana) using a wallet on that chain.
- **Approach B**: you implement bridge/swap from Sui stablecoin to a supported chain before calling verify (more complex).

---

## Functional requirements

### FR-0: Username-based payment target (no QR scanning on frontend)
Frontend only submits a `username`. Backend loads the bank `qrString` from DB.

Backend responsibilities:
- Validate `username` (format + existence + active flag).
- Lookup `qrString` (and optional display metadata) from DB by `username`.
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