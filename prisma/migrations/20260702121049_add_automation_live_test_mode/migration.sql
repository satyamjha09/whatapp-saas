-- CreateEnum
CREATE TYPE "AutomationTestRunStatus" AS ENUM ('RUNNING', 'WAITING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AutomationTestStepStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'WAITING', 'SKIPPED');

-- CreateTable
CREATE TABLE "AutomationTestRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "status" "AutomationTestRunStatus" NOT NULL DEFAULT 'RUNNING',
    "graph" JSONB NOT NULL,
    "simulatedContact" JSONB NOT NULL,
    "context" JSONB,
    "currentNodeId" TEXT,
    "waitingForReply" BOOLEAN NOT NULL DEFAULT false,
    "waitingNodeId" TEXT,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTestStep" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "AutomationTestStepStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationTestStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationTestRun_companyId_idx" ON "AutomationTestRun"("companyId");

-- CreateIndex
CREATE INDEX "AutomationTestRun_companyId_flowId_idx" ON "AutomationTestRun"("companyId", "flowId");

-- CreateIndex
CREATE INDEX "AutomationTestRun_status_idx" ON "AutomationTestRun"("status");

-- CreateIndex
CREATE INDEX "AutomationTestRun_createdByUserId_idx" ON "AutomationTestRun"("createdByUserId");

-- CreateIndex
CREATE INDEX "AutomationTestStep_companyId_idx" ON "AutomationTestStep"("companyId");

-- CreateIndex
CREATE INDEX "AutomationTestStep_testRunId_idx" ON "AutomationTestStep"("testRunId");

-- CreateIndex
CREATE INDEX "AutomationTestStep_nodeId_idx" ON "AutomationTestStep"("nodeId");

-- AddForeignKey
ALTER TABLE "AutomationTestStep" ADD CONSTRAINT "AutomationTestStep_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "AutomationTestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
