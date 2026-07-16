-- CreateEnum
CREATE TYPE "PartnerPriceBookEventType" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'ITEM_UPSERTED', 'ITEM_DEACTIVATED');

-- CreateEnum
CREATE TYPE "PartnerClientSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PartnerClientSubscriptionEventType" AS ENUM ('CREATED', 'PLAN_CHANGED', 'PRICE_CHANGED', 'STATUS_CHANGED', 'CANCELED', 'RENEWED', 'SNAPSHOT_RECORDED');

-- CreateTable
CREATE TABLE "PartnerPriceBook" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPriceBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPriceBookItem" (
    "id" TEXT NOT NULL,
    "priceBookId" TEXT NOT NULL,
    "platformPlanCode" "BillingPlan" NOT NULL,
    "wholesaleMonthlyPaise" INTEGER NOT NULL,
    "minimumRetailPaise" INTEGER NOT NULL,
    "suggestedRetailPaise" INTEGER,
    "includedMessages" INTEGER,
    "extraMessagePaise" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPriceBookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPriceBookEvent" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "priceBookId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "PartnerPriceBookEventType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPriceBookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerClientSubscription" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "relationshipId" TEXT,
    "priceBookItemId" TEXT,
    "platformPlanCode" "BillingPlan" NOT NULL,
    "billingOwnerType" "CompanyBillingOwnerType" NOT NULL DEFAULT 'PARENT_PARTNER',
    "wholesaleAmountPaise" INTEGER NOT NULL,
    "retailAmountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PartnerClientSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "priceSnapshot" JSONB NOT NULL,
    "metadata" JSONB,
    "canceledAt" TIMESTAMP(3),
    "cancellationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerClientSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerClientSubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "PartnerClientSubscriptionEventType" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerClientSubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPriceBook_partnerCompanyId_name_key" ON "PartnerPriceBook"("partnerCompanyId", "name");

-- CreateIndex
CREATE INDEX "PartnerPriceBook_partnerCompanyId_active_idx" ON "PartnerPriceBook"("partnerCompanyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPriceBookItem_priceBookId_platformPlanCode_key" ON "PartnerPriceBookItem"("priceBookId", "platformPlanCode");

-- CreateIndex
CREATE INDEX "PartnerPriceBookItem_priceBookId_active_idx" ON "PartnerPriceBookItem"("priceBookId", "active");

-- CreateIndex
CREATE INDEX "PartnerPriceBookItem_platformPlanCode_idx" ON "PartnerPriceBookItem"("platformPlanCode");

-- CreateIndex
CREATE INDEX "PartnerPriceBookEvent_partnerCompanyId_idx" ON "PartnerPriceBookEvent"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerPriceBookEvent_priceBookId_idx" ON "PartnerPriceBookEvent"("priceBookId");

-- CreateIndex
CREATE INDEX "PartnerPriceBookEvent_actorUserId_idx" ON "PartnerPriceBookEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "PartnerPriceBookEvent_type_idx" ON "PartnerPriceBookEvent"("type");

-- CreateIndex
CREATE INDEX "PartnerPriceBookEvent_createdAt_idx" ON "PartnerPriceBookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerClientSubscription_partnerCompanyId_idx" ON "PartnerClientSubscription"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscription_clientCompanyId_idx" ON "PartnerClientSubscription"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscription_relationshipId_idx" ON "PartnerClientSubscription"("relationshipId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscription_priceBookItemId_idx" ON "PartnerClientSubscription"("priceBookItemId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscription_platformPlanCode_idx" ON "PartnerClientSubscription"("platformPlanCode");

-- CreateIndex
CREATE INDEX "PartnerClientSubscription_status_idx" ON "PartnerClientSubscription"("status");

-- CreateIndex
CREATE INDEX "PartnerClientSubscription_currentPeriodEnd_idx" ON "PartnerClientSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "PartnerClientSubscriptionEvent_subscriptionId_idx" ON "PartnerClientSubscriptionEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscriptionEvent_partnerCompanyId_idx" ON "PartnerClientSubscriptionEvent"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscriptionEvent_clientCompanyId_idx" ON "PartnerClientSubscriptionEvent"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscriptionEvent_actorUserId_idx" ON "PartnerClientSubscriptionEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "PartnerClientSubscriptionEvent_type_idx" ON "PartnerClientSubscriptionEvent"("type");

-- CreateIndex
CREATE INDEX "PartnerClientSubscriptionEvent_createdAt_idx" ON "PartnerClientSubscriptionEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PartnerPriceBook" ADD CONSTRAINT "PartnerPriceBook_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPriceBookItem" ADD CONSTRAINT "PartnerPriceBookItem_priceBookId_fkey" FOREIGN KEY ("priceBookId") REFERENCES "PartnerPriceBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPriceBookEvent" ADD CONSTRAINT "PartnerPriceBookEvent_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPriceBookEvent" ADD CONSTRAINT "PartnerPriceBookEvent_priceBookId_fkey" FOREIGN KEY ("priceBookId") REFERENCES "PartnerPriceBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPriceBookEvent" ADD CONSTRAINT "PartnerPriceBookEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscription" ADD CONSTRAINT "PartnerClientSubscription_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscription" ADD CONSTRAINT "PartnerClientSubscription_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscription" ADD CONSTRAINT "PartnerClientSubscription_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PartnerClientRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscription" ADD CONSTRAINT "PartnerClientSubscription_priceBookItemId_fkey" FOREIGN KEY ("priceBookItemId") REFERENCES "PartnerPriceBookItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscriptionEvent" ADD CONSTRAINT "PartnerClientSubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PartnerClientSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscriptionEvent" ADD CONSTRAINT "PartnerClientSubscriptionEvent_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscriptionEvent" ADD CONSTRAINT "PartnerClientSubscriptionEvent_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientSubscriptionEvent" ADD CONSTRAINT "PartnerClientSubscriptionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
