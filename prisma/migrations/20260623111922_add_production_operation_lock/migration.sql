-- CreateEnum
CREATE TYPE "ProductionOperationType" AS ENUM ('DEPLOY', 'ROLLBACK', 'BACKUP', 'RESTORE', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "ProductionOperationLock" (
    "id" TEXT NOT NULL,
    "operationType" "ProductionOperationType" NOT NULL,
    "lockOwner" TEXT,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOperationLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionOperationLock_operationType_idx" ON "ProductionOperationLock"("operationType");

-- CreateIndex
CREATE INDEX "ProductionOperationLock_expiresAt_idx" ON "ProductionOperationLock"("expiresAt");
