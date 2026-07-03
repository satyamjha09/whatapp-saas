import nodemailer from "nodemailer";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import { generateInvoicePdf, generateCreditNotePdf } from "@/server/services/billing-document-pdf.service";

export class BillingDocumentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingDocumentEmailError";
  }
}

function isEnabled() {
  return process.env.BILLING_DOCUMENT_EMAILS_ENABLED !== "false";
}

function autoSendEnabled() {
  return process.env.BILLING_DOCUMENT_EMAILS_AUTO_SEND !== "false";
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function fromAddress() {
  return (
    process.env.BILLING_DOCUMENT_EMAILS_FROM ||
    process.env.SMTP_FROM ||
    "metawhat Billing <no-reply@example.com>"
  );
}

function replyToAddress() {
  return process.env.BILLING_DOCUMENT_EMAILS_REPLY_TO || undefined;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function money(paise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(paise / 100);
}

function transporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new BillingDocumentEmailError("SMTP is not configured.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

async function sendMail({
  to,
  subject,
  html,
  text,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}) {
  const client = transporter();

  return client.sendMail({
    from: fromAddress(),
    replyTo: replyToAddress(),
    to,
    subject,
    html,
    text,
    attachments,
  });
}

function shouldAttachPdfs() {
  return process.env.BILLING_PDFS_ATTACH_TO_EMAILS !== "false";
}

function invoiceEmailHtml({
  invoiceNumber,
  amount,
  invoiceUrl,
  companyName,
}: {
  invoiceNumber: string;
  amount: string;
  invoiceUrl: string;
  companyName: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2>Your invoice is ready</h2>
      <p>Hello ${companyName},</p>
      <p>Your invoice <strong>${invoiceNumber}</strong> has been generated.</p>
      <p><strong>Total:</strong> ${amount}</p>
      <p>
        <a href="${invoiceUrl}" style="background:#111827;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
          View Invoice
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280;">
        This is an automated billing email from metawhat.
      </p>
    </div>
  `;
}

function creditNoteEmailHtml({
  creditNoteNumber,
  amount,
  refundsUrl,
  companyName,
}: {
  creditNoteNumber: string;
  amount: string;
  refundsUrl: string;
  companyName: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2>Your credit note is ready</h2>
      <p>Hello ${companyName},</p>
      <p>Your credit note <strong>${creditNoteNumber}</strong> has been generated.</p>
      <p><strong>Credit amount:</strong> ${amount}</p>
      <p>
        <a href="${refundsUrl}" style="background:#111827;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
          View Refunds
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280;">
        This is an automated billing email from metawhat.
      </p>
    </div>
  `;
}

export async function sendBillingInvoiceEmail({
  companyId,
  invoiceId,
  actorUserId,
  force = false,
}: {
  companyId: string;
  invoiceId: string;
  actorUserId?: string | null;
  force?: boolean;
}) {
  if (!isEnabled()) {
    throw new BillingDocumentEmailError("Billing document emails are disabled.");
  }

  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    include: {
      company: true,
    },
  });

  if (!invoice) {
    throw new BillingDocumentEmailError("Invoice not found.");
  }

  const recipientEmail = invoice.billingEmail;

  if (!recipientEmail) {
    throw new BillingDocumentEmailError("Invoice does not have a billing email.");
  }

  const idempotencyKey = `invoice-email:${invoice.id}:${recipientEmail}`;

  if (!force) {
    const existing = await prisma.billingDocumentEmailDelivery.findUnique({
      where: {
        idempotencyKey,
      },
    });

    if (existing?.status === "SENT") {
      return existing;
    }
  }

  const subject = `Invoice ${invoice.invoiceNumber} from metawhat`;
  const invoiceUrl = `${appUrl()}/dashboard/billing/invoices/${invoice.id}`;
  const amount = money(invoice.totalPaise, invoice.currency);

  const delivery = await prisma.billingDocumentEmailDelivery.upsert({
    where: {
      idempotencyKey,
    },
    create: {
      companyId,
      type: "INVOICE",
      status: "QUEUED",
      invoiceId: invoice.id,
      recipientEmail,
      recipientName: invoice.billingName,
      subject,
      idempotencyKey,
      metadata: safeJson({
        invoiceNumber: invoice.invoiceNumber,
        invoiceUrl,
      }),
    },
    update: {
      status: "QUEUED",
      attempts: {
        increment: 1,
      },
      failureReason: null,
    },
  });

  const attachments = [];

  if (shouldAttachPdfs()) {
    const pdf = await generateInvoicePdf({
      companyId,
      invoiceId: invoice.id,
    });

    attachments.push({
      filename: pdf.fileName,
      content: pdf.buffer,
      contentType: pdf.contentType,
    });
  }

  try {
    await sendMail({
      to: recipientEmail,
      subject,
      html: invoiceEmailHtml({
        invoiceNumber: invoice.invoiceNumber,
        amount,
        invoiceUrl,
        companyName: invoice.billingName ?? invoice.company.name,
      }),
      text: `Invoice ${invoice.invoiceNumber} is ready. Total: ${amount}. View: ${invoiceUrl}`,
      attachments,
    });

    const sent = await prisma.billingDocumentEmailDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    });

    await createAuditLog({
      companyId,
      actorUserId: actorUserId ?? undefined,
      action: "billing.invoice_email_sent",
      entityType: "BillingInvoice",
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        recipientEmail,
      },
    }).catch(() => undefined);

    return sent;
  } catch (error) {
    const failed = await prisma.billingDocumentEmailDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        attempts: {
          increment: 1,
        },
        failureReason:
          error instanceof Error ? error.message : "Unknown email error",
      },
    });

    throw new BillingDocumentEmailError(
      failed.failureReason ?? "Invoice email failed.",
    );
  }
}

export async function sendCreditNoteEmail({
  companyId,
  creditNoteId,
  actorUserId,
  force = false,
}: {
  companyId: string;
  creditNoteId: string;
  actorUserId?: string | null;
  force?: boolean;
}) {
  if (!isEnabled()) {
    throw new BillingDocumentEmailError("Billing document emails are disabled.");
  }

  const creditNote = await prisma.billingCreditNote.findFirst({
    where: {
      id: creditNoteId,
      companyId,
    },
    include: {
      company: {
        include: {
          billingProfile: true,
        },
      },
      refund: true,
      invoice: true,
    },
  });

  if (!creditNote) {
    throw new BillingDocumentEmailError("Credit note not found.");
  }

  const recipientEmail =
    creditNote.invoice?.billingEmail ??
    creditNote.company.billingProfile?.billingEmail;

  if (!recipientEmail) {
    throw new BillingDocumentEmailError("Credit note does not have a billing email.");
  }

  const idempotencyKey = `credit-note-email:${creditNote.id}:${recipientEmail}`;

  if (!force) {
    const existing = await prisma.billingDocumentEmailDelivery.findUnique({
      where: {
        idempotencyKey,
      },
    });

    if (existing?.status === "SENT") {
      return existing;
    }
  }

  const subject = `Credit Note ${creditNote.creditNoteNumber} from metawhat`;
  const refundsUrl = `${appUrl()}/dashboard/billing/refunds`;
  const amount = money(creditNote.totalPaise, creditNote.currency);

  const delivery = await prisma.billingDocumentEmailDelivery.upsert({
    where: {
      idempotencyKey,
    },
    create: {
      companyId,
      type: "CREDIT_NOTE",
      status: "QUEUED",
      creditNoteId: creditNote.id,
      refundId: creditNote.refundId,
      invoiceId: creditNote.invoiceId,
      recipientEmail,
      recipientName:
        creditNote.invoice?.billingName ?? creditNote.company.billingProfile?.legalName,
      subject,
      idempotencyKey,
      metadata: safeJson({
        creditNoteNumber: creditNote.creditNoteNumber,
        refundsUrl,
      }),
    },
    update: {
      status: "QUEUED",
      attempts: {
        increment: 1,
      },
      failureReason: null,
    },
  });

  const attachments = [];

  if (shouldAttachPdfs()) {
    const pdf = await generateCreditNotePdf({
      companyId,
      creditNoteId: creditNote.id,
    });

    attachments.push({
      filename: pdf.fileName,
      content: pdf.buffer,
      contentType: pdf.contentType,
    });
  }

  try {
    await sendMail({
      to: recipientEmail,
      subject,
      html: creditNoteEmailHtml({
        creditNoteNumber: creditNote.creditNoteNumber,
        amount,
        refundsUrl,
        companyName:
          creditNote.invoice?.billingName ??
          creditNote.company.billingProfile?.legalName ??
          creditNote.company.name,
      }),
      text: `Credit Note ${creditNote.creditNoteNumber} is ready. Amount: ${amount}. View: ${refundsUrl}`,
      attachments,
    });

    const sent = await prisma.billingDocumentEmailDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    });

    await createAuditLog({
      companyId,
      actorUserId: actorUserId ?? undefined,
      action: "billing.credit_note_email_sent",
      entityType: "BillingCreditNote",
      entityId: creditNote.id,
      metadata: {
        creditNoteNumber: creditNote.creditNoteNumber,
        recipientEmail,
      },
    }).catch(() => undefined);

    return sent;
  } catch (error) {
    const failed = await prisma.billingDocumentEmailDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        attempts: {
          increment: 1,
        },
        failureReason:
          error instanceof Error ? error.message : "Unknown email error",
      },
    });

    throw new BillingDocumentEmailError(
      failed.failureReason ?? "Credit note email failed.",
    );
  }
}

export async function autoSendInvoiceEmail({
  companyId,
  invoiceId,
}: {
  companyId: string;
  invoiceId: string;
}) {
  if (!isEnabled() || !autoSendEnabled()) return null;

  return sendBillingInvoiceEmail({
    companyId,
    invoiceId,
    force: false,
  }).catch(() => null);
}

export async function autoSendCreditNoteEmail({
  companyId,
  creditNoteId,
}: {
  companyId: string;
  creditNoteId: string;
}) {
  if (!isEnabled() || !autoSendEnabled()) return null;

  return sendCreditNoteEmail({
    companyId,
    creditNoteId,
    force: false,
  }).catch(() => null);
}

export async function listBillingDocumentEmailDeliveries({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.billingDocumentEmailDelivery.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    include: {
      invoice: true,
      creditNote: true,
      refund: true,
    },
  });
}

export async function getBillingDocumentEmailHealth() {
  const [sent24h, failed24h, queued, totalFailed] = await Promise.all([
    prisma.billingDocumentEmailDelivery.count({
      where: {
        status: "SENT",
        sentAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingDocumentEmailDelivery.count({
      where: {
        status: "FAILED",
        failedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingDocumentEmailDelivery.count({
      where: {
        status: "QUEUED",
      },
    }),
    prisma.billingDocumentEmailDelivery.count({
      where: {
        status: "FAILED",
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    autoSendEnabled: autoSendEnabled(),
    sent24h,
    failed24h,
    queued,
    totalFailed,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
