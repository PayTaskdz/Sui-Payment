# Sui Payment Backend

## 🚀 Project Overview

This project is the backend service for a hybrid payment platform that bridges the gap between decentralized finance (DeFi) on the Sui blockchain and traditional fiat payment systems. It is designed to facilitate seamless cross-border payments, allowing users to pay with cryptocurrency (like USDC on Sui) and have the recipient receive fiat currency (like VND) in their bank account.

The system manages the entire lifecycle of a payment order, from quote generation to final settlement. It integrates with external services for real-time exchange rates and payment processing, while handling user authentication, profile management, and a multi-tiered referral and commission structure internally.

Authentication is a key feature, supporting both traditional cryptographic signatures from Sui wallets and modern, user-friendly social logins via zkLogin with Google. This dual approach caters to both crypto-native users and a broader audience less familiar with blockchain wallets.

## ✨ Key Features

- **Hybrid Payment Processing**: Manages orders that convert cryptocurrency (USDC) to fiat currency (VND, PHP, etc.) for bank payouts.
- **Dual Authentication System**:
  - **Wallet-based Auth**: Standard `signPersonalMessage` flow for Sui wallets.
  - **zkLogin Auth**: Google social login integration for enhanced accessibility, using zero-knowledge proofs.
- **User & Wallet Management**: Full CRUD for user profiles, on-chain (Sui) wallets, and off-chain (bank) accounts.
- **Referral & Commission System**: Rewards users for referring others by granting them a commission calculated from the platform fees of their referees' transactions.
- **Dynamic Quoting**: Provides real-time quotes for crypto-to-fiat swaps, including platform fees.
- **External Service Integration**: Connects with the Gaian API for exchange rates and payment execution.
- **Database Management**: Uses Prisma ORM for robust and type-safe database interactions with a PostgreSQL backend.
- **API Documentation**: Auto-generated and interactive API documentation via Swagger (OpenAPI).

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Blockchain**: Sui SDK (`@mysten/sui.js`)
- **Authentication**: JWT, `signPersonalMessage`, zkLogin
- **API Docs**: Swagger

## 📦 Prerequisites

- Node.js (v18 or newer)
- pnpm (recommended package manager)
- PostgreSQL (v14 or newer)
- Docker (optional, for local database setup)

## 🔧 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd sui-payment
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Copy the example environment file and fill in the required values. The backend will not start without a valid `.env` file.

```bash
cp .env.example .env
```

**Key variables in `.env`:**

```env
# Database connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# JWT configuration
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=1d

# Sui Network (e.g., 'testnet', 'mainnet')
SUI_NETWORK=testnet

# External APIs
GAIAN_API_KEY=your_gaian_api_key
GAIAN_BASE_URL=https://api.gaian.network

# Business Logic
PAYOUT_FEE_PERCENT=2
```

## 🚦 Running the Application

- **Development Mode** (with hot-reloading):
  ```bash
  pnpm start:dev
  ```

- **Production Mode**:
  ```bash
  pnpm build
  pnpm start:prod
  ```

The server will start on `http://localhost:3000` by default.

## 🗄️ Database

This project uses Prisma for database management.

- **Generate Prisma Client** (after any `schema.prisma` changes):
  ```bash
  npx prisma generate
  ```

- **Create a New Migration**:
  ```bash
  npx prisma migrate dev --name your-migration-name
  ```

- **Apply Migrations to a Database** (e.g., in production):
  ```bash
  npx prisma migrate deploy
  ```

- **Browse Your Database**:
  ```bash
  npx prisma studio
  ```

## 📚 API Documentation

Once the application is running, you can access the interactive Swagger API documentation at:

[http://localhost:3000/api](http://localhost:3000/api)