import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export const BILLING_EXPORT_REPORTS = [
  {
    type: "wallet_ledger",
    label: "Wallet Ledger",
    description: "Wallet credits, debits, refunds, adjustments, and running balance.",
  },
  {
    type: "message_usage",
    label: "Message Usage",
    description: "Outbound message cost, template, recipient, status, and wallet transaction.",
  },
  {
    type: "failed_refunds",
    label: "Failed and Refunds",
    description: "Failed or canceled outbound messages with wallet refund status.",
  },
  {
    type: "billing_summary",
    label: "Monthly Billing Summary",
    description: "Month-wise messages, delivery counts, debits, refunds, and net billing.",
  },
  {
    type: "invoices_gst",
    label: "Invoice and GST",
    description: "Invoice totals, tax values, billing tax IDs, and payment references.",
  },
  {
    type: "customer_usage",
    label: "Customer Usage",
    description: "Customer-wise message count, delivery status, and message cost.",
  },
  {
    type: "date_wise_billing",
    label: "Date-wise Billing",
    description: "Daily messages, wallet debits, refunds, and net billing.",
  },
] as const;

export type BillingExportReportType =
  (typeof BILLING_EXPORT_REPORTS)[number]["type"];

export type BillingExportInput = {
  companyId: string;
  dateFrom: Date;
  dateTo: Date;
  reportType: BillingExportReportType;
};

type CsvRow = Array<string | number | null | undefined | Date>;

const MAX_EXPORT_ROWS = 50_000;

function paiseToRupees(value: number | null | undefined) {
  return ((value ?? 0) / 100).toFixed(2);
}

function isoDate(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthKey(value: Date) {
  return value.toISOString().slice(0, 7);
}

function dateWhere({ dateFrom, dateTo }: Pick<BillingExportInput, "dateFrom" | "dateTo">) {
  return {
    gte: dateFrom,
    lte: dateTo,
  };
}

function signedWalletAmountPaise(transaction: { type: string; amountPaise: number }) {
  return transaction.type === "DEBIT"
    ? -transaction.amountPaise
    : transaction.amountPaise;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function messageTypeLabel(message: {
  metadata: unknown;
  templateId: string | null;
}) {
  const metadata = jsonRecord(message.metadata);
  const metadataType = metadata?.messageType;

  if (typeof metadataType === "string" && metadataType.trim()) {
    return metadataType;
  }

  return message.templateId ? "TEMPLATE" : "TEXT";
}

function messageCostPaise(message: {
  usageLedgers: Array<{ amountPaise: number }>;
}) {
  return message.usageLedgers.reduce(
    (total, ledger) => total + ledger.amountPaise,
    0,
  );
}

async function getCompanyName(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  return company?.name ?? "";
}

async function buildWalletLedgerRows(input: BillingExportInput): Promise<CsvRow[]> {
  const companyName = await getCompanyName(input.companyId);
  const [previousTransactions, transactions] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: {
        companyId: input.companyId,
        createdAt: { lt: input.dateFrom },
        status: "SUCCESS",
      },
      select: {
        amountPaise: true,
        type: true,
      },
    }),
    prisma.walletTransaction.findMany({
      where: {
        companyId: input.companyId,
        createdAt: dateWhere(input),
      },
      orderBy: { createdAt: "asc" },
      take: MAX_EXPORT_ROWS,
    }),
  ]);
  let runningBalancePaise = previousTransactions.reduce(
    (total, transaction) => total + signedWalletAmountPaise(transaction),
    0,
  );

  return [
    [
      "Date",
      "Workspace",
      "Transaction ID",
      "Type",
      "Status",
      "Amount INR",
      "Amount Paise",
      "Balance Before INR",
      "Balance After INR",
      "Reference Type",
      "Reference ID",
      "Reason",
    ],
    ...transactions.map((transaction) => {
      const balanceBeforePaise = runningBalancePaise;
      runningBalancePaise += signedWalletAmountPaise(transaction);

      return [
        isoDate(transaction.createdAt),
        companyName,
        transaction.id,
        transaction.type,
        transaction.status,
        paiseToRupees(transaction.amountPaise),
        transaction.amountPaise,
        paiseToRupees(balanceBeforePaise),
        paiseToRupees(runningBalancePaise),
        transaction.referenceType ?? "",
        transaction.referenceId ?? "",
        transaction.description ?? "",
      ];
    }),
  ];
}

async function getOutboundMessages(input: BillingExportInput) {
  return prisma.message.findMany({
    where: {
      companyId: input.companyId,
      direction: "OUTBOUND",
      createdAt: dateWhere(input),
    },
    include: {
      contact: {
        select: {
          name: true,
          countryCode: true,
          phoneNumber: true,
        },
      },
      template: {
        select: {
          name: true,
          language: true,
          category: true,
        },
      },
      usageLedgers: {
        include: {
          walletTransaction: {
            select: {
              id: true,
              type: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_EXPORT_ROWS,
  });
}

async function buildMessageUsageRows(input: BillingExportInput): Promise<CsvRow[]> {
  const messages = await getOutboundMessages(input);

  return [
    [
      "Date",
      "Message ID",
      "Customer Name",
      "Customer Phone",
      "Template Name",
      "Template Language",
      "Message Type",
      "Status",
      "Cost INR",
      "Cost Paise",
      "Wallet Transaction ID",
      "Meta Message ID",
      "Scheduled At",
    ],
    ...messages.map((message) => {
      const walletTransaction = message.usageLedgers[0]?.walletTransaction;

      return [
        isoDate(message.createdAt),
        message.id,
        message.contact.name ?? "",
        `${message.contact.countryCode}${message.contact.phoneNumber}`,
        message.template?.name ?? "",
        message.template?.language ?? "",
        messageTypeLabel(message),
        message.status,
        paiseToRupees(messageCostPaise(message)),
        messageCostPaise(message),
        walletTransaction?.id ?? "",
        message.metaMessageId ?? "",
        isoDate(message.scheduledAt),
      ];
    }),
  ];
}

async function buildFailedRefundRows(input: BillingExportInput): Promise<CsvRow[]> {
  const failedMessages = await prisma.message.findMany({
    where: {
      companyId: input.companyId,
      direction: "OUTBOUND",
      status: { in: ["FAILED", "CANCELED"] },
      createdAt: dateWhere(input),
    },
    include: {
      contact: {
        select: {
          name: true,
          countryCode: true,
          phoneNumber: true,
        },
      },
      template: {
        select: {
          name: true,
          language: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_EXPORT_ROWS,
  });
  const refunds = await prisma.walletTransaction.findMany({
    where: {
      companyId: input.companyId,
      type: "REFUND",
      referenceId: {
        in: failedMessages.map((message) => message.id),
      },
    },
  });
  const refundByMessageId = new Map(
    refunds.map((refund) => [refund.referenceId, refund]),
  );

  return [
    [
      "Date",
      "Message ID",
      "Customer Name",
      "Customer Phone",
      "Template Name",
      "Status",
      "Failure Code",
      "Failure Reason",
      "Refund Amount INR",
      "Refund Amount Paise",
      "Refund Status",
      "Refund Transaction ID",
      "Refunded At",
    ],
    ...failedMessages.map((message) => {
      const refund = refundByMessageId.get(message.id);

      return [
        isoDate(message.createdAt),
        message.id,
        message.contact.name ?? "",
        `${message.contact.countryCode}${message.contact.phoneNumber}`,
        message.template?.name ?? "",
        message.status,
        message.errorCode ?? "",
        message.errorMessage ?? "",
        refund ? paiseToRupees(refund.amountPaise) : "0.00",
        refund?.amountPaise ?? 0,
        refund?.status ?? "NOT_REFUNDED",
        refund?.id ?? "",
        isoDate(refund?.createdAt),
      ];
    }),
  ];
}

async function buildBillingSummaryRows(input: BillingExportInput): Promise<CsvRow[]> {
  const [messages, transactions] = await Promise.all([
    prisma.message.findMany({
      where: {
        companyId: input.companyId,
        direction: "OUTBOUND",
        createdAt: dateWhere(input),
      },
      select: {
        createdAt: true,
        status: true,
      },
      take: MAX_EXPORT_ROWS,
    }),
    prisma.walletTransaction.findMany({
      where: {
        companyId: input.companyId,
        type: { in: ["DEBIT", "REFUND"] },
        createdAt: dateWhere(input),
      },
      select: {
        createdAt: true,
        type: true,
        amountPaise: true,
      },
      take: MAX_EXPORT_ROWS,
    }),
  ]);
  const summaries = new Map<
    string,
    {
      totalMessages: number;
      delivered: number;
      failed: number;
      totalDebitPaise: number;
      totalRefundPaise: number;
    }
  >();

  function getSummary(key: string) {
    const existing = summaries.get(key);
    if (existing) return existing;

    const created = {
      totalMessages: 0,
      delivered: 0,
      failed: 0,
      totalDebitPaise: 0,
      totalRefundPaise: 0,
    };
    summaries.set(key, created);
    return created;
  }

  for (const message of messages) {
    const summary = getSummary(monthKey(message.createdAt));
    summary.totalMessages += 1;
    if (["DELIVERED", "READ"].includes(message.status)) summary.delivered += 1;
    if (message.status === "FAILED") summary.failed += 1;
  }

  for (const transaction of transactions) {
    const summary = getSummary(monthKey(transaction.createdAt));
    if (transaction.type === "DEBIT") {
      summary.totalDebitPaise += transaction.amountPaise;
    } else if (transaction.type === "REFUND") {
      summary.totalRefundPaise += transaction.amountPaise;
    }
  }

  return [
    [
      "Month",
      "Total Messages",
      "Delivered or Read",
      "Failed",
      "Total Debit INR",
      "Total Refund INR",
      "Net Billing INR",
      "Total Debit Paise",
      "Total Refund Paise",
      "Net Billing Paise",
    ],
    ...[...summaries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, summary]) => {
        const netPaise = summary.totalDebitPaise - summary.totalRefundPaise;

        return [
          key,
          summary.totalMessages,
          summary.delivered,
          summary.failed,
          paiseToRupees(summary.totalDebitPaise),
          paiseToRupees(summary.totalRefundPaise),
          paiseToRupees(netPaise),
          summary.totalDebitPaise,
          summary.totalRefundPaise,
          netPaise,
        ];
      }),
  ];
}

async function buildInvoiceGstRows(input: BillingExportInput): Promise<CsvRow[]> {
  const invoices = await prisma.billingInvoice.findMany({
    where: {
      companyId: input.companyId,
      createdAt: dateWhere(input),
    },
    include: {
      lines: true,
      refunds: true,
    },
    orderBy: { createdAt: "asc" },
    take: MAX_EXPORT_ROWS,
  });

  return [
    [
      "Invoice Date",
      "Invoice Number",
      "Status",
      "Currency",
      "Billing Name",
      "Billing Email",
      "Billing Tax ID",
      "Seller Tax ID",
      "Subtotal INR",
      "Tax INR",
      "Total INR",
      "Tax Rate Percent",
      "Paid At",
      "Cashfree Order ID",
      "Cashfree Payment ID",
      "Refunded INR",
      "Line Summary",
    ],
    ...invoices.map((invoice) => [
      isoDate(invoice.issuedAt ?? invoice.createdAt),
      invoice.invoiceNumber,
      invoice.status,
      invoice.currency,
      invoice.billingName ?? "",
      invoice.billingEmail ?? "",
      invoice.billingTaxId ?? "",
      invoice.sellerTaxId ?? "",
      paiseToRupees(invoice.subtotalPaise),
      paiseToRupees(invoice.taxPaise),
      paiseToRupees(invoice.totalPaise),
      (invoice.taxBasisPoints / 100).toFixed(2),
      isoDate(invoice.paidAt),
      invoice.cashfreeOrderId ?? "",
      invoice.cashfreePaymentId ?? "",
      paiseToRupees(
        invoice.refunds
          .filter((refund) =>
            ["REQUESTED", "PROCESSING", "PROCESSED"].includes(refund.status),
          )
          .reduce((total, refund) => total + refund.amountPaise, 0),
      ),
      invoice.lines
        .map(
          (line) =>
            `${line.description} x${line.quantity} ${paiseToRupees(line.totalPaise)}`,
        )
        .join(" | "),
    ]),
  ];
}

async function buildCustomerUsageRows(input: BillingExportInput): Promise<CsvRow[]> {
  const messages = await getOutboundMessages(input);
  const summaries = new Map<
    string,
    {
      customerName: string;
      customerPhone: string;
      totalMessages: number;
      delivered: number;
      failed: number;
      costPaise: number;
      lastMessageAt: Date | null;
    }
  >();

  for (const message of messages) {
    const customerPhone = `${message.contact.countryCode}${message.contact.phoneNumber}`;
    const existing =
      summaries.get(customerPhone) ??
      {
        customerName: message.contact.name ?? "",
        customerPhone,
        totalMessages: 0,
        delivered: 0,
        failed: 0,
        costPaise: 0,
        lastMessageAt: null,
      };

    existing.totalMessages += 1;
    existing.costPaise += messageCostPaise(message);
    existing.lastMessageAt =
      !existing.lastMessageAt || existing.lastMessageAt < message.createdAt
        ? message.createdAt
        : existing.lastMessageAt;
    if (["DELIVERED", "READ"].includes(message.status)) existing.delivered += 1;
    if (message.status === "FAILED") existing.failed += 1;
    summaries.set(customerPhone, existing);
  }

  return [
    [
      "Customer Name",
      "Customer Phone",
      "Total Messages",
      "Delivered or Read",
      "Failed",
      "Total Cost INR",
      "Total Cost Paise",
      "Last Message At",
    ],
    ...[...summaries.values()]
      .sort((left, right) => right.costPaise - left.costPaise)
      .map((summary) => [
        summary.customerName,
        summary.customerPhone,
        summary.totalMessages,
        summary.delivered,
        summary.failed,
        paiseToRupees(summary.costPaise),
        summary.costPaise,
        isoDate(summary.lastMessageAt),
      ]),
  ];
}

async function buildDateWiseBillingRows(input: BillingExportInput): Promise<CsvRow[]> {
  const [messages, transactions] = await Promise.all([
    prisma.message.findMany({
      where: {
        companyId: input.companyId,
        direction: "OUTBOUND",
        createdAt: dateWhere(input),
      },
      select: {
        createdAt: true,
        status: true,
      },
      take: MAX_EXPORT_ROWS,
    }),
    prisma.walletTransaction.findMany({
      where: {
        companyId: input.companyId,
        type: { in: ["DEBIT", "REFUND"] },
        createdAt: dateWhere(input),
      },
      select: {
        createdAt: true,
        type: true,
        amountPaise: true,
      },
      take: MAX_EXPORT_ROWS,
    }),
  ]);
  const summaries = new Map<
    string,
    {
      totalMessages: number;
      delivered: number;
      failed: number;
      debitPaise: number;
      refundPaise: number;
    }
  >();

  function getSummary(key: string) {
    const existing = summaries.get(key);
    if (existing) return existing;
    const created = {
      totalMessages: 0,
      delivered: 0,
      failed: 0,
      debitPaise: 0,
      refundPaise: 0,
    };
    summaries.set(key, created);
    return created;
  }

  for (const message of messages) {
    const summary = getSummary(dayKey(message.createdAt));
    summary.totalMessages += 1;
    if (["DELIVERED", "READ"].includes(message.status)) summary.delivered += 1;
    if (message.status === "FAILED") summary.failed += 1;
  }

  for (const transaction of transactions) {
    const summary = getSummary(dayKey(transaction.createdAt));
    if (transaction.type === "DEBIT") summary.debitPaise += transaction.amountPaise;
    if (transaction.type === "REFUND") summary.refundPaise += transaction.amountPaise;
  }

  return [
    [
      "Date",
      "Total Messages",
      "Delivered or Read",
      "Failed",
      "Debit INR",
      "Refund INR",
      "Net Billing INR",
      "Debit Paise",
      "Refund Paise",
      "Net Billing Paise",
    ],
    ...[...summaries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, summary]) => {
        const netPaise = summary.debitPaise - summary.refundPaise;

        return [
          key,
          summary.totalMessages,
          summary.delivered,
          summary.failed,
          paiseToRupees(summary.debitPaise),
          paiseToRupees(summary.refundPaise),
          paiseToRupees(netPaise),
          summary.debitPaise,
          summary.refundPaise,
          netPaise,
        ];
      }),
  ];
}

export function getBillingExportReport(reportType: string) {
  return BILLING_EXPORT_REPORTS.find((report) => report.type === reportType);
}

export async function generateBillingExportCsv(input: BillingExportInput) {
  let rows: CsvRow[];

  switch (input.reportType) {
    case "wallet_ledger":
      rows = await buildWalletLedgerRows(input);
      break;
    case "message_usage":
      rows = await buildMessageUsageRows(input);
      break;
    case "failed_refunds":
      rows = await buildFailedRefundRows(input);
      break;
    case "billing_summary":
      rows = await buildBillingSummaryRows(input);
      break;
    case "invoices_gst":
      rows = await buildInvoiceGstRows(input);
      break;
    case "customer_usage":
      rows = await buildCustomerUsageRows(input);
      break;
    case "date_wise_billing":
      rows = await buildDateWiseBillingRows(input);
      break;
  }

  return {
    csv: rowsToCsv(rows),
    rowCount: Math.max(rows.length - 1, 0),
  };
}

export function billingExportFileName({
  dateFrom,
  dateTo,
  reportType,
}: Pick<BillingExportInput, "dateFrom" | "dateTo" | "reportType">) {
  return `${reportType}-${dayKey(dateFrom)}-to-${dayKey(dateTo)}.csv`;
}

export function formatBillingExportDateRange(dateFrom: Date, dateTo: Date) {
  return {
    from: dayKey(dateFrom),
    to: dayKey(dateTo),
  };
}
