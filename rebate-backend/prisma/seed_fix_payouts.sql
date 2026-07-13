DO $$
BEGIN
  BEGIN
    CREATE TYPE "PayoutStatus" AS ENUM ('PENDING','APPROVED','REJECTED','PAID');
  EXCEPTION WHEN duplicate_object THEN
    -- type already exists, ignore
    NULL;
  END;
END
$$;

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  "ibId" TEXT UNIQUE NOT NULL,
  balance NUMERIC(18,8) NOT NULL DEFAULT 0,
  "totalEarned" NUMERIC(18,8) NOT NULL DEFAULT 0,
  "totalPaid" NUMERIC(18,8) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  "ibId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  amount NUMERIC(18,8) NOT NULL,
  status "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" TEXT,
  note TEXT,
  "rejectedReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "processedBy" TEXT
);

CREATE INDEX IF NOT EXISTS payouts_ibId_idx ON payouts("ibId");
CREATE INDEX IF NOT EXISTS payouts_walletId_idx ON payouts("walletId");

ALTER TABLE IF EXISTS payouts ADD CONSTRAINT payouts_ibId_fkey FOREIGN KEY ("ibId") REFERENCES ib_nodes(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE IF EXISTS payouts ADD CONSTRAINT payouts_walletId_fkey FOREIGN KEY ("walletId") REFERENCES wallets(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE IF EXISTS payouts ADD CONSTRAINT payouts_processedBy_fkey FOREIGN KEY ("processedBy") REFERENCES ib_nodes(id) ON DELETE SET NULL ON UPDATE CASCADE;
