-- CreateTable
CREATE TABLE "SystemMaintenanceMode" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemMaintenanceMode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemMaintenanceMode_enabled_idx" ON "SystemMaintenanceMode"("enabled");
