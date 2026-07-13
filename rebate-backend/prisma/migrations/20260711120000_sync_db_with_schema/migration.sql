-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- AlterTable
ALTER TABLE "ib_nodes" ADD COLUMN     "accountType" TEXT NOT NULL DEFAULT 'SEA STD',
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentInfo" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profileUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "account_type_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_type_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markup_link_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "share" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markup_link_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "ibId" TEXT NOT NULL,
    "balance" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "ibId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "note" TEXT,
    "rejectedReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_type_templates_ownerId_idx" ON "account_type_templates"("ownerId");

-- CreateIndex
CREATE INDEX "markup_link_templates_ownerId_idx" ON "markup_link_templates"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_ibId_key" ON "wallets"("ibId");

-- CreateIndex
CREATE INDEX "payouts_ibId_idx" ON "payouts"("ibId");

-- CreateIndex
CREATE INDEX "payouts_walletId_idx" ON "payouts"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "ib_nodes_referralCode_key" ON "ib_nodes"("referralCode");

-- AddForeignKey
ALTER TABLE "account_type_templates" ADD CONSTRAINT "account_type_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markup_link_templates" ADD CONSTRAINT "markup_link_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_ibId_fkey" FOREIGN KEY ("ibId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_ibId_fkey" FOREIGN KEY ("ibId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "ib_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
