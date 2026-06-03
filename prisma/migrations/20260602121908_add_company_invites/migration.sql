-- CreateEnum
CREATE TYPE "CompanyInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "CompanyInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL,
    "status" "CompanyInviteStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvite_tokenHash_key" ON "CompanyInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CompanyInvite_companyId_idx" ON "CompanyInvite"("companyId");

-- CreateIndex
CREATE INDEX "CompanyInvite_email_idx" ON "CompanyInvite"("email");

-- CreateIndex
CREATE INDEX "CompanyInvite_status_idx" ON "CompanyInvite"("status");

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
