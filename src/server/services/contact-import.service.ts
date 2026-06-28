import Papa from "papaparse";
import { Prisma, ContactConsentStatus, ContactConsentSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { recordContactConsent } from "@/server/services/contact-consent.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class ContactImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactImportError";
  }
}

type FieldMapping = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  companyName?: string;
};

type ConsentMapping = {
  marketingConsentStatus?: string;
  marketingConsentProof?: string;
  marketingConsentSource?: string;
};

function enabled() {
  return process.env.CONTACT_IMPORT_ENABLED !== "false";
}

function maxRows() {
  const value = Number(process.env.CONTACT_IMPORT_MAX_ROWS ?? 10000);
  return Number.isFinite(value) && value > 0 ? value : 10000;
}

function previewLimit() {
  const value = Number(process.env.CONTACT_IMPORT_PREVIEW_LIMIT ?? 100);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function requireConsentProofForGranted() {
  return process.env.CONTACT_IMPORT_REQUIRE_CONSENT_PROOF_FOR_GRANTED !== "false";
}

function allowConsentGrantedWithProof() {
  return process.env.CONTACT_IMPORT_ALLOW_CONSENT_GRANTED_WITH_PROOF !== "false";
}

function defaultConsentStatus() {
  return process.env.CONTACT_IMPORT_DEFAULT_CONSENT_STATUS || "UNKNOWN";
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function cleanPhone(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeConsentStatus(value?: string | null) {
  const status = String(value ?? defaultConsentStatus()).trim().toUpperCase();

  if (["GRANTED", "DENIED", "REVOKED", "UNKNOWN"].includes(status)) {
    return status as "GRANTED" | "DENIED" | "REVOKED" | "UNKNOWN";
  }

  if (["YES", "Y", "TRUE", "1", "OPTIN", "OPT_IN"].includes(status)) {
    return "GRANTED" as const;
  }

  if (["NO", "N", "FALSE", "0"].includes(status)) {
    return "UNKNOWN" as const;
  }

  return "UNKNOWN" as const;
}

function readMappedValue(row: Record<string, unknown>, key?: string) {
  if (!key) return "";
  return String(row[key] ?? "").trim();
}

function normalizeRow({
  row,
  fieldMapping,
  consentMapping,
}: {
  row: Record<string, unknown>;
  fieldMapping: FieldMapping;
  consentMapping: ConsentMapping;
}) {
  const name = readMappedValue(row, fieldMapping.name);
  const email = readMappedValue(row, fieldMapping.email).toLowerCase();
  const phone = cleanPhone(readMappedValue(row, fieldMapping.phone));
  const city = readMappedValue(row, fieldMapping.city);
  const companyName = readMappedValue(row, fieldMapping.companyName);

  const consentStatus = normalizeConsentStatus(
    readMappedValue(row, consentMapping.marketingConsentStatus),
  );

  const consentProof = readMappedValue(
    row,
    consentMapping.marketingConsentProof,
  );

  const consentSource =
    readMappedValue(row, consentMapping.marketingConsentSource) || "IMPORT";

  let errorMessage: string | null = null;

  if (!phone && !email) {
    errorMessage = "Phone or email is required.";
  }

  if (phone && phone.length < 10) {
    errorMessage = "Phone number is invalid.";
  }

  if (
    consentStatus === "GRANTED" &&
    requireConsentProofForGranted() &&
    !consentProof
  ) {
    errorMessage = "Consent proof is required for GRANTED consent.";
  }

  if (consentStatus === "GRANTED" && !allowConsentGrantedWithProof()) {
    errorMessage = "Importing GRANTED consent is disabled.";
  }

  return {
    name,
    email,
    phone,
    city,
    companyName,
    marketingConsentStatus: consentStatus,
    marketingConsentProof: consentProof,
    marketingConsentSource: consentSource,
    errorMessage,
  };
}

function parseCsv(csvText: string) {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new ContactImportError(parsed.errors[0]?.message || "CSV parse failed.");
  }

  return parsed.data;
}

export async function previewContactImport({
  companyId,
  actorUserId,
  fileName,
  csvText,
  fieldMapping,
  consentMapping,
  duplicateStrategy = "UPDATE_EXISTING",
}: {
  companyId: string;
  actorUserId: string;
  fileName?: string | null;
  csvText: string;
  fieldMapping: FieldMapping;
  consentMapping: ConsentMapping;
  duplicateStrategy?: "UPDATE_EXISTING" | "SKIP_EXISTING";
}) {
  if (!enabled()) {
    throw new ContactImportError("Contact import is disabled.");
  }

  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    throw new ContactImportError("CSV has no rows.");
  }

  if (rows.length > maxRows()) {
    throw new ContactImportError(`CSV cannot have more than ${maxRows()} rows.`);
  }

  const normalizedRows = rows.map((row, index) => {
    const normalized = normalizeRow({
      row,
      fieldMapping,
      consentMapping,
    });

    return {
      rowNumber: index + 2,
      raw: row,
      normalized,
      status: normalized.errorMessage ? ("SKIPPED" as const) : ("READY" as const),
    };
  });

  const readyRows = normalizedRows.filter((row) => row.status === "READY").length;
  const skippedRows = normalizedRows.filter((row) => row.status === "SKIPPED").length;

  const job = await prisma.contactImportJob.create({
    data: {
      companyId,
      actorUserId,
      status: "PREVIEWED",
      duplicateStrategy,
      fileName: fileName ?? null,
      totalRows: normalizedRows.length,
      readyRows,
      skippedRows,
      fieldMapping: safeJson(fieldMapping),
      consentMapping: safeJson(consentMapping),
      previewSummary: safeJson({
        previewLimit: previewLimit(),
        readyRows,
        skippedRows,
      }),
      rows: {
        createMany: {
          data: normalizedRows.map((row) => ({
            companyId,
            rowNumber: row.rowNumber,
            status: row.status,
            raw: safeJson(row.raw),
            normalized: safeJson(row.normalized),
            phone: row.normalized.phone || null,
            email: row.normalized.email || null,
            name: row.normalized.name || null,
            errorMessage: row.normalized.errorMessage,
            consentStatus: row.normalized.marketingConsentStatus,
            consentProof: row.normalized.marketingConsentProof || null,
          })),
        },
      },
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.import_preview_created",
    entityType: "ContactImportJob",
    entityId: job.id,
    metadata: {
      fileName,
      totalRows: normalizedRows.length,
      readyRows,
      skippedRows,
    },
  }).catch(() => undefined);

  return getContactImportJob({
    companyId,
    jobId: job.id,
  });
}

export async function getContactImportJob({
  companyId,
  jobId,
}: {
  companyId: string;
  jobId: string;
}) {
  const job = await prisma.contactImportJob.findFirst({
    where: {
      id: jobId,
      companyId,
    },
    include: {
      rows: {
        orderBy: {
          rowNumber: "asc",
        },
        take: previewLimit(),
      },
    },
  });

  if (!job) {
    throw new ContactImportError("Contact import job not found.");
  }

  return job;
}

async function findExistingContact({
  companyId,
  email,
  phone,
}: {
  companyId: string;
  email?: string | null;
  phone?: string | null;
}) {
  const conditions = [];

  if (email) {
    conditions.push({
      email,
    });
  }

  if (phone) {
    conditions.push({
      phoneNumber: phone,
    });
  }

  if (conditions.length === 0) return null;

  return prisma.contact.findFirst({
    where: {
      companyId,
      OR: conditions,
    },
  });
}

export async function runContactImport({
  companyId,
  actorUserId,
  jobId,
}: {
  companyId: string;
  actorUserId: string;
  jobId: string;
}) {
  if (!enabled()) {
    throw new ContactImportError("Contact import is disabled.");
  }

  const job = await prisma.contactImportJob.findFirst({
    where: {
      id: jobId,
      companyId,
    },
  });

  if (!job) {
    throw new ContactImportError("Contact import job not found.");
  }

  if (job.status !== "PREVIEWED") {
    throw new ContactImportError(`Import cannot run from ${job.status} status.`);
  }

  const rows = await prisma.contactImportRow.findMany({
    where: {
      companyId,
      jobId,
      status: "READY",
    },
    orderBy: {
      rowNumber: "asc",
    },
  });

  await prisma.contactImportJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: "IMPORTING",
      startedAt: new Date(),
    },
  });

  let importedRows = 0;
  let failedRows = 0;

  for (const row of rows) {
    const normalized = row.normalized as Record<string, string>;

    try {
      const existing = await findExistingContact({
        companyId,
        email: normalized.email,
        phone: normalized.phone,
      });

      if (existing && job.duplicateStrategy === "SKIP_EXISTING") {
        await prisma.contactImportRow.update({
          where: {
            id: row.id,
          },
          data: {
            status: "SKIPPED",
            contactId: existing.id,
            errorMessage: "Duplicate contact skipped.",
          },
        });

        continue;
      }

      const contact = existing
        ? await prisma.contact.update({
            where: {
              id: existing.id,
            },
            data: {
              name: normalized.name || existing.name,
              email: normalized.email || existing.email,
              phoneNumber: normalized.phone || existing.phoneNumber,
              companyName: normalized.companyName || undefined,
              marketingConsentStatus:
                (normalized.marketingConsentStatus as ContactConsentStatus) || existing.marketingConsentStatus,
              marketingConsentAt:
                normalized.marketingConsentStatus === "GRANTED"
                  ? new Date()
                  : existing.marketingConsentAt,
              marketingConsentSource:
                normalized.marketingConsentStatus === "GRANTED"
                  ? ("IMPORT" as ContactConsentSource)
                  : existing.marketingConsentSource,
            },
          })
        : await prisma.contact.create({
            data: {
              companyId,
              name: normalized.name || null,
              email: normalized.email || null,
              phoneNumber: normalized.phone || "",
              companyName: normalized.companyName || null,
              marketingConsentStatus: normalized.marketingConsentStatus as ContactConsentStatus,
              marketingConsentAt:
                normalized.marketingConsentStatus === "GRANTED"
                  ? new Date()
                  : null,
              marketingConsentSource:
                normalized.marketingConsentStatus === "GRANTED"
                  ? ("IMPORT" as ContactConsentSource)
                  : null,
            },
          });

      if (normalized.marketingConsentStatus === "GRANTED") {
        await recordContactConsent({
          companyId,
          contactId: contact.id,
          type: "WHATSAPP_MARKETING",
          status: "GRANTED",
          source: "IMPORT",
          actorUserId,
          evidenceText: normalized.marketingConsentProof,
          metadata: {
            source: normalized.marketingConsentSource,
            importJobId: job.id,
            importRowId: row.id,
          },
        }).catch(() => undefined);
      }

      await prisma.contactImportRow.update({
        where: {
          id: row.id,
        },
        data: {
          status: "IMPORTED",
          contactId: contact.id,
        },
      });

      importedRows += 1;
    } catch (error) {
      failedRows += 1;

      await prisma.contactImportRow.update({
        where: {
          id: row.id,
        },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Import row failed.",
        },
      });
    }
  }

  const completed = await prisma.contactImportJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: failedRows > 0 ? "FAILED" : "COMPLETED",
      importedRows,
      failedRows,
      completedAt: failedRows === 0 ? new Date() : undefined,
      failedAt: failedRows > 0 ? new Date() : undefined,
      errorMessage: failedRows > 0 ? `${failedRows} rows failed.` : null,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.import_completed",
    entityType: "ContactImportJob",
    entityId: job.id,
    metadata: {
      importedRows,
      failedRows,
    },
  }).catch(() => undefined);

  return completed;
}

export async function getContactImportDashboard(companyId: string) {
  const jobs = await prisma.contactImportJob.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  return {
    jobs,
  };
}

export async function getContactImportHealth() {
  const [jobs, completed, failed, importedRows] = await Promise.all([
    prisma.contactImportJob.count().catch(() => 0),

    prisma.contactImportJob.count({
      where: {
        status: "COMPLETED",
      },
    }).catch(() => 0),

    prisma.contactImportJob.count({
      where: {
        status: "FAILED",
      },
    }).catch(() => 0),

    prisma.contactImportRow.count({
      where: {
        status: "IMPORTED",
      },
    }).catch(() => 0),
  ]);

  return {
    enabled: enabled(),
    jobs,
    completed,
    failed,
    importedRows,
    maxRows: maxRows(),
    requireConsentProofForGranted: requireConsentProofForGranted(),
    isHealthy: enabled(),
  };
}
