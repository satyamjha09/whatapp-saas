-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "integrityHash" TEXT,
ADD COLUMN     "integrityVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "previousIntegrityHash" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_integrityHash_idx" ON "AuditLog"("integrityHash");

-- CreateIndex
CREATE INDEX "AuditLog_previousIntegrityHash_idx" ON "AuditLog"("previousIntegrityHash");
