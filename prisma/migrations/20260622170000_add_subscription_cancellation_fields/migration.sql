ALTER TABLE "Company"
ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "subscriptionCanceledAt" TIMESTAMP(3);
