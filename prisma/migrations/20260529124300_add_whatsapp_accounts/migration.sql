-- CreateEnum
CREATE TYPE "WhatsAppAccountStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "WhatsAppAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "wabaId" TEXT,
    "businessName" TEXT,
    "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppPhoneNumber" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "whatsAppAccountId" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "displayPhoneNumber" TEXT,
    "verifiedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppPhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAccount_wabaId_key" ON "WhatsAppAccount"("wabaId");

-- CreateIndex
CREATE INDEX "WhatsAppAccount_companyId_idx" ON "WhatsAppAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppPhoneNumber_phoneNumberId_key" ON "WhatsAppPhoneNumber"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsAppPhoneNumber_companyId_idx" ON "WhatsAppPhoneNumber"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppPhoneNumber_whatsAppAccountId_idx" ON "WhatsAppPhoneNumber"("whatsAppAccountId");

-- AddForeignKey
ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppPhoneNumber" ADD CONSTRAINT "WhatsAppPhoneNumber_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppPhoneNumber" ADD CONSTRAINT "WhatsAppPhoneNumber_whatsAppAccountId_fkey" FOREIGN KEY ("whatsAppAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
