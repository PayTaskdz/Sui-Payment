# Sui Payment Backend - API Documentation

Tài liệu chi tiết từng API endpoint theo format chuẩn.

---

# 1. AUTH MODULE

## 1.1 Get Challenge

As a **User (Wallet Owner)**,

I want the API endpoint

`GET /auth/challenge`

to generate a cryptographic challenge (nonce) for wallet signature verification so that I can securely authenticate without exposing my private key.

### Acceptance Criteria / Features

1. **Query Parameters & Validation**
   - The API must accept `address` as a query parameter.
   - The `address` must be a valid blockchain wallet address format.

2. **Challenge Generation**
   - The system must generate a unique cryptographic `nonce` for each request.
   - The challenge must include domain, timestamp, and expiration time.
   - Challenge TTL is configurable via `AUTH_CHALLENGE_TTL_SECONDS` (default: 300s).

3. **Security**
   - The nonce must be stored in database with expiration time.
   - Each nonce can only be used once.

4. **Persistence**
   - The API must persist the nonce into the `auth_nonces` table with status tracking.

### Query Parameters

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `address` | string | ✅       | User's wallet address (0x...) |

### Response

```json
{
  "domain": "paypath.app", // Domain for SIWE message
  "address": "0x1234...abcd", // Normalized wallet address
  "nonce": "a1b2c3d4e5f6...", // Random nonce for signing
  "issuedAt": "2026-01-25T10:00:00Z", // ISO timestamp when issued
  "expirationTime": "2026-01-25T10:05:00Z", // Expiration time
  "message": "..." // Pre-built message to sign
}
```

### Error Handling

- **400 - Bad Request:**
  - If `address` query parameter is missing.
  - If `address` format is invalid.

- **500 - Internal Server Error:**
  - If nonce generation or database persistence fails.

---

## 1.2 Verify Signature

As a **User (Wallet Owner)**,

I want the API endpoint

`POST /auth/verify`

to verify my wallet signature and receive a JWT token so that I can access protected resources.

### Acceptance Criteria / Features

1. **Payload Validation**
   - The API must accept a JSON payload containing the signed message and signature.
   - All required fields (`address`, `nonce`, `message`, `signature`) must be present.

2. **Security & Cryptography (Critical)**
   - The API must verify the cryptographic `signature` provided in the payload.
   - The system must recover the signer's address from `signature` and `message`.
   - The recovered address **must match** the `address` in the payload exactly.
   - The API must verify that the `nonce` is valid, exists in the database, and has not expired.

3. **Nonce Consumption**
   - Once verified, the nonce must be marked as `usedAt` in the database.
   - A used nonce cannot be reused (replay protection).

4. **Token Issuance**
   - Upon successful verification, issue a JWT containing `userId` and `walletAddress`.
   - JWT expiration is configurable via `JWT_EXPIRES_IN`.

### Payload

```json
{
  "address": "0x1234...abcd", // Wallet address that signed
  "domain": "paypath.app", // Optional: Override AUTH_DOMAIN
  "nonce": "a1b2c3d4e5f6...", // Nonce from challenge
  "issuedAt": "2026-01-25T10:00:00Z", // Timestamp from challenge
  "expirationTime": "2026-01-25T10:05:00Z", // Expiration from challenge
  "statement": "Sign in to PayPath", // Optional: Custom statement
  "message": "domain: paypath.app\naddress: 0x...", // Full SIWE message
  "signature": "0xabc123..." // Cryptographic signature
}
```

### Response (Success)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...", // JWT token
  "userId": "uuid-here", // User UUID
  "walletAddress": "0x1234...abcd", // Normalized address
  "username": "alice", // Username if exists
  "isNewUser": false // Whether this is first login
}
```

### Error Handling

- **400 - Bad Request:**
  - If required fields (`address`, `nonce`, `message`, `signature`) are missing.
  - If message format is invalid.

- **401 - Unauthorized:**
  - If the `signature` is invalid (recovered address does not match `address`).
  - If the `nonce` is invalid, expired, or already used.

- **404 - Not Found:**
  - If no matching nonce found in database.

- **500 - Internal Server Error:**
  - If an unexpected database or system error occurs.

---

## 1.3 Register User

As a **New User**,

I want the API endpoint

`POST /auth/register`

to create a new account with my wallet address and username so that I can use the payment platform.

### Acceptance Criteria / Features

1. **Payload Validation**
   - The API must accept a JSON payload with `walletAddress` and `username`.
   - The `username` must be 3-20 characters, alphanumeric with underscores only.
   - The `walletAddress` must be a valid blockchain address format.

2. **Business Logic & Compliance**
   - **Uniqueness Check:** The API must ensure `username` is not already taken.
   - **Uniqueness Check:** The API must ensure `walletAddress` is not already registered.
   - **Referral System:** If `referralUsername` is provided, link user to referrer.
   - **Gaian Registration:** Upon success, register user with Gaian API.

3. **Persistence**
   - Create user in `users` table with default KYC status "not started".
   - Create primary onchain wallet in `onchain_wallets` table.
   - Store `gaianRegisteredWallet` for KYC inheritance.

### Payload

```json
{
  "walletAddress": "0x1234...abcd", // Required: User's wallet address
  "username": "alice_wong", // Required: Unique username (3-20 chars)
  "referralUsername": "bob", // Optional: Referrer's username
  "email": "alice@example.com" // Optional: User email
}
```

### Response (Success - 201)

```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "username": "alice_wong",
    "walletAddress": "0x1234...abcd",
    "kycStatus": "not started",
    "referrerId": "bob-uuid" // If referral provided
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Error Handling

- **400 - Bad Request:**
  - If `walletAddress` format is invalid.
  - If `username` format is invalid (wrong length or characters).
  - If required fields are missing.

- **409 - Conflict:**
  - If `username` is already taken by another user.
  - If `walletAddress` is already registered.

- **404 - Not Found:**
  - If `referralUsername` does not exist.

- **500 - Internal Server Error:**
  - If Gaian registration fails.
  - If database persistence fails.

---

## 1.4 zkLogin Challenge

As a **User (Google Account Owner)**,

I want the API endpoint

`GET /auth/zklogin/challenge`

to get zkLogin parameters (nonce, maxEpoch) for Google OAuth zero-knowledge proof authentication.

### Acceptance Criteria / Features

1. **Challenge Generation**
   - Generate cryptographic nonce for zkLogin.
   - Query Sui RPC for current epoch.
   - Calculate `maxEpoch` = currentEpoch + offset (configurable).

2. **Response**
   - Return nonce and maxEpoch for client to use with Google OAuth.

### Response

```json
{
  "nonce": "random-nonce-string", // Nonce for zkLogin
  "maxEpoch": "150" // Maximum epoch for proof validity
}
```

---

## 1.5 zkLogin Salt

As a **User (Google Account Owner)**,

I want the API endpoint

`POST /auth/zklogin/salt`

to get or create a deterministic salt for my Google account so that I can derive a consistent Sui address.

### Acceptance Criteria / Features

1. **Payload Validation**
   - The API must accept Google OIDC `idToken` JWT.
   - Validate JWT signature using Google's public keys.

2. **Salt Management**
   - Check if salt exists for (provider, providerSub) combination.
   - If not exists, generate random salt and persist.
   - Return base64-encoded salt.

3. **Address Derivation**
   - Compute zkLogin Sui address from salt and JWT claims.

### Payload

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..." // Google OIDC id_token JWT
}
```

### Response

```json
{
  "salt": "base64-encoded-salt", // User's zkLogin salt
  "address": "0xzklogin...derived" // Derived Sui address
}
```

### Error Handling

- **400 - Bad Request:**
  - If `idToken` is missing or malformed.

- **401 - Unauthorized:**
  - If `idToken` JWT signature verification fails.
  - If JWT is expired.

---

## 1.6 zkLogin Verify

As a **User (Google Account Owner)**,

I want the API endpoint

`POST /auth/zklogin/verify`

to verify my zkLogin proof and receive a JWT token for authentication.

### Acceptance Criteria / Features

1. **Payload Validation**
   - Accept idToken, nonce, maxEpoch, jwtRandomness, extendedEphemeralPublicKey, proof.
   - All fields are required.

2. **Proof Verification**
   - Verify zkLogin proof using Sui's verification algorithm.
   - Validate nonce matches registered nonce.
   - Verify proof is valid for the given epoch.

3. **Token Issuance**
   - Upon success, issue JWT with user identity.

### Payload

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs...",      // Google OIDC id_token
  "nonce": "registered-nonce",               // Nonce from zklogin/register
  "maxEpoch": "150",                         // Max epoch from challenge
  "jwtRandomness": "base64-randomness",      // JWT randomness
  "extendedEphemeralPublicKey": "base64...", // Extended ephemeral public key
  "keyClaimName": "sub",                     // Claim name (usually "sub")
  "proof": {                                 // Proof object from prover
    "proofPoints": {...},
    "issBase64Details": {...},
    "headerBase64": "..."
  }
}
```

### Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "uuid-here",
  "walletAddress": "0xzklogin...derived"
}
```

### Error Handling

- **400 - Bad Request:**
  - If required fields are missing.

- **401 - Unauthorized:**
  - If proof verification fails.
  - If nonce is invalid or expired.

---

# 2. USERS MODULE

## 2.1 Get Profile

As an **Authenticated User**,

I want the API endpoint

`GET /users/profile`

to retrieve my complete profile including wallets, KYC status, and loyalty information.

### Acceptance Criteria / Features

1. **Authentication**
   - The API must require Bearer JWT token.
   - Extract `userId` from JWT payload.

2. **Data Retrieval**
   - Fetch user from database with all related entities.
   - Include onchain wallets with balance info.
   - Include offchain wallets (bank accounts).
   - Sync KYC status from Gaian API.

3. **Loyalty Calculation**
   - Calculate current loyalty tier from points.
   - Calculate points needed for next tier.
   - Get commission rate for current tier.

### Headers

| Header        | Value                | Required |
| ------------- | -------------------- | -------- |
| Authorization | Bearer {accessToken} | ✅       |

### Response

```json
{
  "id": "uuid-here",
  "username": "alice",
  "walletAddress": "0x1234...abcd",
  "gaianRegisteredWallet": "0x1234...abcd",
  "email": "alice@example.com",
  "firstName": "Alice",
  "lastName": "Wong",
  "kycStatus": "approved", // "not started" | "pending" | "approved" | "rejected"
  "canTransfer": true, // true if kycStatus === "approved"
  "loyaltyPoints": 350,
  "loyaltyTier": "PLUS", // "STANDARD" | "PLUS" | "PREMIUM" | "ELITE"
  "pointsToNextTier": 350,
  "commissionRate": 0.3,
  "commissionBalance": 15.5,
  "isActive": true,
  "onchainWallets": [
    {
      "id": "wallet-uuid",
      "address": "0x1234...abcd",
      "chain": "Sui",
      "label": "My Main Wallet",
      "isDefault": true,
      "isActive": true
    }
  ],
  "offchainWallets": [
    {
      "id": "bank-uuid",
      "bankName": "Vietcombank",
      "accountNumber": "1234567890",
      "accountName": "NGUYEN VAN A",
      "isDefault": true
    }
  ],
  "referrer": {
    "username": "bob"
  },
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### Error Handling

- **401 - Unauthorized:**
  - If Authorization header is missing.
  - If JWT token is invalid or expired.

- **404 - Not Found:**
  - If user does not exist in database.

---

## 2.2 Update Profile

As an **Authenticated User**,

I want the API endpoint

`PATCH /users/profile`

to update my profile information (email, firstName, lastName).

### Acceptance Criteria / Features

1. **Authentication**
   - Require Bearer JWT token.

2. **Payload Validation**
   - All fields are optional.
   - Email must be valid email format.
   - Names are string, optional.

3. **Persistence**
   - Only update provided fields.
   - Return updated user profile.

### Payload

```json
{
  "email": "newemail@example.com", // Optional: Valid email format
  "firstName": "Alice", // Optional: First name
  "lastName": "Wong" // Optional: Last name
}
```

### Response

```json
{
  "id": "uuid-here",
  "username": "alice",
  "email": "newemail@example.com",
  "firstName": "Alice",
  "lastName": "Wong",
  "updatedAt": "2026-01-25T10:00:00Z"
}
```

### Error Handling

- **400 - Bad Request:**
  - If `email` format is invalid.

- **401 - Unauthorized:**
  - If not authenticated.

---

## 2.3 Check Username Availability

As a **New User**,

I want the API endpoint

`GET /users/check-username`

to check if a username is available before registration.

### Acceptance Criteria / Features

1. **Query Parameters**
   - Accept `username` as query parameter.
   - Validate username format.

2. **Uniqueness Check**
   - Query database for existing username.
   - Return availability status.

### Query Parameters

| Parameter  | Type   | Required | Description       |
| ---------- | ------ | -------- | ----------------- |
| `username` | string | ✅       | Username to check |

### Response

```json
{
  "username": "alice",
  "available": true, // true if username not taken
  "message": "Username is available"
}
```

### Response (Taken)

```json
{
  "username": "alice",
  "available": false,
  "message": "Username is already taken"
}
```

---

## 2.4 Lookup User by Username

As an **Authenticated User**,

I want the API endpoint

`GET /users/lookup`

to find another user by username for sending transfers.

### Acceptance Criteria / Features

1. **Query Parameters**
   - Accept `username` as query parameter.

2. **User Lookup**
   - Find user by exact username match.
   - Return limited public info only.
   - Include default receiving wallet.

### Query Parameters

| Parameter  | Type   | Required | Description        |
| ---------- | ------ | -------- | ------------------ |
| `username` | string | ✅       | Username to lookup |

### Response

```json
{
  "found": true,
  "user": {
    "id": "uuid-here",
    "username": "bob",
    "firstName": "Bob",
    "lastName": "Tran",
    "kycStatus": "approved",
    "defaultOnchainWallet": {
      "address": "0xbob...wallet",
      "chain": "Sui"
    },
    "defaultOffchainWallet": {
      "bankName": "Techcombank",
      "accountNumber": "****7890" // Masked for privacy
    }
  }
}
```

### Error Handling

- **404 - Not Found:**
  - If username does not exist.

---

## 2.5 Get Loyalty Stats

As an **Authenticated User**,

I want the API endpoint

`GET /users/loyalty-stats`

to view my detailed loyalty program statistics.

### Acceptance Criteria / Features

1. **Data Calculation**
   - Current tier and points.
   - Transaction counts (daily, weekly, monthly).
   - Points breakdown.
   - Commission earnings.

### Response

```json
{
  "currentTier": "PLUS",
  "loyaltyPoints": 350,
  "pointsToNextTier": 350,
  "nextTier": "PREMIUM",
  "commissionRate": 0.3,
  "commissionBalance": 15.5,
  "transactions": {
    "today": 2,
    "thisWeek": 8,
    "thisMonth": 25
  },
  "tierThresholds": {
    "STANDARD": 0,
    "PLUS": 300,
    "PREMIUM": 700,
    "ELITE": 1150
  }
}
```

---

## 2.6 Get Referral Info

As an **Authenticated User**,

I want the API endpoint

`GET /users/referral-info`

to view my referral program information and list of referees.

### Acceptance Criteria / Features

1. **Referral Code**
   - User's referral code is their username.

2. **Referee List**
   - List users who registered with referral code.
   - Show their transaction count.
   - Highlight which referees have completed qualification (3+ transactions).

### Response

```json
{
  "referralCode": "alice", // User's username as referral code
  "totalReferees": 5,
  "qualifiedReferees": 3, // Referees with 3+ transactions
  "referralPoints": 150, // Points earned from referrals
  "referees": [
    {
      "username": "charlie",
      "registeredAt": "2026-01-10T00:00:00Z",
      "transactionCount": 5,
      "qualified": true // Has 3+ transactions
    },
    {
      "username": "david",
      "registeredAt": "2026-01-20T00:00:00Z",
      "transactionCount": 1,
      "qualified": false
    }
  ]
}
```

---

# 3. WALLETS MODULE - ONCHAIN

## 3.1 Add Onchain Wallet

As an **Authenticated User**,

I want the API endpoint

`POST /wallet/onchain/add`

to link a new blockchain wallet address to my account so that I can use multiple wallets.

### Acceptance Criteria / Features

1. **Authentication**
   - Require Bearer JWT token.

2. **Payload Validation**
   - The `address` must be a valid blockchain address format.
   - The `chain` field must be a valid chain name (Sui, Ethereum, etc.).
   - Address format must match the selected chain.

3. **Business Logic & Compliance**
   - **Uniqueness Check:** The API must ensure `(chain, address)` is not already linked to any user.
   - **KYC Inheritance:** New wallet inherits KYC status from primary wallet.

4. **Persistence**
   - Persist wallet into `onchain_wallets` table.
   - Set `isDefault` to false (user must explicitly set default).

### Payload

```json
{
  "address": "0xNewWallet...", // Required: Wallet address
  "chain": "Sui", // Required: ENUM: Sui, Ethereum, etc.
  "label": "My Secondary Wallet", // Optional: User-defined label
  "walletProvider": "sui_wallet", // Optional: sui_wallet, metamask, etc.
  "publicKey": "0xPubKey..." // Optional: Public key for verification
}
```

### Response (Success - 201)

```json
{
  "walletId": "uuid-here",
  "address": "0xNewWallet...",
  "chain": "Sui",
  "label": "My Secondary Wallet",
  "walletProvider": "sui_wallet",
  "isDefault": false,
  "isActive": true,
  "createdAt": "2026-01-25T10:00:00Z"
}
```

### Error Handling

- **400 - Bad Request:**
  - If `address` format is invalid for the specified `chain`.
  - If required fields (`address`, `chain`) are missing.

- **401 - Unauthorized:**
  - If Authorization header is missing or invalid.

- **404 - Not Found:**
  - If user does not exist.

- **409 - Conflict:**
  - If `(chain, address)` is already linked to another user.
  - Error includes: `{ existingUsername: "other_user" }`

---

## 3.2 List Onchain Wallets

As an **Authenticated User**,

I want the API endpoint

`GET /wallet/onchain`

to view all my linked blockchain wallets.

### Response

```json
{
  "total": 2,
  "wallets": [
    {
      "walletId": "uuid-1",
      "address": "0xMain...",
      "chain": "Sui",
      "label": "Main Wallet",
      "walletProvider": "sui_wallet",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z"
    },
    {
      "walletId": "uuid-2",
      "address": "0xSecondary...",
      "chain": "Sui",
      "label": "Trading Wallet",
      "walletProvider": null,
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-01-15T00:00:00Z"
    }
  ]
}
```

---

## 3.3 Get Wallet Details

As an **Authenticated User**,

I want the API endpoint

`GET /wallet/onchain/:id`

to view details of a specific wallet.

### Path Parameters

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Wallet ID   |

### Response

```json
{
  "id": "uuid-here",
  "address": "0xMain...",
  "chain": "Sui",
  "label": "Main Wallet",
  "walletProvider": "sui_wallet",
  "kycStatus": "approved",
  "isDefault": true,
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-25T00:00:00Z"
}
```

### Error Handling

- **404 - Not Found:**
  - If wallet does not exist or does not belong to user.

---

## 3.4 Get Wallet Balance

As an **Authenticated User**,

I want the API endpoint

`GET /wallet/onchain/:id/balance`

to query the current balance of my wallet from the blockchain.

### Acceptance Criteria / Features

1. **Blockchain Query**
   - Call Sui RPC to get balance for wallet address.
   - For non-Sui chains, return placeholder message.

2. **Response Format**
   - Return balance in both raw and formatted units.

### Response (Sui)

```json
{
  "walletId": "uuid-here",
  "address": "0xMain...",
  "chain": "Sui",
  "balance": {
    "SUI": "1000000000", // Raw units (MIST)
    "USDC": "5000000" // Raw units (6 decimals)
  },
  "formatted": {
    "SUI": "1.0",
    "USDC": "5.0"
  },
  "currency": "SUI"
}
```

### Error Handling

- **500 - Internal Server Error:**
  - Code: `BALANCE_QUERY_FAILED`
  - If blockchain RPC call fails.

---

## 3.5 Update Wallet

As an **Authenticated User**,

I want the API endpoint

`PATCH /wallet/onchain/:id`

to update my wallet label.

### Payload

```json
{
  "label": "New Label Name" // Optional: New label
}
```

### Response

```json
{
  "walletId": "uuid-here",
  "label": "New Label Name",
  "updatedAt": "2026-01-25T10:00:00Z"
}
```

---

## 3.6 Delete Wallet

As an **Authenticated User**,

I want the API endpoint

`DELETE /wallet/onchain/:id`

to remove a linked wallet from my account.

### Acceptance Criteria / Features

1. **Validation**
   - Cannot delete default wallet.
   - Must set another wallet as default first.

2. **Deletion**
   - Hard delete from database.

### Response

```json
{
  "walletId": "uuid-here",
  "message": "Wallet deleted successfully"
}
```

### Error Handling

- **400 - Bad Request:**
  - Code: `CANNOT_DELETE_DEFAULT_WALLET`
  - If attempting to delete the default wallet.

- **404 - Not Found:**
  - If wallet does not exist or does not belong to user.

---

# 4. WALLETS MODULE - OFFCHAIN (BANK)

## 4.1 Add Bank via QR

As an **Authenticated User**,

I want the API endpoint

`POST /wallet/offchain/add`

to add a bank account by scanning a VietQR code.

### Acceptance Criteria / Features

1. **QR Parsing**
   - Call Gaian API to parse VietQR string.
   - Extract bank info: bankBin, bankName, accountNumber, accountName.

2. **Validation**
   - Validate QR format.
   - Check uniqueness of (country, bankBin, accountNumber).

3. **Persistence**
   - Store bank account in `offchain_wallets` table.
   - Set `isDefault` to false.

### Payload

```json
{
  "qrString": "00020101021138...", // Required: VietQR string
  "label": "My VCB Account" // Optional: User-defined label
}
```

### Response (Success - 201)

```json
{
  "bankId": "uuid-here",
  "country": "VN",
  "bankBin": "970436",
  "bankName": "Vietcombank",
  "accountNumber": "1234567890",
  "accountName": "NGUYEN VAN A",
  "label": "My VCB Account",
  "isDefault": false,
  "isActive": true,
  "createdAt": "2026-01-25T10:00:00Z"
}
```

### Error Handling

- **400 - Bad Request:**
  - If `qrString` is invalid or not VietQR format.

- **409 - Conflict:**
  - Code: `BANK_ALREADY_REGISTERED`
  - If bank account is already registered to another user.
  - Error includes: `{ existingUsername: "other_user" }`

---

## 4.2 List Bank Accounts

As an **Authenticated User**,

I want the API endpoint

`GET /wallet/offchain`

to view all my linked bank accounts.

### Response

```json
{
  "total": 2,
  "banks": [
    {
      "bankId": "uuid-1",
      "country": "VN",
      "bankBin": "970436",
      "bankName": "Vietcombank",
      "accountNumber": "1234567890",
      "accountName": "NGUYEN VAN A",
      "label": "VCB Savings",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z"
    },
    {
      "bankId": "uuid-2",
      "country": "VN",
      "bankBin": "970407",
      "bankName": "Techcombank",
      "accountNumber": "0987654321",
      "accountName": "NGUYEN VAN A",
      "label": "TCB Daily",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-01-15T00:00:00Z"
    }
  ]
}
```

---

## 4.3 Get Bank Details

As an **Authenticated User**,

I want the API endpoint

`GET /wallet/offchain/:id`

to view details of a specific bank account.

### Response

```json
{
  "id": "uuid-here",
  "country": "VN",
  "bankBin": "970436",
  "bankName": "Vietcombank",
  "accountNumber": "1234567890",
  "accountName": "NGUYEN VAN A",
  "qrString": "00020101021138...",
  "label": "VCB Savings",
  "isDefault": true,
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-25T00:00:00Z"
}
```

---

## 4.4 Update Bank

As an **Authenticated User**,

I want the API endpoint

`PATCH /wallet/offchain/:id`

to update my bank account label.

### Payload

```json
{
  "label": "New Label Name"
}
```

### Response

```json
{
  "bankId": "uuid-here",
  "label": "New Label Name",
  "updatedAt": "2026-01-25T10:00:00Z"
}
```

---

## 4.5 Delete Bank

As an **Authenticated User**,

I want the API endpoint

`DELETE /wallet/offchain/:id`

to remove a bank account from my account.

### Acceptance Criteria / Features

1. **Validation**
   - Cannot delete default bank account.
   - Must set another bank as default first.

### Response

```json
{
  "bankId": "uuid-here",
  "message": "Bank account deleted successfully"
}
```

### Error Handling

- **400 - Bad Request:**
  - Code: `CANNOT_DELETE_DEFAULT_BANK`
  - If attempting to delete the default bank account.

---

# 5. TRANSFER MODULE

## 5.1 Smart QR Scanner

As an **Authenticated User**,

I want the API endpoint

`POST /transfer/scan`

to scan any QR code and auto-detect whether it's a PayPath username, onchain address, or bank QR so that the app can show the correct transfer UI.

### Acceptance Criteria / Features

1. **QR Type Detection**
   - Detect PayPath QR: `paypath://username` or `@username`
   - Detect Onchain Address: `0x...` (Sui) or other blockchain formats
   - Detect VietQR: Bank QR code format

2. **PayPath QR Handling**
   - Extract username from QR.
   - Lookup user in database.
   - Return user info with default wallets.

3. **Onchain Address Handling**
   - Validate address format.
   - Check if address belongs to a registered user.
   - Return user info if found, or external address info.

4. **VietQR Handling**
   - Parse QR via Gaian API.
   - Return bank info for offchain transfer.

### Payload

```json
{
  "qrString": "@alice" // QR content to analyze
}
```

### Response (PayPath Username)

```json
{
  "qrType": "PAYPATH_USERNAME",
  "recipient": {
    "username": "alice",
    "displayName": "Alice Wong",
    "kycStatus": "approved",
    "defaultWallet": {
      "type": "onchain",
      "address": "0xalice...",
      "chain": "Sui"
    }
  }
}
```

### Response (Onchain Address)

```json
{
  "qrType": "ONCHAIN_ADDRESS",
  "recipient": {
    "address": "0xunknown...",
    "chain": "Sui",
    "isKnownUser": false // true if address belongs to registered user
  }
}
```

### Response (VietQR Bank)

```json
{
  "qrType": "OFFCHAIN_BANK",
  "bankInfo": {
    "country": "VN",
    "bankBin": "970436",
    "bankName": "Vietcombank",
    "accountNumber": "1234567890",
    "accountName": "TRAN VAN B",
    "amount": 500000, // Optional: Amount specified in QR
    "memo": "Payment for order" // Optional: Memo from QR
  }
}
```

### Error Handling

- **400 - Bad Request:**
  - If QR format is not recognized.
  - If VietQR parsing fails.

- **404 - Not Found:**
  - If PayPath username does not exist.

---

# 6. KYC MODULE

## 6.1 Get KYC Link

As an **Authenticated User**,

I want the API endpoint

`POST /kyc/get-link`

to get a WebSDK URL from Gaian to complete my KYC verification.

### Acceptance Criteria / Features

1. **Gaian Integration**
   - Call Gaian API to generate KYC link.
   - Link is unique per wallet address.
   - Link has expiration time.

### Payload

```json
{
  "walletAddress": "0x1234...abcd" // Required: User's registered wallet
}
```

### Response

```json
{
  "walletAddress": "0x1234...abcd",
  "kycLink": "https://kyc.gaian.network/verify?token=...",
  "expiresAt": "2026-01-25T11:00:00Z"
}
```

### Error Handling

- **404 - Not Found:**
  - If user with wallet address not found.

- **500 - Internal Server Error:**
  - Code: `GAIAN_KYC_LINK_FAILED`
  - If Gaian API fails.

---

## 6.2 Get KYC Status

As an **Authenticated User**,

I want the API endpoint

`GET /kyc/status`

to check my current KYC verification status.

### Acceptance Criteria / Features

1. **Gaian Sync**
   - Fetch latest KYC status from Gaian API.
   - Update local database with new status.
   - Sync firstName, lastName if KYC approved.

### Query Parameters

| Parameter       | Type   | Required | Description           |
| --------------- | ------ | -------- | --------------------- |
| `walletAddress` | string | ✅       | User's wallet address |

### Response

```json
{
  "userId": "uuid-here",
  "username": "alice",
  "walletAddress": "0x1234...abcd",
  "kycStatus": "approved", // "not started" | "pending" | "approved" | "rejected"
  "firstName": "Alice",
  "lastName": "Wong",
  "canTransfer": true // true if kycStatus === "approved"
}
```

---

## 6.3 KYC Webhook

As the **System (Gaian Callback)**,

I want the API endpoint

`POST /kyc/webhook`

to receive KYC status updates from Gaian when a user completes or fails verification.

### Acceptance Criteria / Features

1. **Webhook Validation**
   - Accept webhook payload from Gaian.
   - Validate required fields.

2. **Status Update**
   - Find user by wallet address.
   - Update kycStatus, firstName, lastName.

### Payload (from Gaian)

```json
{
  "walletAddress": "0x1234...abcd",
  "kycStatus": "approved",
  "firstName": "Alice",
  "lastName": "Wong",
  "timestamp": "2026-01-25T10:00:00Z"
}
```

### Response

```json
{
  "success": true,
  "userId": "uuid-here",
  "username": "alice",
  "kycStatus": "approved",
  "message": "KYC status updated successfully"
}
```

### Error Handling

- **400 - Bad Request:**
  - Code: `INVALID_WEBHOOK_PAYLOAD`
  - If `walletAddress` is missing.

- **404 - Not Found:**
  - If user not found for wallet address.

---

# 7. PAYMENTS MODULE

## 7.1 Create Order

As an **Authenticated User**,

I want the API endpoint

`POST /payments/orders`

to create a new payment order that converts USDC to fiat and sends to a bank account.

### Acceptance Criteria / Features

1. **Payload Validation**
   - The API must accept `qrString`, `usdcAmount`, `payerWalletAddress`.
   - `usdcAmount` must be positive number.
   - `qrString` must be valid VietQR format.

2. **KYC Validation**
   - Check user's KYC status before creating order.
   - Apply threshold limits based on KYC status.

3. **Exchange Calculation**
   - Call Gaian API to get exchange rate.
   - Calculate fiat amount from USDC.
   - Calculate platform fees.

4. **Order Creation**
   - Create order with status `AWAITING_USER_PAYMENT`.
   - Store partner wallet address for user to send USDC.

### Payload

```json
{
  "qrString": "00020101021138...", // Required: VietQR for recipient bank
  "usdcAmount": 10.5, // Required: USDC to convert (min: 0.01)
  "payerWalletAddress": "0x1234...abcd", // Required: Sender's wallet
  "fiatCurrency": "VND", // Optional: Default VND
  "country": "VN", // Optional: Default VN
  "recipientCountry": "VN", // Optional: For threshold rules
  "clientRequestId": "unique-id-123" // Optional: Idempotency key
}
```

### Response (Success - 201)

```json
{
  "orderId": "cuid-order-id",
  "status": "AWAITING_USER_PAYMENT",
  "instruction": {
    "message": "Please transfer USDC to the partner wallet",
    "partnerWalletAddress": "0xPartner...",
    "expectedAmount": "10500000", // Raw USDC amount (6 decimals)
    "coinType": "0x...::usdc::USDC"
  },
  "fiatAmount": 262500, // VND amount
  "fiatCurrency": "VND",
  "exchangeRate": 25000,
  "fees": {
    "platformFeeRate": 0.002,
    "platformFeeAmount": 525,
    "payoutFeeRate": 0.003,
    "payoutFeeAmount": 787.5
  },
  "recipientBank": {
    "bankName": "Vietcombank",
    "accountNumber": "1234567890",
    "accountName": "TRAN VAN B"
  },
  "createdAt": "2026-01-25T10:00:00Z"
}
```

### Error Handling

- **400 - Bad Request:**
  - If `qrString` is invalid.
  - If `usdcAmount` is below minimum.
  - If required fields are missing.
  - If daily limit exceeded (non-KYC users).

- **401 - Unauthorized:**
  - If not authenticated.

- **403 - Forbidden:**
  - If KYC is rejected.
  - If user is blacklisted.

- **409 - Conflict:**
  - If `clientRequestId` already used (duplicate order prevention).

---

## 7.2 Quote Exchange

As an **Authenticated User**,

I want the API endpoint

`POST /payments/quote`

to get an exchange quote without creating an order.

### Acceptance Criteria / Features

1. **Direction Support**
   - `FIAT_TO_USDC`: Convert fiat amount to USDC.
   - `USDC_TO_FIAT`: Convert USDC amount to fiat.

2. **Gaian Integration**
   - Call Gaian calculateExchange API.
   - Return exchange rate and fee breakdown.

### Payload (FIAT to USDC)

```json
{
  "direction": "FIAT_TO_USDC",
  "fiatAmount": 500000, // Required for this direction
  "country": "VN",
  "token": "USDC"
}
```

### Payload (USDC to FIAT)

```json
{
  "direction": "USDC_TO_FIAT",
  "usdcAmount": "20.0", // Required for this direction
  "country": "VN",
  "token": "USDC"
}
```

### Response

```json
{
  "direction": "USDC_TO_FIAT",
  "inputAmount": "20.0",
  "inputCurrency": "USDC",
  "outputAmount": 500000,
  "outputCurrency": "VND",
  "exchangeRate": 25000,
  "fees": {
    "feeAmount": 1000,
    "feePercentage": 0.002
  },
  "finalAmount": 499000, // After fees
  "validUntil": "2026-01-25T10:05:00Z" // Quote expiration
}
```

---

## 7.3 Confirm User Payment

As an **Authenticated User**,

I want the API endpoint

`POST /payments/orders/:id/confirm-user-payment`

to confirm that I have sent USDC on-chain and trigger the fiat payout.

### Acceptance Criteria / Features

1. **Transaction Verification**
   - Verify on-chain transaction via Sui RPC.
   - Check sender, recipient, amount match order.
   - Mark transaction as verified.

2. **Gaian Payout Trigger**
   - Call Gaian placeOrder/prefund API.
   - Transition order to `CONFIRMING_GAIAN_PAYMENT`.

3. **Idempotency**
   - Only trigger Gaian payout once per order.
   - Ignore duplicate confirm calls.

### Path Parameters

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Order ID    |

### Payload

```json
{
  "userPaymentTxDigest": "5Hh9gNq...txDigest" // Sui transaction digest
}
```

### Response

```json
{
  "orderId": "cuid-order-id",
  "status": "CONFIRMING_GAIAN_PAYMENT",
  "userPaymentVerifiedAt": "2026-01-25T10:05:00Z",
  "gaianOrderId": "gaian-order-123",
  "message": "Payment verified, fiat payout initiated"
}
```

### Error Handling

- **400 - Bad Request:**
  - If transaction not found on-chain.
  - If transaction amount doesn't match.
  - If order not in `AWAITING_USER_PAYMENT` status.

- **404 - Not Found:**
  - If order does not exist.

- **500 - Internal Server Error:**
  - If Gaian payout API fails.

---

## 7.4 Sync Order Status

As an **Authenticated User**,

I want the API endpoint

`POST /payments/orders/:id/sync`

to fetch the latest order status from Gaian and update locally.

### Response

```json
{
  "orderId": "cuid-order-id",
  "status": "COMPLETED",
  "bankTransferStatus": "COMPLETED",
  "gaianStatus": {
    "status": "completed",
    "bankTransactionReference": "VCB123456789"
  },
  "syncedAt": "2026-01-25T10:10:00Z"
}
```

---

## 7.5 Get Order Details

As an **Authenticated User**,

I want the API endpoint

`GET /payments/orders/:id`

to view complete details of a specific order.

### Response

```json
{
  "orderId": "cuid-order-id",
  "gaianOrderId": "gaian-order-123",
  "status": "COMPLETED",
  "payerWalletAddress": "0x1234...abcd",
  "partnerWalletAddress": "0xPartner...",
  "cryptoCurrency": "USDC",
  "expectedCryptoAmount": "10.5",
  "fiatAmount": 262500,
  "fiatCurrency": "VND",
  "exchangeRate": 25000,
  "recipientBank": {
    "bankName": "Vietcombank",
    "accountNumber": "1234567890",
    "accountName": "TRAN VAN B"
  },
  "fees": {
    "hiddenWalletFeeRate": 0.002,
    "hiddenWalletFeeAmount": 0.021,
    "payoutFeeRate": 0.003,
    "payoutFeeAmountFiat": 787.5
  },
  "bankTransferStatus": "COMPLETED",
  "bankTransactionReference": "VCB123456789",
  "userPaymentTxDigest": "5Hh9gNq...",
  "userPaymentVerifiedAt": "2026-01-25T10:05:00Z",
  "createdAt": "2026-01-25T10:00:00Z",
  "updatedAt": "2026-01-25T10:10:00Z"
}
```

---

## 7.6 Get User Order History

As an **Authenticated User**,

I want the API endpoint

`GET /payments/users/:wallet/orders`

to view my transaction history.

### Path Parameters

| Parameter | Type   | Description           |
| --------- | ------ | --------------------- |
| `wallet`  | string | User's wallet address |

### Query Parameters

| Parameter | Type   | Default | Description      |
| --------- | ------ | ------- | ---------------- |
| `page`    | number | 1       | Page number      |
| `limit`   | number | 20      | Items per page   |
| `status`  | string | -       | Filter by status |

### Response

```json
{
  "page": 1,
  "limit": 20,
  "total": 45,
  "orders": [
    {
      "orderId": "cuid-1",
      "status": "COMPLETED",
      "fiatAmount": 262500,
      "fiatCurrency": "VND",
      "cryptoAmount": "10.5",
      "recipientBank": "Vietcombank ****7890",
      "createdAt": "2026-01-25T10:00:00Z"
    }
    // ... more orders
  ]
}
```

---

# Appendix: Error Code Reference

| Code                               | HTTP | Description                                   |
| ---------------------------------- | ---- | --------------------------------------------- |
| `WALLET_ALREADY_REGISTERED`        | 409  | Wallet address already linked to another user |
| `BANK_ALREADY_REGISTERED`          | 409  | Bank account already linked to another user   |
| `CANNOT_DELETE_DEFAULT_WALLET`     | 400  | Cannot delete default wallet                  |
| `CANNOT_DELETE_DEFAULT_BANK`       | 400  | Cannot delete default bank account            |
| `GAIAN_KYC_LINK_FAILED`            | 500  | Failed to get KYC link from Gaian             |
| `GAIAN_KYC_STATUS_FAILED`          | 500  | Failed to get KYC status from Gaian           |
| `GAIAN_REGISTER_USER_FAILED`       | 500  | Failed to register user with Gaian            |
| `GAIAN_GET_USER_INFO_FAILED`       | 500  | Failed to get user info from Gaian            |
| `GAIAN_CALCULATE_EXCHANGE_FAILED`  | 500  | Failed to calculate exchange rate             |
| `GAIAN_PLACE_ORDER_PREFUND_FAILED` | 500  | Failed to create payout order                 |
| `BALANCE_QUERY_FAILED`             | 500  | Failed to query blockchain balance            |
| `INVALID_WEBHOOK_PAYLOAD`          | 400  | Webhook payload missing required fields       |
| `USER_NOT_FOUND`                   | 404  | User does not exist                           |
| `KYC_NOT_APPROVED`                 | 403  | KYC verification required                     |
