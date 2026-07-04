import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import {
  createCashfreeOrder,
  getCashfreeCheckoutMode,
  getPaidCashfreePaymentForOrder,
} from "@/server/services/cashfree-payment.service";
import { createAuditLog } from "@/server/services/audit.service";
import { publishWalletDeveloperWebhookEvent } from "@/server/services/developer-webhook-event-publisher.service";

export class CreditPurchaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditPurchaseError";
  }
}

export type CreditPack = {
  id: string;
  label: string;
  credits: number;
  amountPaise: number;
  description: string;
};

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function creditAmount(credits: number) {
  return credits * MESSAGE_PRICE_PAISE;
}

export function getCreditPacks(): CreditPack[] {
  return [
    {
      id: "credits_500",
      label: "500 credits",
      credits: 500,
      amountPaise: creditAmount(500),
      description: "For light testing and small daily sends.",
    },
    {
      id: "credits_1000",
      label: "1,000 credits",
      credits: 1000,
      amountPaise: creditAmount(1000),
      description: "Good starter balance for small teams.",
    },
    {
      id: "credits_5000",
      label: "5,000 credits",
      credits: 5000,
      amountPaise: creditAmount(5000),
      description: "For campaign-ready workspaces.",
    },
  ];
}

function findCreditPack(packId: string) {
  const pack = getCreditPacks().find((item) => item.id === packId);

  if (!pack) {
    throw new CreditPurchaseError("Invalid credit pack.");
  }

  return pack;
}

function createCashfreeCreditOrderId() {
  return `credit_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function cashfreeCustomerPhone(phone?: string | null) {
  if (!phone) return undefined;

  const digits = phone.replace(/\D/g, "");
  return digits || undefined;
}

export async function createCreditPurchaseCheckout({
  companyId,
  userId,
  packId,
}: {
  companyId: string;
  userId: string;
  packId: string;
}) {
  const pack = findCreditPack(packId);
  const [company, user] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, mobile: true, name: true },
    }),
  ]);

  if (!company) {
    throw new CreditPurchaseError("Company not found.");
  }
  if (!user) {
    throw new CreditPurchaseError("User not found.");
  }

  const cashfreeOrderId = createCashfreeCreditOrderId();
  const purchase = await prisma.creditPurchase.create({
    data: {
      companyId,
      userId,
      packId: pack.id,
      credits: pack.credits,
      amountPaise: pack.amountPaise,
      currency: "INR",
      cashfreeOrderId,
    },
  });

  try {
    const order = await createCashfreeOrder({
      orderId: cashfreeOrderId,
      amountPaise: pack.amountPaise,
      currency: "INR",
      customer: {
        id: userId,
        email: user.email,
        name: user.name ?? company.name,
        phone: cashfreeCustomerPhone(user.mobile),
      },
      returnUrl: `${getAppUrl()}/dashboard/wallet?cashfree_order_id={order_id}`,
      notifyUrl: `${getAppUrl()}/api/webhooks/cashfree`,
      tags: {
        type: "WALLET_CREDITS",
        companyId,
        userId,
        purchaseId: purchase.id,
        packId: pack.id,
      },
    });

    return {
      purchase,
      order,
      checkoutMode: getCashfreeCheckoutMode(),
      pack,
    };
  } catch (error) {
    await prisma.creditPurchase.update({
      where: { id: purchase.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Unable to create Cashfree order",
      },
    });

    throw error;
  }
}

export async function completeCreditPurchasePayment({
  cashfreeOrderId,
  cashfreePaymentId,
  amountPaise,
  currency,
}: {
  cashfreeOrderId: string;
  cashfreePaymentId: string;
  amountPaise?: number;
  currency?: string | null;
}) {
  const purchase = await prisma.creditPurchase.findUnique({
    where: { cashfreeOrderId },
  });

  if (!purchase) {
    throw new CreditPurchaseError("Credit purchase not found.");
  }

  if (amountPaise !== undefined && amountPaise !== purchase.amountPaise) {
    throw new CreditPurchaseError("Cashfree payment amount mismatch.");
  }
  if (currency && currency.toUpperCase() !== purchase.currency.toUpperCase()) {
    throw new CreditPurchaseError("Cashfree payment currency mismatch.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.creditPurchase.updateMany({
      where: {
        id: purchase.id,
        status: "CREATED",
      },
      data: {
        status: "PAID",
        cashfreePaymentId,
        paidAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    if (claim.count === 0) {
      const currentPurchase = await tx.creditPurchase.findUniqueOrThrow({
        where: { id: purchase.id },
      });
      const wallet = await tx.wallet.findUnique({
        where: { companyId: purchase.companyId },
      });

      return {
        alreadyPaid: currentPurchase.status === "PAID",
        purchase: currentPurchase,
        wallet,
        transaction: null,
      };
    }

    const wallet = await tx.wallet.upsert({
      where: { companyId: purchase.companyId },
      update: {
        balancePaise: {
          increment: purchase.amountPaise,
        },
      },
      create: {
        companyId: purchase.companyId,
        balancePaise: purchase.amountPaise,
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        companyId: purchase.companyId,
        type: "CREDIT",
        status: "SUCCESS",
        amountPaise: purchase.amountPaise,
        balanceAfterPaise: wallet.balancePaise,
        description: `Wallet credit purchase (${purchase.credits} credits)`,
        referenceType: "CreditPurchase",
        referenceId: purchase.id,
        createdByUserId: purchase.userId,
      },
    });

    const paidPurchase = await tx.creditPurchase.findUniqueOrThrow({
      where: { id: purchase.id },
    });

    return {
      alreadyPaid: false,
      purchase: paidPurchase,
      wallet,
      transaction,
    };
  });

  if (result.transaction && result.wallet) {
    await publishWalletDeveloperWebhookEvent({
      companyId: purchase.companyId,
      transaction: result.transaction,
      balanceAfterPaise: result.wallet.balancePaise,
    }).catch(() => undefined);

    await createAuditLog({
      companyId: purchase.companyId,
      actorUserId: purchase.userId,
      action: "wallet.credit_purchase_paid",
      entityType: "CreditPurchase",
      entityId: purchase.id,
      metadata: {
        provider: "CASHFREE",
        cashfreeOrderId,
        cashfreePaymentId,
        credits: purchase.credits,
        amountPaise: purchase.amountPaise,
      },
    }).catch(() => undefined);
  }

  return result;
}

export async function verifyCreditPurchaseCheckout({
  companyId,
  purchaseId,
  cashfreeOrderId,
}: {
  companyId: string;
  purchaseId: string;
  cashfreeOrderId: string;
}) {
  const purchase = await prisma.creditPurchase.findFirst({
    where: {
      id: purchaseId,
      companyId,
    },
  });

  if (!purchase) {
    throw new CreditPurchaseError("Credit purchase not found.");
  }
  if (purchase.cashfreeOrderId !== cashfreeOrderId) {
    throw new CreditPurchaseError("Cashfree order mismatch.");
  }
  if (purchase.status === "PAID") {
    return {
      alreadyPaid: true,
      purchase,
      wallet: await prisma.wallet.findUnique({ where: { companyId } }),
      transaction: null,
    };
  }
  if (purchase.status !== "CREATED") {
    throw new CreditPurchaseError(`Credit purchase is ${purchase.status}.`);
  }

  const cashfreePayment = await getPaidCashfreePaymentForOrder(cashfreeOrderId);

  if (!cashfreePayment.isPaid || !cashfreePayment.payment?.cf_payment_id) {
    await prisma.creditPurchase.updateMany({
      where: {
        id: purchase.id,
        status: "CREATED",
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Cashfree payment not successful",
      },
    });

    throw new CreditPurchaseError("Cashfree payment not successful.");
  }

  return completeCreditPurchasePayment({
    cashfreeOrderId,
    cashfreePaymentId: String(cashfreePayment.payment.cf_payment_id),
    amountPaise:
      cashfreePayment.payment.payment_amount !== undefined
        ? Math.round(cashfreePayment.payment.payment_amount * 100)
        : undefined,
    currency: cashfreePayment.payment.payment_currency,
  });
}

export async function markCreditPurchaseFailedFromWebhook({
  cashfreeOrderId,
  cashfreePaymentId,
  failureReason,
}: {
  cashfreeOrderId: string;
  cashfreePaymentId?: string;
  failureReason?: string;
}) {
  const purchase = await prisma.creditPurchase.findUnique({
    where: { cashfreeOrderId },
  });

  if (!purchase) {
    throw new CreditPurchaseError("Credit purchase not found.");
  }

  await prisma.creditPurchase.updateMany({
    where: {
      id: purchase.id,
      status: { not: "PAID" },
    },
    data: {
      status: "FAILED",
      cashfreePaymentId: cashfreePaymentId ?? purchase.cashfreePaymentId,
      failedAt: new Date(),
      failureReason: failureReason ?? "Cashfree payment failed",
    },
  });

  return prisma.creditPurchase.findUniqueOrThrow({
    where: { id: purchase.id },
  });
}
