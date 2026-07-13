-- CreateEnum
CREATE TYPE "RebateType" AS ENUM ('STP_REBATE', 'CENT_REBATE', 'COMMISSION_PERCENT', 'STP_ADDED_POINTS', 'ECN_COPY_REBATE');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('D_FOREX', 'FOREX', 'GOLD', 'SILVER_5000', 'SILVER_1000', 'OIL', 'NATURE_GAS', 'COMMODITIES', 'HKG50', 'A50', 'JPN225', 'US_INDEX', 'SHARES', 'ETHEREUM', 'PRECIOUS_METAL', 'BITCOIN', 'CRYPTO', 'GAUCNH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'IB_JOINED', 'TRANSACTION_ADDED', 'REBATE_UPDATED', 'IB_DEACTIVATED', 'IB_RESTORED', 'MANUAL');

-- CreateTable
CREATE TABLE "ib_nodes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ib_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebate_configs" (
    "id" TEXT NOT NULL,
    "ibId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "rebateType" "RebateType" NOT NULL DEFAULT 'STP_REBATE',
    "rebatePips" DECIMAL(10,4) NOT NULL,
    "markupPips" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "markupPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "maxPips" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rebate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebate_transactions" (
    "id" TEXT NOT NULL,
    "ibId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "rebateType" "RebateType" NOT NULL DEFAULT 'STP_REBATE',
    "lots" DECIMAL(10,4) NOT NULL,
    "rebateAmount" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "tradedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rebate_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ibId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "senderId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebate_config_history" (
    "id" TEXT NOT NULL,
    "rebateConfigId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rebate_config_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ib_nodes_email_key" ON "ib_nodes"("email");

-- CreateIndex
CREATE INDEX "ib_nodes_parentId_idx" ON "ib_nodes"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "rebate_configs_ibId_assetType_rebateType_key" ON "rebate_configs"("ibId", "assetType", "rebateType");

-- CreateIndex
CREATE INDEX "rebate_transactions_ibId_tradedAt_idx" ON "rebate_transactions"("ibId", "tradedAt");

-- CreateIndex
CREATE INDEX "rebate_transactions_assetType_tradedAt_idx" ON "rebate_transactions"("assetType", "tradedAt");

-- CreateIndex
CREATE INDEX "rebate_transactions_createdById_idx" ON "rebate_transactions"("createdById");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_targetId_idx" ON "audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "notifications_recipientId_isRead_idx" ON "notifications"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_recipientId_createdAt_idx" ON "notifications"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "rebate_config_history_rebateConfigId_idx" ON "rebate_config_history"("rebateConfigId");

-- CreateIndex
CREATE INDEX "rebate_config_history_changedById_idx" ON "rebate_config_history"("changedById");

-- AddForeignKey
ALTER TABLE "ib_nodes" ADD CONSTRAINT "ib_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ib_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebate_configs" ADD CONSTRAINT "rebate_configs_ibId_fkey" FOREIGN KEY ("ibId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebate_transactions" ADD CONSTRAINT "rebate_transactions_ibId_fkey" FOREIGN KEY ("ibId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebate_transactions" ADD CONSTRAINT "rebate_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_ibId_fkey" FOREIGN KEY ("ibId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "ib_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebate_config_history" ADD CONSTRAINT "rebate_config_history_rebateConfigId_fkey" FOREIGN KEY ("rebateConfigId") REFERENCES "rebate_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebate_config_history" ADD CONSTRAINT "rebate_config_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "ib_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
