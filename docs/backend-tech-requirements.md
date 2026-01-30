# Backend Technical Requirements

## 1. Tổng Quan Hệ Thống

### 1.1 Mô Tả

- **Tên dự án:** Sui Payment Backend
- **Mục đích:** Hệ thống thanh toán tích hợp blockchain Sui với ngân hàng truyền thống
- **Kiến trúc:** RESTful API với NestJS framework

### 1.2 Tính Năng Chính

- Quản lý user và multi-wallet (onchain + offchain)
- KYC integration qua Gaian API
- Thanh toán onchain (Sui blockchain) và offchain (bank transfer)
- Hệ thống referral và loyalty points
- ZK-Login authentication

---

## 2. Yêu Cầu Hệ Thống

### 2.1 Runtime Environment

- **Node.js:** v18.x trở lên (LTS recommended)
- **npm:** v9.x trở lên
- **Operating System:** Linux, macOS, hoặc Windows

### 2.2 Database

- **PostgreSQL:** v16.x
- **Connection:** TCP port 5432

### 2.3 Docker Services

- **PostgreSQL container:** sui_payment_db
- **zkLogin Prover:** mysten/zklogin:prover-stable
- **zkLogin Prover FE:** mysten/zklogin:prover-fe-stable (port 8082)

---

## 3. Tech Stack Chi Tiết

### 3.1 Core Framework

- **NestJS** v11.1.12
  - Modular architecture
  - Dependency injection
  - Built-in TypeScript support
- **TypeScript** v5.9.3
  - Strict mode enabled
  - ES module support
- **Express** (via @nestjs/platform-express) v11.1.12

### 3.2 Database & ORM

- **PostgreSQL** v16
  - UUID primary keys
  - JSON fields support
  - Decimal precision handling
- **Prisma ORM** v6.19.2
  - Type-safe database queries
  - Auto-generated client
  - Database migrations
  - Seeding support

### 3.3 Authentication & Authorization

- **@nestjs/passport** v11.0.5
  - Passport middleware integration
- **passport** v0.7.0
  - Authentication framework
- **passport-jwt** v4.0.1
  - JWT strategy for authentication
- **@nestjs/jwt** v11.0.2
  - JWT token generation/validation
- **jose** v6.1.3
  - JWT/JWE/JWS operations
  - zkLogin token handling

### 3.4 Validation & Transformation

- **class-validator** v0.14.3
  - DTO validation decorators
  - Request payload validation
- **class-transformer** v0.5.1
  - Object serialization/deserialization
  - Response transformation

### 3.5 API Documentation

- **@nestjs/swagger** v11.2.5
  - OpenAPI specification generation
  - Automatic API documentation
- **swagger-ui-express** v5.0.1
  - Interactive API documentation UI

### 3.6 HTTP Client

- **axios** v1.13.2
  - HTTP client for external APIs
- **@nestjs/axios** v4.0.1
  - NestJS Axios module integration

### 3.7 Blockchain Integration

- **@mysten/sui** v1.45.2
  - Official Sui SDK
  - Transaction building
  - RPC client
- **@mysten/sui.js** v0.54.1
  - Sui utilities
  - Crypto operations

### 3.8 Payment Integration

- **vietqr** v1.1.9
  - VietQR standard parsing
  - QR code generation/validation
- **Gaian API**
  - Payment processing
  - KYC verification
  - User management

### 3.9 Utilities

- **rxjs** v7.8.2
  - Reactive programming
  - Observable patterns
- **@nestjs/schedule** v6.1.0
  - Cron jobs
  - Scheduled tasks
- **@nestjs/config** v4.0.2
  - Environment configuration
  - Config validation
- **reflect-metadata** v0.2.2
  - Decorator metadata

---

## 4. Cấu Trúc Project

### 4.1 Directory Structure

```
src/
├── app.module.ts          # Root module
├── app.controller.ts      # Root controller
├── app.service.ts         # Root service
├── main.ts                # Application entry point
├── auth/                  # Authentication module
├── common/                # Shared utilities
├── config/                # Configuration module
├── gaian/                 # Gaian API client
├── modules/
│   ├── users/             # User management
│   ├── wallets/           # Wallet management
│   ├── kyc/               # KYC verification
│   ├── transfer/          # Transfer operations
│   └── payment-methods/   # Payment methods
├── payments/              # Payment processing
├── prisma/                # Prisma service
├── prover/                # zkLogin prover
└── sui/                   # Sui blockchain utilities
```

### 4.2 Module Dependencies

- **AppModule** - Root module, imports tất cả modules
- **AuthModule** - JWT authentication, zkLogin
- **UsersModule** - User CRUD, profile management
- **WalletsModule** - Onchain/offchain wallet management
- **KycModule** - Gaian KYC integration
- **TransferModule** - Transfer operations
- **PaymentsModule** - Order processing
- **GaianModule** - Gaian API client
- **ProverModule** - zkLogin prover client
- **SuiModule** - Sui blockchain operations

---

## 5. Database Schema

### 5.1 Models

#### User

- `id` - UUID primary key
- `username` - Unique username (nullable)
- `walletAddress` - Current wallet address
- `gaianRegisteredWallet` - Primary wallet for Gaian KYC
- `email` - Email address (nullable)
- `kycStatus` - KYC verification status
- `firstName`, `lastName` - User name from KYC
- `referrerId` - Referrer user ID
- `loyaltyPoints` - Accumulated loyalty points
- `commissionBalance` - Referral commission
- `isActive` - Account status

#### OnchainWallet

- `id` - UUID primary key
- `userId` - Owner user ID
- `address` - Blockchain wallet address
- `chain` - Blockchain network
- `walletProvider` - Wallet type
- `kycStatus` - Wallet KYC status
- `isDefault` - Default wallet flag

#### OffchainWallet

- `id` - UUID primary key
- `userId` - Owner user ID
- `country` - Bank country
- `bankBin` - Bank identification number
- `bankName` - Bank name
- `accountNumber` - Account number
- `accountName` - Account holder name
- `qrString` - VietQR string
- `isDefault` - Default wallet flag

#### Order

- `id` - CUID primary key
- `gaianOrderId` - Gaian order reference
- `payerWalletAddress` - Payer wallet
- `partnerWalletAddress` - Merchant wallet
- `cryptoCurrency`, `coinType` - Crypto details
- `fiatAmount`, `fiatCurrency` - Fiat details
- `status` - Order status enum
- `bankTransferStatus` - Bank transfer status enum
- `exchangeRate` - Applied exchange rate

#### PaymentTarget

- `id` - CUID primary key
- `username` - Merchant username
- `qrString` - Payment QR code
- `fiatCurrency` - Accepted currency

#### AuthNonce

- `id` - CUID primary key
- `address` - Wallet address
- `nonce` - Random nonce
- `expiresAt` - Expiration time

#### ZkLoginSalt

- `id` - CUID primary key
- `provider` - OAuth provider
- `providerSub` - Provider subject ID
- `userSaltB64` - Base64 encoded salt

### 5.2 Enums

#### OrderStatus

- AWAITING_USER_PAYMENT
- USER_PAYMENT_VERIFIED
- CONFIRMING_GAIAN_PAYMENT
- CONFIRMED_GAIAN_PAYMENT
- COMPLETED
- FAILED
- PENDING

#### BankTransferStatus

- QUEUED
- PROCESSING
- COMPLETED
- FAILED

---

## 6. Environment Variables

### 6.1 Server

- `PORT` - Server port (default: 3000)

### 6.2 Database

- `DATABASE_URL` - PostgreSQL connection string

### 6.3 Authentication

- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - JWT expiration time
- `AUTH_DOMAIN` - Auth domain URL
- `AUTH_CHALLENGE_TTL_SECONDS` - Auth challenge TTL

### 6.4 Gaian Integration

- `GAIAN_PAYMENT_BASE_URL` - Gaian payment API URL
- `GAIAN_USER_BASE_URL` - Gaian user API URL
- `GAIAN_API_KEY` - Gaian API key
- `GAIAN_QR_BASE_URL` - Gaian QR API URL
- `GAIAN_QR_API_KEY` - Gaian QR API key

### 6.5 Sui Blockchain

- `SUI_RPC_URL` - Sui RPC endpoint
- `SUI_USDC_COIN_TYPE` - USDC coin type address
- `SUI_USDC_DECIMALS` - USDC decimals
- `PARTNER_SUI_ADDRESS` - Merchant wallet address

### 6.6 zkLogin

- `ZKLOGIN_PROVER_FE_URL` - zkLogin prover URL
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_ISSUERS` - Google issuer URL

### 6.7 Fees

- `HIDDEN_WALLET_FEE_PERCENT` - Platform fee percentage

### 6.8 Loyalty & Referral

- `TIER_PLUS_THRESHOLD` - Plus tier threshold (300 points)
- `TIER_PREMIUM_THRESHOLD` - Premium tier threshold (700 points)
- `TIER_ELITE_THRESHOLD` - Elite tier threshold (1150 points)
- `TIER_STANDARD_COMMISSION` - Standard tier commission (15%)
- `TIER_PLUS_COMMISSION` - Plus tier commission (30%)
- `TIER_PREMIUM_COMMISSION` - Premium tier commission (45%)
- `TIER_ELITE_COMMISSION` - Elite tier commission (60%)
- `POINTS_OVER_50_USD` - Points for $50+ transactions (10 points)
- `POINTS_DAILY_3_TX` - Points for 3 daily transactions (50 points)
- `POINTS_WEEKLY_15_TX` - Points for 15 weekly transactions (100 points)
- `POINTS_MONTHLY_50_TX` - Points for 50 monthly transactions (300 points)
- `POINTS_REFERRAL_BONUS` - Referral bonus points (50 points)
- `MAX_REFERRAL_POINTS_PER_PERIOD` - Max referral points per period (500 points)

---

## 7. API Endpoints

### 7.1 Authentication

- `POST /auth/challenge` - Request auth challenge
- `POST /auth/login` - Login with signature
- `POST /auth/register` - Register new user
- `POST /auth/zklogin/*` - zkLogin endpoints

### 7.2 Users

- `GET /users/profile` - Get user profile
- `PATCH /users/profile` - Update profile
- `GET /users/referral` - Get referral info

### 7.3 Wallets

- `GET /wallets` - List wallets
- `POST /wallets/onchain` - Add onchain wallet
- `POST /wallets/offchain` - Add offchain wallet
- `DELETE /wallets/:id` - Remove wallet

### 7.4 KYC

- `GET /kyc/status` - Get KYC status
- `POST /kyc/submit` - Submit KYC

### 7.5 Payments

- `POST /payments/orders` - Create order
- `GET /payments/orders` - List orders
- `GET /payments/orders/:id` - Get order
- `POST /payments/verify` - Verify payment

### 7.6 Transfers

- `POST /transfer/onchain` - Onchain transfer
- `POST /transfer/offchain` - Offchain transfer
- `POST /transfer/scan-qr` - Scan QR code

---

## 8. Deployment

### 8.1 Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Start development server
npm run start:dev
```

### 8.2 Docker

```bash
# Start all services
docker-compose up -d

# Services included:
# - PostgreSQL (port 5432)
# - zkLogin Prover
# - zkLogin Prover FE (port 8082)
```

### 8.3 Production

```bash
# Build
npm run build

# Start production server
npm run start
```

---

## 9. Security Requirements

### 9.1 Authentication

- JWT-based authentication
- Wallet signature verification
- zkLogin support với Google OAuth

### 9.2 Authorization

- Route guards với Passport
- KYC verification cho sensitive operations

### 9.3 Data Protection

- Environment variables cho secrets
- Database credentials không commit vào repo
- HTTPS trong production

---

## 10. Monitoring & Logging

### 10.1 Logging

- NestJS built-in logger
- Request/response logging
- Error tracking

### 10.2 Health Check

- Database connectivity check
- External API health check

---

## 11. Third-party Integrations

### 11.1 Gaian

- **Purpose:** KYC, User management, Payment processing
- **Base URLs:**
  - Payment: https://dev-payments.gaian-dev.network
  - User: https://dev-user.gaian-dev.network
- **Authentication:** API Key

### 11.2 Sui Blockchain

- **Purpose:** Onchain transactions, USDC transfers
- **Network:** Testnet/Mainnet
- **RPC:** https://fullnode.testnet.sui.io:443

### 11.3 VietQR

- **Purpose:** Vietnam bank QR code standard
- **Features:** QR parsing, bank info lookup

### 11.4 Google OAuth

- **Purpose:** zkLogin authentication
- **Issuer:** https://accounts.google.com
