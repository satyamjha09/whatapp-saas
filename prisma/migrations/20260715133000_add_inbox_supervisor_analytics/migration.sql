-- CreateTable
CREATE TABLE "InboxAgentMetricDaily" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queueId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "assignedCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "averageFirstResponseSec" INTEGER,
    "p50FirstResponseSec" INTEGER,
    "p90FirstResponseSec" INTEGER,
    "averageResolutionSec" INTEGER,
    "slaMetCount" INTEGER NOT NULL DEFAULT 0,
    "slaBreachedCount" INTEGER NOT NULL DEFAULT 0,
    "csatScoreSum" INTEGER NOT NULL DEFAULT 0,
    "csatResponseCount" INTEGER NOT NULL DEFAULT 0,
    "availableSeconds" INTEGER NOT NULL DEFAULT 0,
    "busySeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxAgentMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboxAgentMetricDaily_companyId_userId_queueId_date_key" ON "InboxAgentMetricDaily"("companyId", "userId", "queueId", "date");

-- CreateIndex
CREATE INDEX "InboxAgentMetricDaily_companyId_date_idx" ON "InboxAgentMetricDaily"("companyId", "date");

-- CreateIndex
CREATE INDEX "InboxAgentMetricDaily_userId_date_idx" ON "InboxAgentMetricDaily"("userId", "date");

-- CreateIndex
CREATE INDEX "InboxAgentMetricDaily_queueId_date_idx" ON "InboxAgentMetricDaily"("queueId", "date");

-- AddForeignKey
ALTER TABLE "InboxAgentMetricDaily" ADD CONSTRAINT "InboxAgentMetricDaily_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAgentMetricDaily" ADD CONSTRAINT "InboxAgentMetricDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAgentMetricDaily" ADD CONSTRAINT "InboxAgentMetricDaily_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
