-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_USER_PAYMENT', 'USER_PAYMENT_VERIFIED', 'GAIAN_PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankTransferStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "email" TEXT,
    "gaian_user_id" TEXT,
    "kyc_status" TEXT NOT NULL DEFAULT 'not started',
    "first_name" TEXT,
    "last_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onchain_wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "label" TEXT,
    "wallet_provider" TEXT,
    "kyc_status" TEXT NOT NULL DEFAULT 'not started',
    "gaian_user_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onchain_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offchain_wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "country" TEXT NOT NULL,
    "bank_bin" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "label" TEXT,
    "qr_string" TEXT NOT NULL,
    "qr_parsed_data" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offchain_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipient_username" TEXT NOT NULL,
    "recipient_user_id" UUID,
    "label" TEXT,
    "last_transfer_at" TIMESTAMP(3),
    "transfer_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_targets" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "qrString" TEXT NOT NULL,
    "fiatCurrency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "gaianOrderId" TEXT,
    "username" TEXT NOT NULL,
    "paymentTargetId" TEXT,
    "payerWalletAddress" TEXT NOT NULL,
    "partnerWalletAddress" TEXT NOT NULL,
    "cryptoCurrency" TEXT NOT NULL,
    "coinType" TEXT NOT NULL,
    "expectedCryptoAmountRaw" TEXT NOT NULL,
    "userPaymentTxDigest" TEXT,
    "userPaymentVerifiedAt" TIMESTAMP(3),
    "fiatAmount" DECIMAL(18,2) NOT NULL,
    "fiatCurrency" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_USER_PAYMENT',
    "bankTransferStatus" "BankTransferStatus",
    "bankTransactionReference" JSONB,
    "exchangeRate" DECIMAL(18,8),
    "gaianRaw" JSONB,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "onchain_wallets_user_id_idx" ON "onchain_wallets"("user_id");

-- CreateIndex
CREATE INDEX "onchain_wallets_is_default_idx" ON "onchain_wallets"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "onchain_wallets_chain_address_key" ON "onchain_wallets"("chain", "address");

-- CreateIndex
CREATE INDEX "offchain_wallets_user_id_idx" ON "offchain_wallets"("user_id");

-- CreateIndex
CREATE INDEX "offchain_wallets_is_default_idx" ON "offchain_wallets"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "offchain_wallets_country_bank_bin_account_number_key" ON "offchain_wallets"("country", "bank_bin", "account_number");

-- CreateIndex
CREATE INDEX "contacts_user_id_idx" ON "contacts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_recipient_username_key" ON "contacts"("user_id", "recipient_username");

-- CreateIndex
CREATE UNIQUE INDEX "payment_targets_username_key" ON "payment_targets"("username");

-- CreateIndex
CREATE UNIQUE INDEX "orders_gaianOrderId_key" ON "orders"("gaianOrderId");

-- CreateIndex
CREATE INDEX "orders_payerWalletAddress_idx" ON "orders"("payerWalletAddress");

-- CreateIndex
CREATE INDEX "orders_username_idx" ON "orders"("username");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_payerWalletAddress_clientRequestId_key" ON "orders"("payerWalletAddress", "clientRequestId");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "onchain_wallets" ADD CONSTRAINT "onchain_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offchain_wallets" ADD CONSTRAINT "offchain_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_paymentTargetId_fkey" FOREIGN KEY ("paymentTargetId") REFERENCES "payment_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
