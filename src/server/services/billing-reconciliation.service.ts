import {
  BillingReconciliationIssueSeverity,
  BillingReconciliationIssueType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createIncident } from "@/server/services/incident.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.BILLING_RECONCILIATION_ENABLED !== "false";
}

function shouldCreateIncidents() {
  return process.env.BILLING_RECONCILIATION_AUTO_INCIDENTS !== "false";
}

function json(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function isSuccessfulWalletStatus(status: string) {
  return status === "SUCCESS" || status === "COMPLETED";
}

function signedWalletAmount({
  type,
  amountPaise,
}: {
  type: string;
  amountPaise: number;
}) {
  if (type === "DEBIT") return -Math.abs(amountPaise);
  if (type === "CREDIT" || type === "REFUND") return Math.abs(amountPaise);
  return amountPaise;
}

async function addIssue({
  runId,
  companyId,
  type,
  severity = "HIGH",
  title,
  description,
  messageUsageLedgerId,
  walletTransactionId,
  walletId,
  expectedAmountPaise,
  actualAmountPaise,
  metadata,
}: {
  runId: string;
  companyId?: string | null;
  type: BillingReconciliationIssueType;
  severity?: BillingReconciliationIssueSeverity;
  title: string;
  description?: string;
  messageUsageLedgerId?: string | null;
  walletTransactionId?: string | null;
  walletId?: string | null;
  expectedAmountPaise?: number | null;
  actualAmountPaise?: number | null;
  metadata?: unknown;
}) {
  return prisma.billingReconciliationIssue.create({
    data: {
      runId,
      companyId: companyId ?? null,
      type,
      severity,
      title,
      description,
      messageUsageLedgerId: messageUsageLedgerId ?? null,
      walletTransactionId: walletTransactionId ?? null,
      walletId: walletId ?? null,
      expectedAmountPaise: expectedAmountPaise ?? null,
      actualAmountPaise: actualAmountPaise ?? null,
      metadata: metadata === undefined ? undefined : json(metadata),
    },
  });
}

async function reconcileCompany({
  runId,
  companyId,
}: {
  runId: string;
  companyId: string;
}) {
  const [wallet, walletTransactions, chargedLedgers] = await Promise.all([
    prisma.wallet.findUnique({ where: { companyId } }),
    prisma.walletTransaction.findMany({
      where: { companyId, status: { in: ["SUCCESS", "COMPLETED"] } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.messageUsageLedger.findMany({
      where: { companyId, status: "CHARGED" },
      include: { walletTransaction: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const expectedBalancePaise = walletTransactions.reduce(
    (sum, transaction) =>
      sum +
      signedWalletAmount({
        type: transaction.type,
        amountPaise: transaction.amountPaise,
      }),
    0,
  );

  if (
    (wallet && wallet.balancePaise !== expectedBalancePaise) ||
    (!wallet && expectedBalancePaise !== 0)
  ) {
    await addIssue({
      runId,
      companyId,
      type: "WALLET_BALANCE_MISMATCH",
      severity: "CRITICAL",
      title: wallet
        ? "Wallet balance does not match wallet transaction ledger"
        : "Wallet is missing despite a non-zero transaction ledger",
      description:
        "The stored wallet balance differs from the balance calculated from successful wallet transactions.",
      walletId: wallet?.id,
      expectedAmountPaise: expectedBalancePaise,
      actualAmountPaise: wallet?.balancePaise,
      metadata: { transactionCount: walletTransactions.length },
    });
  }

  const ledgersByTransaction = new Map<
    string,
    { transaction: NonNullable<(typeof chargedLedgers)[number]["walletTransaction"]>; ledgerIds: string[]; amountPaise: number }
  >();

  for (const ledger of chargedLedgers) {
    const transaction = ledger.walletTransaction;

    if (!ledger.walletTransactionId || !transaction || transaction.companyId !== companyId) {
      await addIssue({
        runId,
        companyId,
        type: "MISSING_WALLET_TRANSACTION",
        severity: "CRITICAL",
        title: ledger.walletTransactionId
          ? "Usage ledger references missing wallet transaction"
          : "Charged usage ledger is missing wallet transaction",
        description:
          "A charged message usage ledger must link to a wallet debit transaction for the same company.",
        messageUsageLedgerId: ledger.id,
        walletTransactionId: ledger.walletTransactionId,
        expectedAmountPaise: ledger.amountPaise,
        metadata: { ledgerId: ledger.id, messageId: ledger.messageId },
      });
      continue;
    }

    const group = ledgersByTransaction.get(transaction.id);
    if (group) {
      group.amountPaise += ledger.amountPaise;
      group.ledgerIds.push(ledger.id);
    } else {
      ledgersByTransaction.set(transaction.id, {
        transaction,
        ledgerIds: [ledger.id],
        amountPaise: ledger.amountPaise,
      });
    }
  }

  for (const group of ledgersByTransaction.values()) {
    const { transaction } = group;
    const validDebit =
      transaction.type === "DEBIT" &&
      isSuccessfulWalletStatus(transaction.status) &&
      Math.abs(transaction.amountPaise) === group.amountPaise;

    if (!validDebit) {
      await addIssue({
        runId,
        companyId,
        type: "WALLET_TRANSACTION_AMOUNT_MISMATCH",
        severity: "HIGH",
        title: "Usage ledger total does not match wallet debit",
        description:
          "The sum of usage ledgers linked to a debit must equal the successful wallet transaction amount.",
        messageUsageLedgerId: group.ledgerIds[0],
        walletTransactionId: transaction.id,
        expectedAmountPaise: group.amountPaise,
        actualAmountPaise: transaction.amountPaise,
        metadata: {
          ledgerIds: group.ledgerIds,
          transactionType: transaction.type,
          transactionStatus: transaction.status,
        },
      });
    }
  }

  const duplicateGroups = await prisma.messageUsageLedger.groupBy({
    by: ["messageId"],
    where: { companyId, messageId: { not: null }, status: "CHARGED" },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  for (const group of duplicateGroups) {
    await addIssue({
      runId,
      companyId,
      type: "DUPLICATE_MESSAGE_CHARGE",
      severity: "CRITICAL",
      title: "Duplicate charged usage ledgers found for one message",
      description:
        "A message should only have one charged usage ledger. Duplicate charges require manual review.",
      metadata: { messageId: group.messageId, count: group._count.id },
    });
  }

  const orphanLedgers = await prisma.messageUsageLedger.findMany({
    where: { companyId, messageId: null },
    take: 200,
  });

  for (const ledger of orphanLedgers) {
    await addIssue({
      runId,
      companyId,
      type: "ORPHAN_USAGE_LEDGER",
      severity: "MEDIUM",
      title: "Usage ledger references missing message",
      description: "A usage ledger points to a message that no longer exists.",
      messageUsageLedgerId: ledger.id,
      metadata: { ledgerId: ledger.id, messageId: ledger.messageId },
    });
  }

  const usageDebitTransactions = await prisma.walletTransaction.findMany({
    where: {
      companyId,
      referenceType: { in: ["MESSAGE_USAGE", "BULK_MESSAGE_USAGE"] },
      type: "DEBIT",
      status: { in: ["SUCCESS", "COMPLETED"] },
    },
    take: 1_000,
  });
  const linkedTransactionIds = new Set(
    chargedLedgers.flatMap((ledger) =>
      ledger.walletTransactionId ? [ledger.walletTransactionId] : [],
    ),
  );

  for (const transaction of usageDebitTransactions) {
    if (linkedTransactionIds.has(transaction.id)) continue;

    await addIssue({
      runId,
      companyId,
      type: "ORPHAN_WALLET_TRANSACTION",
      severity: "HIGH",
      title: "Message usage wallet debit has no usage ledger",
      description:
        "A wallet debit marked as message usage does not have a matching usage ledger.",
      walletTransactionId: transaction.id,
      actualAmountPaise: transaction.amountPaise,
      metadata: {
        walletTransactionId: transaction.id,
        referenceType: transaction.referenceType,
        referenceId: transaction.referenceId,
      },
    });
  }

  return { checkedLedgers: chargedLedgers.length };
}

export async function runBillingReconciliation() {
  if (!isEnabled()) {
    return { skipped: true as const, reason: "Billing reconciliation disabled" };
  }

  const run = await prisma.billingReconciliationRun.create({
    data: { status: "RUNNING" },
  });

  try {
    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
    });
    let checkedLedgers = 0;

    for (const company of companies) {
      const result = await reconcileCompany({ runId: run.id, companyId: company.id });
      checkedLedgers += result.checkedLedgers;
    }

    const [issueCount, criticalIssueCount, highIssueCount] = await Promise.all([
      prisma.billingReconciliationIssue.count({ where: { runId: run.id } }),
      prisma.billingReconciliationIssue.count({
        where: { runId: run.id, severity: "CRITICAL" },
      }),
      prisma.billingReconciliationIssue.count({
        where: { runId: run.id, severity: "HIGH" },
      }),
    ]);
    const completed = await prisma.billingReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: issueCount > 0 ? "FAILED" : "PASSED",
        checkedCompanies: companies.length,
        checkedLedgers,
        issueCount,
        completedAt: new Date(),
      },
      include: {
        issues: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    await prisma.billingReconciliationIssue.updateMany({
      where: { runId: { not: run.id }, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });

    if (
      (criticalIssueCount > 0 || highIssueCount > 0) &&
      shouldCreateIncidents()
    ) {
      await createIncident({
        title: "Billing reconciliation failed",
        description: `${issueCount} billing reconciliation issue(s) detected.`,
        source: "BILLING",
        severity: criticalIssueCount > 0 ? "CRITICAL" : "HIGH",
        idempotencyKey: `billing-reconciliation:${run.id}`,
        metadata: {
          runId: run.id,
          issueCount,
          criticalIssueCount,
          highIssueCount,
          checkedCompanies: companies.length,
          checkedLedgers,
          billingReconciliationHref: `/dashboard/system/billing-reconciliation/${run.id}`,
        },
      }).catch(() => undefined);
    }

    return completed;
  } catch (error) {
    await prisma.billingReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown billing reconciliation error",
      },
    });
    throw error;
  }
}

export async function getBillingReconciliationHealth() {
  const [latest, unresolvedCritical, unresolvedHigh] = await Promise.all([
    prisma.billingReconciliationRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { issues: { orderBy: { createdAt: "desc" }, take: 10 } },
    }),
    prisma.billingReconciliationIssue.count({
      where: { severity: "CRITICAL", resolvedAt: null },
    }),
    prisma.billingReconciliationIssue.count({
      where: { severity: "HIGH", resolvedAt: null },
    }),
  ]);

  return {
    enabled: isEnabled(),
    isHealthy:
      isEnabled() &&
      unresolvedCritical === 0 &&
      unresolvedHigh === 0 &&
      (!latest || latest.status === "PASSED"),
    latest,
    unresolvedCritical,
    unresolvedHigh,
  };
}

export async function listBillingReconciliationRuns() {
  return prisma.billingReconciliationRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { issues: { take: 5, orderBy: { createdAt: "desc" } } },
  });
}

export async function getBillingReconciliationRun(runId: string) {
  return prisma.billingReconciliationRun.findUnique({
    where: { id: runId },
    include: { issues: { orderBy: { createdAt: "desc" } } },
  });
}
