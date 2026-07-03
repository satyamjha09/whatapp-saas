import Papa from "papaparse";
import {
  Prisma,
  ContactConsentStatus,
  ContactConsentSource,
  ContactImportDuplicateStrategy,
  ContactImportRowStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getContactImportQueue } from "@/lib/queue";
import {
  detectColumnMapping,
  parseImportFile,
  resolveImportFileType,
  sanitizeImportFileName,
  ImportFileParseError,
} from "@/lib/contacts/import-file-parser";
import { normalizePhoneNumber } from "@/lib/contacts/phone-normalizer";
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

/* -------------------------------------------------------------------------
 * Contact Import Wizard (Import & Broadcast Suite - Phase 16A)
 *
 * Multi-step flow: upload -> mapping -> validate -> start -> worker import.
 * Reuses ContactImportJob/ContactImportRow, ContactGroup (lists) and
 * InboxTag (tags).
 * ------------------------------------------------------------------------- */

export type ContactImportWizardMapping = {
  phoneNumber: string;
  name?: string;
  countryCode?: string;
  email?: string;
  companyName?: string;
  tags?: string;
  city?: string;
  source?: string;
  customAttributes?: Record<string, string>;
  marketingConsentStatus?: string;
  marketingConsentProof?: string;
  marketingConsentSource?: string;
};

type WizardNormalizedRow = {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  companyName: string;
  city: string;
  source: string;
  tags: string[];
  customAttributes: Record<string, string>;
  marketingConsentStatus: string;
  marketingConsentProof: string;
  marketingConsentSource: string;
  fileDuplicate: boolean;
};

const IMPORT_ROW_BATCH_SIZE = 100;
const VALIDATE_BATCH_SIZE = 500;
const ROW_CREATE_CHUNK_SIZE = 1000;
const SAMPLE_ROW_LIMIT = 20;

function maxFileSizeBytes() {
  const value = Number(process.env.CONTACT_IMPORT_MAX_FILE_MB ?? 10);
  const megabytes = Number.isFinite(value) && value > 0 ? value : 10;
  return megabytes * 1024 * 1024;
}

// TODO: Replace with plan-based entitlements once contact limits are added to
// the plan gating system (feature-entitlement.service / plan-limit.service).
function maxTotalContacts() {
  const value = Number(process.env.CONTACT_IMPORT_MAX_TOTAL_CONTACTS ?? 100000);
  return Number.isFinite(value) && value > 0 ? value : 100000;
}

function splitTagsValue(value: string) {
  return String(value ?? "")
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= 60)
    .slice(0, 20);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseWizardMapping(job: { columnMapping: Prisma.JsonValue }) {
  const mapping = (job.columnMapping ?? null) as ContactImportWizardMapping | null;

  if (!mapping || !mapping.phoneNumber) {
    throw new ContactImportError("Phone number column mapping is required.");
  }

  return mapping;
}

async function requireWizardJob({
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
  });

  if (!job) {
    throw new ContactImportError("Contact import not found.");
  }

  return job;
}

export async function uploadContactImportFile({
  companyId,
  actorUserId,
  fileName,
  fileSizeBytes,
  buffer,
}: {
  companyId: string;
  actorUserId: string;
  fileName: string;
  fileSizeBytes: number;
  buffer: Buffer;
}) {
  if (!enabled()) {
    throw new ContactImportError("Contact import is disabled.");
  }

  const fileType = resolveImportFileType(fileName);

  if (!fileType) {
    throw new ContactImportError("Only .csv and .xlsx files are supported.");
  }

  if (fileSizeBytes > maxFileSizeBytes()) {
    throw new ContactImportError(
      `File is too large. Maximum size is ${Math.round(maxFileSizeBytes() / (1024 * 1024))}MB.`,
    );
  }

  let parsed;

  try {
    parsed = await parseImportFile({
      fileType,
      buffer,
      maxRows: maxRows(),
    });
  } catch (error) {
    if (error instanceof ImportFileParseError) {
      throw new ContactImportError(error.message);
    }

    throw error;
  }

  const safeFileName = sanitizeImportFileName(fileName);
  const detectedMapping = detectColumnMapping(parsed.headers);

  const job = await prisma.contactImportJob.create({
    data: {
      companyId,
      actorUserId,
      status: "MAPPING",
      fileName: safeFileName,
      fileType,
      fileSizeBytes,
      totalRows: parsed.rows.length,
      headers: safeJson(parsed.headers),
    },
  });

  for (let index = 0; index < parsed.rows.length; index += ROW_CREATE_CHUNK_SIZE) {
    const chunk = parsed.rows.slice(index, index + ROW_CREATE_CHUNK_SIZE);

    await prisma.contactImportRow.createMany({
      data: chunk.map((raw, chunkIndex) => ({
        companyId,
        jobId: job.id,
        rowNumber: index + chunkIndex + 2,
        status: "PENDING" as ContactImportRowStatus,
        raw: safeJson(raw),
      })),
    });
  }

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.import_uploaded",
    entityType: "ContactImportJob",
    entityId: job.id,
    metadata: {
      fileName: safeFileName,
      fileType,
      fileSizeBytes,
      totalRows: parsed.rows.length,
    },
  }).catch(() => undefined);

  return {
    importId: job.id,
    fileName: safeFileName,
    fileType,
    totalRows: parsed.rows.length,
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, SAMPLE_ROW_LIMIT),
    detectedMapping,
  };
}

export async function saveContactImportMapping({
  companyId,
  actorUserId,
  jobId,
  columnMapping,
  defaultCountryCode,
  duplicateStrategy,
  tags,
  contactGroupId,
  createGroupName,
}: {
  companyId: string;
  actorUserId: string;
  jobId: string;
  columnMapping: ContactImportWizardMapping;
  defaultCountryCode?: string | null;
  duplicateStrategy: ContactImportDuplicateStrategy;
  tags?: string[];
  contactGroupId?: string | null;
  createGroupName?: string | null;
}) {
  const job = await requireWizardJob({ companyId, jobId });

  if (!["MAPPING", "READY"].includes(job.status)) {
    throw new ContactImportError(
      `Mapping cannot be changed while the import is ${job.status}.`,
    );
  }

  const headers = Array.isArray(job.headers) ? (job.headers as string[]) : [];

  if (!columnMapping.phoneNumber || !headers.includes(columnMapping.phoneNumber)) {
    throw new ContactImportError("Phone number column mapping is required.");
  }

  if (contactGroupId) {
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: contactGroupId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    if (!group) {
      throw new ContactImportError("Contact list not found.");
    }
  }

  const cleanTags = (tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= 60)
    .slice(0, 20);

  const updated = await prisma.contactImportJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: "MAPPING",
      columnMapping: safeJson(columnMapping),
      defaultCountryCode: defaultCountryCode?.replace(/\D/g, "") || null,
      duplicateStrategy,
      tags: cleanTags,
      contactGroupId: contactGroupId || null,
      createGroupName: createGroupName?.trim() || null,
      errorMessage: null,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.import_mapping_saved",
    entityType: "ContactImportJob",
    entityId: job.id,
    metadata: {
      duplicateStrategy,
      hasGroup: Boolean(contactGroupId || createGroupName),
      tagCount: cleanTags.length,
    },
  }).catch(() => undefined);

  return updated;
}

function normalizeWizardRow({
  raw,
  mapping,
  defaultCountryCode,
}: {
  raw: Record<string, unknown>;
  mapping: ContactImportWizardMapping;
  defaultCountryCode?: string | null;
}): {
  normalized: WizardNormalizedRow;
  error: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];

  const read = (key?: string) => (key ? String(raw[key] ?? "").trim() : "");

  const name = read(mapping.name);
  let email = read(mapping.email).toLowerCase();
  const companyName = read(mapping.companyName);
  const city = read(mapping.city);
  const source = read(mapping.source);
  const phoneRaw = read(mapping.phoneNumber);
  const rowCountryCode = read(mapping.countryCode).replace(/\D/g, "");

  const customAttributes: Record<string, string> = {};

  for (const [attributeKey, header] of Object.entries(mapping.customAttributes ?? {})) {
    const value = read(header);
    if (value) customAttributes[attributeKey] = value;
  }

  const consentStatus = normalizeConsentStatus(read(mapping.marketingConsentStatus));
  const consentProof = read(mapping.marketingConsentProof);
  const consentSource = read(mapping.marketingConsentSource) || "IMPORT";

  const normalized: WizardNormalizedRow = {
    name,
    email,
    phone: "",
    countryCode: "",
    companyName,
    city,
    source,
    tags: splitTagsValue(read(mapping.tags)),
    customAttributes,
    marketingConsentStatus: consentStatus,
    marketingConsentProof: consentProof,
    marketingConsentSource: consentSource,
    fileDuplicate: false,
  };

  if (!phoneRaw) {
    return { normalized, error: "Phone number is missing.", warnings };
  }

  const phone = normalizePhoneNumber(phoneRaw, rowCountryCode || defaultCountryCode);

  if (!phone.ok) {
    return { normalized, error: phone.error ?? "Phone number is invalid.", warnings };
  }

  warnings.push(...phone.warnings);

  normalized.phone = phone.nationalNumber;
  normalized.countryCode = phone.countryCode;

  if (email && !isValidEmail(email)) {
    warnings.push("Email is invalid and was ignored.");
    email = "";
    normalized.email = "";
  }

  if (!name) {
    warnings.push("Name is missing.");
  }

  if (
    consentStatus === "GRANTED" &&
    requireConsentProofForGranted() &&
    !consentProof
  ) {
    return {
      normalized,
      error: "Consent proof is required for GRANTED consent.",
      warnings,
    };
  }

  if (consentStatus === "GRANTED" && !allowConsentGrantedWithProof()) {
    return {
      normalized,
      error: "Importing GRANTED consent is disabled.",
      warnings,
    };
  }

  return { normalized, error: null, warnings };
}

export async function validateContactImport({
  companyId,
  actorUserId,
  jobId,
}: {
  companyId: string;
  actorUserId: string;
  jobId: string;
}) {
  const job = await requireWizardJob({ companyId, jobId });

  if (!["MAPPING", "READY"].includes(job.status)) {
    throw new ContactImportError(
      `Import cannot be validated while it is ${job.status}.`,
    );
  }

  const mapping = parseWizardMapping(job);

  const currentContacts = await prisma.contact.count({
    where: {
      companyId,
    },
  });

  const seenPhones = new Set<string>();
  const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
  const rowWarnings: Array<{ rowNumber: number; message: string }> = [];

  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  let cursorRowNumber = 0;

  for (;;) {
    const rows = await prisma.contactImportRow.findMany({
      where: {
        companyId,
        jobId,
        rowNumber: {
          gt: cursorRowNumber,
        },
      },
      orderBy: {
        rowNumber: "asc",
      },
      take: VALIDATE_BATCH_SIZE,
      select: {
        id: true,
        rowNumber: true,
        raw: true,
      },
    });

    if (rows.length === 0) break;

    cursorRowNumber = rows[rows.length - 1].rowNumber;

    const evaluated = rows.map((row) => {
      const result = normalizeWizardRow({
        raw: (row.raw ?? {}) as Record<string, unknown>,
        mapping,
        defaultCountryCode: job.defaultCountryCode,
      });

      return { row, ...result };
    });

    const phonesInBatch = evaluated
      .filter((entry) => !entry.error && entry.normalized.phone)
      .map((entry) => entry.normalized.phone);

    const existingContacts = phonesInBatch.length
      ? await prisma.contact.findMany({
          where: {
            companyId,
            phoneNumber: {
              in: phonesInBatch,
            },
          },
          select: {
            phoneNumber: true,
          },
        })
      : [];

    const existingPhones = new Set(
      existingContacts.map((contact) => contact.phoneNumber),
    );

    const updates = evaluated.map(({ row, normalized, error, warnings }) => {
      let status: ContactImportRowStatus;
      let errorMessage: string | null = error;
      const allWarnings = [...warnings];

      if (error) {
        status = "INVALID";
        invalidRows += 1;

        if (errors.length < 100) {
          errors.push({
            rowNumber: row.rowNumber,
            field: "phoneNumber",
            message: error,
          });
        }
      } else {
        const phoneKey = `${normalized.countryCode}${normalized.phone}`;

        if (seenPhones.has(phoneKey)) {
          normalized.fileDuplicate = true;
          status = "DUPLICATE";
          duplicateRows += 1;
          allWarnings.push("Duplicate phone number within file.");
        } else if (existingPhones.has(normalized.phone)) {
          seenPhones.add(phoneKey);
          status = "DUPLICATE";
          duplicateRows += 1;
          allWarnings.push("Contact already exists.");
        } else {
          seenPhones.add(phoneKey);
          status = "VALID";
          validRows += 1;
        }

        errorMessage = null;
      }

      if (allWarnings.length > 0 && rowWarnings.length < 100) {
        rowWarnings.push({
          rowNumber: row.rowNumber,
          message: allWarnings.join(" "),
        });
      }

      return prisma.contactImportRow.update({
        where: {
          id: row.id,
        },
        data: {
          status,
          normalized: safeJson(normalized),
          warnings:
            allWarnings.length > 0 ? safeJson(allWarnings) : Prisma.JsonNull,
          phone: normalized.phone || null,
          countryCode: normalized.countryCode || null,
          email: normalized.email || null,
          name: normalized.name || null,
          errorMessage,
          consentStatus: normalized.marketingConsentStatus,
          consentProof: normalized.marketingConsentProof || null,
          contactId: null,
        },
      });
    });

    await prisma.$transaction(updates);
  }

  const totalRows = validRows + invalidRows + duplicateRows;
  const importable = validRows + duplicateRows;

  let jobError: string | null = null;

  if (importable === 0) {
    jobError = "No valid rows to import.";
  } else if (currentContacts + validRows > maxTotalContacts()) {
    jobError = `Import would exceed the maximum of ${maxTotalContacts()} contacts.`;
  }

  await prisma.contactImportJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: jobError ? "MAPPING" : "READY",
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
      readyRows: importable,
      errorMessage: jobError,
      previewSummary: safeJson({
        totalRows,
        validRows,
        invalidRows,
        duplicateRows,
      }),
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.import_validated",
    entityType: "ContactImportJob",
    entityId: job.id,
    metadata: {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
    },
  }).catch(() => undefined);

  if (jobError) {
    throw new ContactImportError(jobError);
  }

  return {
    summary: {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
    },
    errors,
    warnings: rowWarnings,
  };
}

export async function startContactImport({
  companyId,
  actorUserId,
  jobId,
}: {
  companyId: string;
  actorUserId: string;
  jobId: string;
}) {
  const job = await requireWizardJob({ companyId, jobId });

  if (job.status !== "READY") {
    throw new ContactImportError(
      `Import cannot start while it is ${job.status}. Validate the rows first.`,
    );
  }

  parseWizardMapping(job);

  let contactGroupId = job.contactGroupId;

  if (!contactGroupId && job.createGroupName) {
    const group = await prisma.contactGroup.upsert({
      where: {
        companyId_name: {
          companyId,
          name: job.createGroupName,
        },
      },
      update: {},
      create: {
        companyId,
        name: job.createGroupName,
      },
    });

    contactGroupId = group.id;
  }

  const updated = await prisma.contactImportJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: "IMPORTING",
      contactGroupId,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.import_started",
    entityType: "ContactImportJob",
    entityId: job.id,
    metadata: {
      totalRows: job.totalRows,
      validRows: job.validRows,
      duplicateRows: job.duplicateRows,
      duplicateStrategy: job.duplicateStrategy,
    },
  }).catch(() => undefined);

  await getContactImportQueue().add(
    "contact-import",
    {
      companyId,
      importId: job.id,
    },
    {
      jobId: `contact-import:${companyId}:${job.id}`,
    },
  );

  return updated;
}

export async function cancelContactImport({
  companyId,
  actorUserId,
  jobId,
}: {
  companyId: string;
  actorUserId: string;
  jobId: string;
}) {
  const job = await requireWizardJob({ companyId, jobId });

  if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
    throw new ContactImportError(`Import is already ${job.status}.`);
  }

  const updated = await prisma.contactImportJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.import_cancelled",
    entityType: "ContactImportJob",
    entityId: job.id,
    metadata: {
      previousStatus: job.status,
    },
  }).catch(() => undefined);

  return updated;
}

export async function getContactImportWizardJob({
  companyId,
  jobId,
}: {
  companyId: string;
  jobId: string;
}) {
  const job = await requireWizardJob({ companyId, jobId });

  return {
    id: job.id,
    status: job.status,
    fileName: job.fileName,
    fileType: job.fileType,
    totalRows: job.totalRows,
    validRows: job.validRows,
    invalidRows: job.invalidRows,
    duplicateRows: job.duplicateRows,
    importedRows: job.importedRows,
    skippedRows: job.skippedRows,
    failedRows: job.failedRows,
    duplicateStrategy: job.duplicateStrategy,
    defaultCountryCode: job.defaultCountryCode,
    tags: job.tags,
    contactGroupId: job.contactGroupId,
    createGroupName: job.createGroupName,
    headers: Array.isArray(job.headers) ? (job.headers as string[]) : [],
    columnMapping: (job.columnMapping ?? null) as ContactImportWizardMapping | null,
    errorMessage: job.errorMessage,
    summary: job.summary,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
  };
}

export async function listContactImportRows({
  companyId,
  jobId,
  status,
  page = 1,
  pageSize = 50,
}: {
  companyId: string;
  jobId: string;
  status?: ContactImportRowStatus;
  page?: number;
  pageSize?: number;
}) {
  await requireWizardJob({ companyId, jobId });

  const take = Math.min(Math.max(pageSize, 1), 200);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    companyId,
    jobId,
    ...(status ? { status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.contactImportRow.findMany({
      where,
      orderBy: {
        rowNumber: "asc",
      },
      skip,
      take,
      select: {
        id: true,
        rowNumber: true,
        status: true,
        name: true,
        email: true,
        phone: true,
        countryCode: true,
        errorMessage: true,
        warnings: true,
        contactId: true,
      },
    }),
    prisma.contactImportRow.count({ where }),
  ]);

  return {
    rows,
    total,
    page: Math.max(page, 1),
    pageSize: take,
  };
}

async function resolveImportTagIds({
  companyId,
  tagNames,
  cache,
}: {
  companyId: string;
  tagNames: string[];
  cache: Map<string, string>;
}) {
  const tagIds: string[] = [];

  for (const rawName of tagNames) {
    const name = rawName.trim();

    if (!name) continue;

    const cached = cache.get(name.toLowerCase());

    if (cached) {
      tagIds.push(cached);
      continue;
    }

    const tag = await prisma.inboxTag.upsert({
      where: {
        companyId_name: {
          companyId,
          name,
        },
      },
      update: {},
      create: {
        companyId,
        name,
      },
    });

    cache.set(name.toLowerCase(), tag.id);
    tagIds.push(tag.id);
  }

  return tagIds;
}

async function importWizardRow({
  job,
  row,
  tagCache,
}: {
  job: {
    id: string;
    companyId: string;
    actorUserId: string | null;
    duplicateStrategy: ContactImportDuplicateStrategy;
    tags: string[];
    contactGroupId: string | null;
  };
  row: {
    id: string;
    rowNumber: number;
    normalized: Prisma.JsonValue;
    phone: string | null;
    countryCode: string | null;
  };
  tagCache: Map<string, string>;
}) {
  const companyId = job.companyId;
  const normalized = (row.normalized ?? {}) as Partial<WizardNormalizedRow>;
  const phone = row.phone ?? normalized.phone ?? "";
  const countryCode = row.countryCode ?? normalized.countryCode ?? "";

  if (!phone) {
    await prisma.contactImportRow.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        errorMessage: "Row has no normalized phone number.",
      },
    });

    return;
  }

  if (normalized.fileDuplicate) {
    await prisma.contactImportRow.update({
      where: { id: row.id },
      data: {
        status: "SKIPPED",
        errorMessage: "Duplicate row within file skipped.",
      },
    });

    return;
  }

  const existing = await prisma.contact.findUnique({
    where: {
      companyId_phoneNumber: {
        companyId,
        phoneNumber: phone,
      },
    },
  });

  if (
    existing &&
    (job.duplicateStrategy === "SKIP_EXISTING" ||
      job.duplicateStrategy === "CREATE_NEW_ONLY")
  ) {
    await prisma.contactImportRow.update({
      where: { id: row.id },
      data: {
        status: "SKIPPED",
        contactId: existing.id,
        errorMessage: "Existing contact skipped.",
      },
    });

    return;
  }

  const consentGranted = normalized.marketingConsentStatus === "GRANTED";
  let contactId: string;
  let consentApplied = false;

  if (existing) {
    // UPDATE_EXISTING: only set non-empty fields, never wipe existing values
    // and never touch opt-out/block status.
    const existingAttributes =
      (existing.customAttributes as Record<string, string> | null) ?? {};
    const newAttributes = normalized.customAttributes ?? {};
    const mergedAttributes = { ...existingAttributes, ...newAttributes };

    const canApplyConsent =
      consentGranted &&
      !existing.optedOutAt &&
      existing.marketingConsentStatus === "UNKNOWN";

    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: normalized.name || undefined,
        email: normalized.email || undefined,
        companyName: normalized.companyName || undefined,
        city: normalized.city || undefined,
        customAttributes:
          Object.keys(mergedAttributes).length > 0
            ? safeJson(mergedAttributes)
            : undefined,
        marketingConsentStatus: canApplyConsent ? "GRANTED" : undefined,
        marketingConsentAt: canApplyConsent ? new Date() : undefined,
        marketingConsentSource: canApplyConsent
          ? ("IMPORT" as ContactConsentSource)
          : undefined,
      },
    });

    contactId = existing.id;
    consentApplied = canApplyConsent;
  } else {
    try {
      const contact = await prisma.contact.create({
        data: {
          companyId,
          phoneNumber: phone,
          countryCode: countryCode || "91",
          name: normalized.name || null,
          email: normalized.email || null,
          companyName: normalized.companyName || null,
          city: normalized.city || null,
          source: normalized.source || "IMPORT",
          customAttributes:
            normalized.customAttributes &&
            Object.keys(normalized.customAttributes).length > 0
              ? safeJson(normalized.customAttributes)
              : undefined,
          marketingConsentStatus: (normalized.marketingConsentStatus ??
            "UNKNOWN") as ContactConsentStatus,
          marketingConsentAt: consentGranted ? new Date() : null,
          marketingConsentSource: consentGranted
            ? ("IMPORT" as ContactConsentSource)
            : null,
        },
      });

      contactId = contact.id;
      consentApplied = consentGranted;
    } catch (error) {
      // Unique-constraint race (e.g. worker retry): fall back to the
      // existing contact according to the duplicate strategy.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await prisma.contact.findUnique({
          where: {
            companyId_phoneNumber: {
              companyId,
              phoneNumber: phone,
            },
          },
          select: { id: true },
        });

        if (raced) {
          await prisma.contactImportRow.update({
            where: { id: row.id },
            data: {
              status: "SKIPPED",
              contactId: raced.id,
              errorMessage: "Existing contact skipped.",
            },
          });

          return;
        }
      }

      throw error;
    }
  }

  const tagNames = [
    ...job.tags,
    ...(Array.isArray(normalized.tags) ? normalized.tags : []),
  ];

  if (tagNames.length > 0) {
    const tagIds = await resolveImportTagIds({
      companyId,
      tagNames,
      cache: tagCache,
    });

    if (tagIds.length > 0) {
      await prisma.contactInboxTag.createMany({
        data: tagIds.map((tagId) => ({
          companyId,
          contactId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (job.contactGroupId) {
    await prisma.contactGroupMember.upsert({
      where: {
        groupId_contactId: {
          groupId: job.contactGroupId,
          contactId,
        },
      },
      update: {},
      create: {
        groupId: job.contactGroupId,
        contactId,
      },
    });
  }

  if (consentApplied) {
    await recordContactConsent({
      companyId,
      contactId,
      type: "WHATSAPP_MARKETING",
      status: "GRANTED",
      source: "IMPORT",
      actorUserId: job.actorUserId ?? undefined,
      evidenceText: normalized.marketingConsentProof || undefined,
      metadata: {
        source: normalized.marketingConsentSource || "IMPORT",
        importJobId: job.id,
        importRowId: row.id,
      },
    }).catch(() => undefined);
  }

  await prisma.contactImportRow.update({
    where: { id: row.id },
    data: {
      status: "IMPORTED",
      contactId,
      errorMessage: null,
    },
  });
}

async function refreshWizardJobCounters(jobId: string) {
  const grouped = await prisma.contactImportRow.groupBy({
    by: ["status"],
    where: {
      jobId,
    },
    _count: {
      _all: true,
    },
  });

  const countFor = (status: ContactImportRowStatus) =>
    grouped.find((entry) => entry.status === status)?._count._all ?? 0;

  return prisma.contactImportJob.update({
    where: {
      id: jobId,
    },
    data: {
      importedRows: countFor("IMPORTED"),
      skippedRows: countFor("SKIPPED"),
      failedRows: countFor("FAILED"),
    },
  });
}

export async function processContactImportJob({
  companyId,
  importId,
}: {
  companyId: string;
  importId: string;
}) {
  const job = await prisma.contactImportJob.findFirst({
    where: {
      id: importId,
      companyId,
    },
  });

  if (!job) {
    console.warn(`Contact import ${importId} not found for company ${companyId}.`);
    return;
  }

  if (job.status !== "IMPORTING") {
    console.log(`Contact import ${importId} is ${job.status}; nothing to process.`);
    return;
  }

  const tagCache = new Map<string, string>();

  try {
    for (;;) {
      const currentStatus = await prisma.contactImportJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });

      if (currentStatus?.status === "CANCELLED") {
        console.log(`Contact import ${importId} was cancelled; stopping.`);
        await refreshWizardJobCounters(job.id);
        return;
      }

      const rows = await prisma.contactImportRow.findMany({
        where: {
          companyId,
          jobId: job.id,
          status: {
            in: ["VALID", "DUPLICATE"],
          },
        },
        orderBy: {
          rowNumber: "asc",
        },
        take: IMPORT_ROW_BATCH_SIZE,
        select: {
          id: true,
          rowNumber: true,
          normalized: true,
          phone: true,
          countryCode: true,
        },
      });

      if (rows.length === 0) break;

      for (const row of rows) {
        try {
          await importWizardRow({
            job: {
              id: job.id,
              companyId,
              actorUserId: job.actorUserId,
              duplicateStrategy: job.duplicateStrategy,
              tags: job.tags,
              contactGroupId: job.contactGroupId,
            },
            row,
            tagCache,
          });
        } catch (error) {
          await prisma.contactImportRow.update({
            where: { id: row.id },
            data: {
              status: "FAILED",
              errorMessage:
                error instanceof Error ? error.message : "Import row failed.",
            },
          });
        }
      }

      await refreshWizardJobCounters(job.id);
    }

    const finalized = await refreshWizardJobCounters(job.id);

    await prisma.contactImportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        errorMessage:
          finalized.failedRows > 0
            ? `${finalized.failedRows} row(s) failed to import.`
            : null,
        summary: safeJson({
          totalRows: finalized.totalRows,
          validRows: finalized.validRows,
          duplicateRows: finalized.duplicateRows,
          invalidRows: finalized.invalidRows,
          importedRows: finalized.importedRows,
          skippedRows: finalized.skippedRows,
          failedRows: finalized.failedRows,
        }),
      },
    });

    await createAuditLog({
      companyId,
      actorUserId: job.actorUserId ?? undefined,
      action: "contacts.import_completed",
      entityType: "ContactImportJob",
      entityId: job.id,
      metadata: {
        importedRows: finalized.importedRows,
        skippedRows: finalized.skippedRows,
        failedRows: finalized.failedRows,
      },
    }).catch(() => undefined);
  } catch (error) {
    await prisma.contactImportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Contact import failed.",
      },
    });

    await createAuditLog({
      companyId,
      actorUserId: job.actorUserId ?? undefined,
      action: "contacts.import_failed",
      entityType: "ContactImportJob",
      entityId: job.id,
      metadata: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch(() => undefined);

    throw error;
  }
}
