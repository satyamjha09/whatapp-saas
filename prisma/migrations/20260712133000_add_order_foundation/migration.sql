-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'TALLY', 'API', 'CATALOG', 'WHATSAPP', 'IMPORT');

-- CreateEnum
CREATE TYPE "OrderStatusEventSource" AS ENUM ('DASHBOARD', 'TALLY', 'API', 'AUTOMATION', 'SYSTEM', 'WEBHOOK');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "source" "OrderSource" NOT NULL DEFAULT 'MANUAL',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotalAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "shippingAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "currentStatus" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "localProductId" TEXT,
    "retailerIdSnapshot" TEXT,
    "productNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "lineTotalAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "previousStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "source" "OrderStatusEventSource" NOT NULL DEFAULT 'DASHBOARD',
    "changedByUserId" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_orderNumber_key" ON "Order"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_contactId_idx" ON "Order"("contactId");

-- CreateIndex
CREATE INDEX "Order_companyId_currentStatus_idx" ON "Order"("companyId", "currentStatus");

-- CreateIndex
CREATE INDEX "Order_companyId_source_idx" ON "Order"("companyId", "source");

-- CreateIndex
CREATE INDEX "Order_companyId_orderDate_idx" ON "Order"("companyId", "orderDate");

-- CreateIndex
CREATE INDEX "Order_externalOrderId_idx" ON "Order"("externalOrderId");

-- CreateIndex
CREATE INDEX "Order_updatedAt_idx" ON "Order"("updatedAt");

-- CreateIndex
CREATE INDEX "OrderItem_companyId_idx" ON "OrderItem"("companyId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_localProductId_idx" ON "OrderItem"("localProductId");

-- CreateIndex
CREATE INDEX "OrderItem_retailerIdSnapshot_idx" ON "OrderItem"("retailerIdSnapshot");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_companyId_idx" ON "OrderStatusEvent"("companyId");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_orderId_idx" ON "OrderStatusEvent"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_newStatus_idx" ON "OrderStatusEvent"("newStatus");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_source_idx" ON "OrderStatusEvent"("source");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_changedByUserId_idx" ON "OrderStatusEvent"("changedByUserId");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_createdAt_idx" ON "OrderStatusEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_localProductId_fkey" FOREIGN KEY ("localProductId") REFERENCES "WhatsAppCatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
