ALTER TYPE "RazorpayWebhookEventStatus" RENAME TO "CashfreeWebhookEventStatus";

ALTER TABLE "RazorpayWebhookEvent" RENAME TO "CashfreeWebhookEvent";
ALTER TABLE "CashfreeWebhookEvent" RENAME COLUMN "razorpayEventId" TO "cashfreeEventId";

ALTER INDEX "RazorpayWebhookEvent_pkey" RENAME TO "CashfreeWebhookEvent_pkey";
ALTER INDEX "RazorpayWebhookEvent_razorpayEventId_key" RENAME TO "CashfreeWebhookEvent_cashfreeEventId_key";
ALTER INDEX "RazorpayWebhookEvent_companyId_idx" RENAME TO "CashfreeWebhookEvent_companyId_idx";
ALTER INDEX "RazorpayWebhookEvent_eventType_idx" RENAME TO "CashfreeWebhookEvent_eventType_idx";
ALTER INDEX "RazorpayWebhookEvent_status_idx" RENAME TO "CashfreeWebhookEvent_status_idx";
ALTER INDEX "RazorpayWebhookEvent_createdAt_idx" RENAME TO "CashfreeWebhookEvent_createdAt_idx";
ALTER TABLE "CashfreeWebhookEvent" RENAME CONSTRAINT "RazorpayWebhookEvent_companyId_fkey" TO "CashfreeWebhookEvent_companyId_fkey";

ALTER TABLE "PlanCheckout" RENAME COLUMN "razorpayOrderId" TO "cashfreeOrderId";
ALTER TABLE "PlanCheckout" RENAME COLUMN "razorpayPaymentId" TO "cashfreePaymentId";
ALTER TABLE "PlanCheckout" RENAME COLUMN "razorpaySignature" TO "cashfreeSignature";
ALTER INDEX "PlanCheckout_razorpayOrderId_idx" RENAME TO "PlanCheckout_cashfreeOrderId_idx";
ALTER INDEX "PlanCheckout_razorpayPaymentId_idx" RENAME TO "PlanCheckout_cashfreePaymentId_idx";

ALTER TABLE "BillingInvoice" RENAME COLUMN "razorpayOrderId" TO "cashfreeOrderId";
ALTER TABLE "BillingInvoice" RENAME COLUMN "razorpayPaymentId" TO "cashfreePaymentId";
ALTER INDEX "BillingInvoice_razorpayOrderId_idx" RENAME TO "BillingInvoice_cashfreeOrderId_idx";
ALTER INDEX "BillingInvoice_razorpayPaymentId_idx" RENAME TO "BillingInvoice_cashfreePaymentId_idx";

ALTER TABLE "CreditPurchase" RENAME COLUMN "razorpayOrderId" TO "cashfreeOrderId";
ALTER TABLE "CreditPurchase" RENAME COLUMN "razorpayPaymentId" TO "cashfreePaymentId";
ALTER TABLE "CreditPurchase" RENAME COLUMN "razorpaySignature" TO "cashfreeSignature";
ALTER INDEX "CreditPurchase_razorpayOrderId_key" RENAME TO "CreditPurchase_cashfreeOrderId_key";
ALTER INDEX "CreditPurchase_razorpayPaymentId_key" RENAME TO "CreditPurchase_cashfreePaymentId_key";

ALTER TABLE "SubscriptionPayment" RENAME COLUMN "razorpayOrderId" TO "cashfreeOrderId";
ALTER TABLE "SubscriptionPayment" RENAME COLUMN "razorpayPaymentId" TO "cashfreePaymentId";
ALTER TABLE "SubscriptionPayment" RENAME COLUMN "razorpaySignature" TO "cashfreeSignature";
ALTER INDEX "SubscriptionPayment_razorpayOrderId_key" RENAME TO "SubscriptionPayment_cashfreeOrderId_key";
ALTER INDEX "SubscriptionPayment_razorpayPaymentId_key" RENAME TO "SubscriptionPayment_cashfreePaymentId_key";

ALTER TABLE "PlanCheckoutReconciliationEvent" RENAME COLUMN "razorpayOrderId" TO "cashfreeOrderId";
ALTER TABLE "PlanCheckoutReconciliationEvent" RENAME COLUMN "razorpayPaymentId" TO "cashfreePaymentId";
ALTER INDEX "PlanCheckoutReconciliationEvent_razorpayOrderId_idx" RENAME TO "PlanCheckoutReconciliationEvent_cashfreeOrderId_idx";
ALTER INDEX "PlanCheckoutReconciliationEvent_razorpayPaymentId_idx" RENAME TO "PlanCheckoutReconciliationEvent_cashfreePaymentId_idx";

ALTER TABLE "BillingRefund" RENAME COLUMN "razorpayPaymentId" TO "cashfreePaymentId";
ALTER TABLE "BillingRefund" RENAME COLUMN "razorpayRefundId" TO "cashfreeRefundId";
ALTER TABLE "BillingRefund" RENAME COLUMN "razorpayStatus" TO "cashfreeStatus";
ALTER INDEX "BillingRefund_razorpayPaymentId_idx" RENAME TO "BillingRefund_cashfreePaymentId_idx";
ALTER INDEX "BillingRefund_razorpayRefundId_idx" RENAME TO "BillingRefund_cashfreeRefundId_idx";

ALTER TABLE "BillingRefundReconciliationEvent" RENAME COLUMN "razorpayPaymentId" TO "cashfreePaymentId";
ALTER TABLE "BillingRefundReconciliationEvent" RENAME COLUMN "razorpayRefundId" TO "cashfreeRefundId";
ALTER TABLE "BillingRefundReconciliationEvent" RENAME COLUMN "razorpayStatus" TO "cashfreeStatus";
ALTER INDEX "BillingRefundReconciliationEvent_razorpayPaymentId_idx" RENAME TO "BillingRefundReconciliationEvent_cashfreePaymentId_idx";
ALTER INDEX "BillingRefundReconciliationEvent_razorpayRefundId_idx" RENAME TO "BillingRefundReconciliationEvent_cashfreeRefundId_idx";
ALTER INDEX "BillingRefundReconciliationEvent_razorpayStatus_idx" RENAME TO "BillingRefundReconciliationEvent_cashfreeStatus_idx";
