/*
  Warnings:

  - You are about to drop the column `gaian_user_id` on the `onchain_wallets` table. All the data in the column will be lost.
  - You are about to drop the column `gaian_user_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "onchain_wallets" DROP COLUMN "gaian_user_id";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "gaian_user_id";

-- DropTable
DROP TABLE "audit_logs";
