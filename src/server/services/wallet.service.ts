import { prisma } from "@/lib/prisma";
import { TopUpWalletInput } from "@/server/validators/wallet.validator";

export async function getOrCreateWallet(companyId: string) {
  const existingWallet = await prisma.wallet.findUnique({
    where: {
      companyId,
    },
  });

  if (existingWallet) {
    return existingWallet;
  }

  return prisma.wallet.create({
    data: {
      companyId,
      balancePaise: 0,
    },
  });
}

export async function getWalletTransactions(companyId: string) {
  return prisma.walletTransaction.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function topUpWallet(companyId: string, input: TopUpWalletInput) {
  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: {
        companyId,
      },
      update: {
        balancePaise: {
          increment: input.amountPaise,
        },
      },
      create: {
        companyId,
        balancePaise: input.amountPaise,
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        companyId,
        type: "CREDIT",
        status: "SUCCESS",
        amountPaise: input.amountPaise,
        description: input.description ?? "Manual wallet top-up",
      },
    });

    return {
      wallet,
      transaction,
    };
  });

  return result;
}

export async function debitWalletForMessage(
  companyId: string,
  amountPaise: number,
  description: string,
  referenceId?: string,
) {
  const wallet = await getOrCreateWallet(companyId);

  if (wallet.balancePaise < amountPaise) {
    throw new Error("Insufficient wallet balance");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: {
        companyId,
      },
      data: {
        balancePaise: {
          decrement: amountPaise,
        },
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        companyId,
        type: "DEBIT",
        status: "SUCCESS",
        amountPaise,
        description,
        referenceId,
      },
    });

    return {
      wallet: updatedWallet,
      transaction,
    };
  });

  return result;
}

export async function refundWalletForMessage(
  companyId: string,
  amountPaise: number,
  description: string,
  referenceId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existingDebit = await tx.walletTransaction.findFirst({
      where: {
        companyId,
        type: "DEBIT",
        referenceId,
      },
    });

    if (!existingDebit) {
      return {
        refunded: false,
        transaction: null,
      };
    }

    const existingRefund = await tx.walletTransaction.findFirst({
      where: {
        companyId,
        type: "REFUND",
        referenceId,
      },
    });

    if (existingRefund) {
      return {
        refunded: false,
        transaction: existingRefund,
      };
    }

    const wallet = await tx.wallet.upsert({
      where: {
        companyId,
      },
      update: {
        balancePaise: {
          increment: amountPaise,
        },
      },
      create: {
        companyId,
        balancePaise: amountPaise,
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        companyId,
        type: "REFUND",
        status: "SUCCESS",
        amountPaise,
        description,
        referenceId,
      },
    });

    return {
      refunded: true,
      wallet,
      transaction,
    };
  });
}

export async function getBillingSummary(companyId: string) {
  const [wallet, transactions] = await Promise.all([
    getOrCreateWallet(companyId),
    getWalletTransactions(companyId),
  ]);

  const totalCreditPaise = transactions
    .filter((transaction) => transaction.type === "CREDIT")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);

  const totalDebitPaise = transactions
    .filter((transaction) => transaction.type === "DEBIT")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);

  const totalRefundPaise = transactions
    .filter((transaction) => transaction.type === "REFUND")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);

  const successfulTransactions = transactions.filter(
    (transaction) => transaction.status === "SUCCESS",
  );

  return {
    wallet,
    transactions,
    summary: {
      totalCreditPaise,
      totalDebitPaise,
      totalRefundPaise,
      successfulTransactionCount: successfulTransactions.length,
    },
  };
}
