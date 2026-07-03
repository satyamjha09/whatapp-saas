import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

export class BillingDocumentPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingDocumentPdfError";
  }
}

function isEnabled() {
  return process.env.BILLING_PDFS_ENABLED !== "false";
}

function renderLogEnabled() {
  return process.env.BILLING_PDFS_RENDER_LOG_ENABLED !== "false";
}

function footerText() {
  return (
    process.env.BILLING_PDF_FOOTER_TEXT ||
    "This is a system-generated billing document."
  );
}

function money(paise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(paise / 100);
}

function collectPdfBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);
  });
}

function writeHeader(doc: PDFKit.PDFDocument, title: string, number: string) {
  doc.fontSize(24).font("Helvetica-Bold").text(title, 50, 50);
  doc.fontSize(10).font("Helvetica").text(number, 50, 82);

  doc.moveTo(50, 110).lineTo(545, 110).strokeColor("#e5e7eb").stroke();
  doc.strokeColor("#111827");
}

function writePartyBlock({
  doc,
  title,
  x,
  y,
  name,
  email,
  address,
  taxId,
}: {
  doc: PDFKit.PDFDocument;
  title: string;
  x: number;
  y: number;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  taxId?: string | null;
}) {
  doc.fontSize(10).font("Helvetica-Bold").text(title, x, y);
  doc.fontSize(9).font("Helvetica").text(name || "-", x, y + 18);

  let cursor = y + 32;

  if (email) {
    doc.text(email, x, cursor);
    cursor += 14;
  }

  if (address) {
    doc.text(address, x, cursor, {
      width: 220,
    });
    cursor += 28;
  }

  if (taxId) {
    doc.text(`Tax ID: ${taxId}`, x, cursor);
  }
}

function writeTotals({
  doc,
  currency,
  subtotalPaise,
  taxPaise,
  totalPaise,
}: {
  doc: PDFKit.PDFDocument;
  currency: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
}) {
  const x = 350;
  let y = 560;

  doc.fontSize(10).font("Helvetica");

  doc.text("Subtotal", x, y);
  doc.text(money(subtotalPaise, currency), 450, y, {
    align: "right",
    width: 90,
  });

  y += 20;

  doc.text("Tax", x, y);
  doc.text(money(taxPaise, currency), 450, y, {
    align: "right",
    width: 90,
  });

  y += 20;

  doc.moveTo(x, y - 6).lineTo(540, y - 6).strokeColor("#e5e7eb").stroke();
  doc.strokeColor("#111827");

  doc.font("Helvetica-Bold").text("Total", x, y);
  doc.text(money(totalPaise, currency), 450, y, {
    align: "right",
    width: 90,
  });
}

function writeFooter(doc: PDFKit.PDFDocument) {
  doc
    .fontSize(8)
    .fillColor("#6b7280")
    .text(footerText(), 50, 750, {
      align: "center",
      width: 495,
    });

  doc.fillColor("#111827");
}

async function logPdfRender({
  companyId,
  type,
  invoiceId,
  creditNoteId,
  status,
  fileName,
  sizeBytes,
  failureReason,
}: {
  companyId: string;
  type: "INVOICE" | "CREDIT_NOTE";
  invoiceId?: string | null;
  creditNoteId?: string | null;
  status: "GENERATED" | "FAILED";
  fileName?: string | null;
  sizeBytes?: number | null;
  failureReason?: string | null;
}) {
  if (!renderLogEnabled()) return;

  await prisma.billingDocumentPdfRender
    .create({
      data: {
        companyId,
        type,
        status,
        invoiceId: invoiceId ?? null,
        creditNoteId: creditNoteId ?? null,
        fileName: fileName ?? null,
        sizeBytes: sizeBytes ?? null,
        failedAt: status === "FAILED" ? new Date() : null,
        failureReason: failureReason ?? null,
      },
    })
    .catch(() => undefined);
}

export async function generateInvoicePdf({
  companyId,
  invoiceId,
}: {
  companyId: string;
  invoiceId: string;
}) {
  if (!isEnabled()) {
    throw new BillingDocumentPdfError("Billing PDFs are disabled.");
  }

  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    include: {
      company: true,
      lines: true,
    },
  });

  if (!invoice) {
    throw new BillingDocumentPdfError("Invoice not found.");
  }

  const fileName = `${invoice.invoiceNumber}.pdf`;

  try {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: invoice.sellerName ?? "metawhat",
      },
    });

    const bufferPromise = collectPdfBuffer(doc);

    writeHeader(doc, "Invoice", invoice.invoiceNumber);

    writePartyBlock({
      doc,
      title: "From",
      x: 50,
      y: 135,
      name: invoice.sellerName,
      email: invoice.sellerEmail,
      address: invoice.sellerAddress,
      taxId: invoice.sellerTaxId,
    });

    writePartyBlock({
      doc,
      title: "Bill To",
      x: 320,
      y: 135,
      name: invoice.billingName ?? invoice.company.name,
      email: invoice.billingEmail,
      address: invoice.billingAddress,
      taxId: invoice.billingTaxId,
    });

    doc.fontSize(9).font("Helvetica").text(
      `Issued: ${invoice.issuedAt?.toLocaleString() ?? "-"}`,
      50,
      260,
    );

    doc.text(`Paid: ${invoice.paidAt?.toLocaleString() ?? "-"}`, 50, 275);

    if (invoice.cashfreePaymentId) {
      doc.text(`Payment ID: ${invoice.cashfreePaymentId}`, 50, 290);
    }

    let y = 335;

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Description", 50, y);
    doc.text("Qty", 320, y);
    doc.text("Unit", 380, y);
    doc.text("Total", 470, y, {
      align: "right",
      width: 70,
    });

    y += 18;

    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").stroke();
    doc.strokeColor("#111827");
    y += 12;

    doc.fontSize(9).font("Helvetica");

    for (const line of invoice.lines) {
      doc.text(line.description, 50, y, {
        width: 250,
      });

      doc.text(String(line.quantity), 320, y);
      doc.text(money(line.unitAmountPaise, invoice.currency), 380, y);
      doc.text(money(line.totalPaise, invoice.currency), 470, y, {
        align: "right",
        width: 70,
      });

      y += 24;
    }

    writeTotals({
      doc,
      currency: invoice.currency,
      subtotalPaise: invoice.subtotalPaise,
      taxPaise: invoice.taxPaise,
      totalPaise: invoice.totalPaise,
    });

    writeFooter(doc);

    doc.end();

    const buffer = await bufferPromise;

    await logPdfRender({
      companyId,
      type: "INVOICE",
      invoiceId: invoice.id,
      status: "GENERATED",
      fileName,
      sizeBytes: buffer.length,
    });

    return {
      fileName,
      buffer,
      contentType: "application/pdf",
    };
  } catch (error) {
    await logPdfRender({
      companyId,
      type: "INVOICE",
      invoiceId,
      status: "FAILED",
      fileName,
      failureReason:
        error instanceof Error ? error.message : "Unknown PDF generation error",
    });

    throw error;
  }
}

export async function generateCreditNotePdf({
  companyId,
  creditNoteId,
}: {
  companyId: string;
  creditNoteId: string;
}) {
  if (!isEnabled()) {
    throw new BillingDocumentPdfError("Billing PDFs are disabled.");
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
      invoice: true,
      refund: true,
    },
  });

  if (!creditNote) {
    throw new BillingDocumentPdfError("Credit note not found.");
  }

  const fileName = `${creditNote.creditNoteNumber}.pdf`;

  try {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Credit Note ${creditNote.creditNoteNumber}`,
        Author: "metawhat",
      },
    });

    const bufferPromise = collectPdfBuffer(doc);

    writeHeader(doc, "Credit Note", creditNote.creditNoteNumber);

    writePartyBlock({
      doc,
      title: "Customer",
      x: 50,
      y: 135,
      name:
        creditNote.invoice?.billingName ??
        creditNote.company.billingProfile?.legalName ??
        creditNote.company.name,
      email:
        creditNote.invoice?.billingEmail ??
        creditNote.company.billingProfile?.billingEmail,
      address:
        creditNote.invoice?.billingAddress ??
        [
          creditNote.company.billingProfile?.addressLine1,
          creditNote.company.billingProfile?.addressLine2,
          creditNote.company.billingProfile?.city,
          creditNote.company.billingProfile?.state,
          creditNote.company.billingProfile?.postalCode,
          creditNote.company.billingProfile?.country,
        ]
          .filter(Boolean)
          .join(", "),
      taxId:
        creditNote.invoice?.billingTaxId ??
        creditNote.company.billingProfile?.taxId,
    });

    doc.fontSize(9).font("Helvetica").text(
      `Issued: ${creditNote.issuedAt.toLocaleString()}`,
      50,
      250,
    );

    if (creditNote.invoice?.invoiceNumber) {
      doc.text(`Against Invoice: ${creditNote.invoice.invoiceNumber}`, 50, 265);
    }

    if (creditNote.refund?.cashfreeRefundId) {
      doc.text(`Refund ID: ${creditNote.refund.cashfreeRefundId}`, 50, 280);
    }

    let y = 335;

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Description", 50, y);
    doc.text("Amount", 450, y, {
      align: "right",
      width: 90,
    });

    y += 18;

    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").stroke();
    doc.strokeColor("#111827");
    y += 14;

    doc.fontSize(9).font("Helvetica");
    doc.text(creditNote.reason ?? "Credit note", 50, y, {
      width: 300,
    });

    doc.text(money(creditNote.totalPaise, creditNote.currency), 450, y, {
      align: "right",
      width: 90,
    });

    writeTotals({
      doc,
      currency: creditNote.currency,
      subtotalPaise: creditNote.subtotalPaise,
      taxPaise: creditNote.taxPaise,
      totalPaise: creditNote.totalPaise,
    });

    writeFooter(doc);

    doc.end();

    const buffer = await bufferPromise;

    await logPdfRender({
      companyId,
      type: "CREDIT_NOTE",
      creditNoteId: creditNote.id,
      status: "GENERATED",
      fileName,
      sizeBytes: buffer.length,
    });

    return {
      fileName,
      buffer,
      contentType: "application/pdf",
    };
  } catch (error) {
    await logPdfRender({
      companyId,
      type: "CREDIT_NOTE",
      creditNoteId,
      status: "FAILED",
      fileName,
      failureReason:
        error instanceof Error ? error.message : "Unknown PDF generation error",
    });

    throw error;
  }
}

export async function getBillingPdfHealth() {
  const [generated24h, failed24h, totalGenerated] = await Promise.all([
    prisma.billingDocumentPdfRender.count({
      where: {
        status: "GENERATED",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingDocumentPdfRender.count({
      where: {
        status: "FAILED",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingDocumentPdfRender.count({
      where: {
        status: "GENERATED",
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    attachToEmails: process.env.BILLING_PDFS_ATTACH_TO_EMAILS !== "false",
    generated24h,
    failed24h,
    totalGenerated,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
