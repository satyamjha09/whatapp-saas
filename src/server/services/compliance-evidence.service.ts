import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  ComplianceEvidenceExportType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createIncident } from "@/server/services/incident.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.COMPLIANCE_EVIDENCE_CENTER_ENABLED !== "false";
}

function exportDir() {
  return (
    process.env.COMPLIANCE_EVIDENCE_EXPORT_DIR ||
    "./private/compliance-evidence"
  );
}

function exportTtlHours() {
  const parsed = Number(process.env.COMPLIANCE_EVIDENCE_EXPORT_TTL_HOURS ?? 72);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

function maxRangeDays() {
  const parsed = Number(process.env.COMPLIANCE_EVIDENCE_MAX_RANGE_DAYS ?? 365);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 365;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function token() {
  return crypto.randomBytes(10).toString("hex");
}

function assertDateRange(dateFrom: Date, dateTo: Date) {
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new Error("Invalid evidence export date range");
  }

  if (dateFrom >= dateTo) {
    throw new Error("dateFrom must be before dateTo");
  }

  const rangeDays =
    (dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000);

  if (rangeDays > maxRangeDays()) {
    throw new Error(`Date range cannot exceed ${maxRangeDays()} days`);
  }
}

function resolvedExportDir() {
  const configured = exportDir();

  if (path.isAbsolute(configured)) {
    return configured;
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

async function ensureDir() {
  await fs.mkdir(resolvedExportDir(), {
    recursive: true,
  });
}

async function writeEvidenceFile({
  companyId,
  exportId,
  data,
}: {
  companyId: string;
  exportId: string;
  data: unknown;
}) {
  await ensureDir();

  const fileName = `compliance-evidence-${companyId}-${exportId}-${token()}.json`;
  const filePath = path.join(resolvedExportDir(), fileName);

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");

  return {
    fileName,
    filePath,
  };
}

export function getComplianceEvidenceConfig() {
  return {
    enabled: isEnabled(),
    exportDir: exportDir(),
    exportTtlHours: exportTtlHours(),
    maxRangeDays: maxRangeDays(),
  };
}

export async function createComplianceEvidenceExport({
  companyId,
  contactId,
  requestedByUserId,
  type,
  dateFrom,
  dateTo,
}: {
  companyId: string;
  contactId?: string | null;
  requestedByUserId?: string | null;
  type: ComplianceEvidenceExportType;
  dateFrom: Date;
  dateTo: Date;
}) {
  if (!isEnabled()) {
    throw new Error("Compliance Evidence Center is disabled");
  }

  assertDateRange(dateFrom, dateTo);

  if (type === "CONTACT_COMPLIANCE") {
    if (!contactId) {
      throw new Error("contactId is required for CONTACT_COMPLIANCE export");
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    if (!contact) {
      throw new Error("Contact not found");
    }
  }

  return prisma.complianceEvidenceExport.create({
    data: {
      companyId,
      contactId: contactId ?? null,
      requestedByUserId: requestedByUserId ?? null,
      type,
      dateFrom,
      dateTo,
      metadata: safeJson({
        maxRangeDays: maxRangeDays(),
        exportTtlHours: exportTtlHours(),
      }),
    },
  });
}

async function buildContactEvidence({
  companyId,
  contactId,
  dateFrom,
  dateTo,
}: {
  companyId: string;
  contactId: string;
  dateFrom: Date;
  dateTo: Date;
}) {
  const [contact, consentEvents, privacyRequests, messages, auditLogs] =
    await Promise.all([
      prisma.contact.findFirst({
        where: {
          id: contactId,
          companyId,
        },
      }),
      prisma.contactConsentEvent.findMany({
        where: {
          companyId,
          contactId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.privacyRequest.findMany({
        where: {
          companyId,
          contactId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.message.findMany({
        where: {
          companyId,
          contactId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          events: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        where: {
          companyId,
          entityId: contactId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

  return {
    contact,
    consentEvents,
    privacyRequests,
    messages,
    auditLogs,
  };
}

async function buildCompanyEvidence({
  companyId,
  dateFrom,
  dateTo,
}: {
  companyId: string;
  dateFrom: Date;
  dateTo: Date;
}) {
  const [
    company,
    consentSummary,
    privacySummary,
    auditLogs,
    incidents,
    securityEvents,
    dataRetentionRuns,
    legalHolds,
    statusPageIncidents,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
        name: true,
        billingPlan: true,
        subscriptionStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.contactConsentEvent.groupBy({
      by: ["type", "status", "source"],
      where: {
        companyId,
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _count: {
        id: true,
      },
    }),
    prisma.privacyRequest.groupBy({
      by: ["type", "status", "source"],
      where: {
        companyId,
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _count: {
        id: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        companyId,
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 10_000,
    }),
    prisma.incident.findMany({
      where: {
        companyId,
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        timeline: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    prisma.securityEvent.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 10_000,
    }),
    prisma.dataRetentionRun.findMany({
      where: {
        startedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        startedAt: "asc",
      },
      include: {
        items: true,
      },
    }),
    prisma.legalHold.findMany({
      where: {
        OR: [{ companyId }, { companyId: null }],
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.statusPageIncident.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        startedAt: "asc",
      },
      include: {
        updates: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
  ]);

  return {
    company,
    consentSummary,
    privacySummary,
    auditLogs,
    incidents,
    securityEvents,
    dataRetentionRuns,
    legalHolds,
    statusPageIncidents,
  };
}

async function buildPrivacyEvidence({
  companyId,
  dateFrom,
  dateTo,
}: {
  companyId: string;
  dateFrom: Date;
  dateTo: Date;
}) {
  const [privacyRequests, publicPrivacyVerifications, summary] =
    await Promise.all([
      prisma.privacyRequest.findMany({
        where: {
          companyId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.publicPrivacyVerification.findMany({
        where: {
          OR: [{ companyId }, { companyId: null }],
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.privacyRequest.groupBy({
        by: ["type", "status", "source"],
        where: {
          companyId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        _count: {
          id: true,
        },
      }),
    ]);

  return {
    privacyRequests,
    publicPrivacyVerifications,
    summary,
  };
}

async function buildSecurityEvidence({
  dateFrom,
  dateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
}) {
  const [securityEvents, incidents, auditIntegrity] = await Promise.all([
    prisma.securityEvent.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 20_000,
    }),
    prisma.incident.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        timeline: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        integrityHash: {
          not: null,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 20_000,
      select: {
        id: true,
        companyId: true,
        action: true,
        entityType: true,
        entityId: true,
        integrityHash: true,
        previousIntegrityHash: true,
        integrityVersion: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    securityEvents,
    incidents,
    auditIntegrity,
  };
}

async function buildRetentionEvidence({
  dateFrom,
  dateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
}) {
  const [policies, runs, legalHolds] = await Promise.all([
    prisma.dataRetentionPolicy.findMany({
      orderBy: {
        entityType: "asc",
      },
    }),
    prisma.dataRetentionRun.findMany({
      where: {
        startedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        startedAt: "asc",
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    prisma.legalHold.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  return {
    policies,
    runs,
    legalHolds,
  };
}

export async function processComplianceEvidenceExport({
  exportId,
}: {
  exportId: string;
}) {
  const evidenceExport = await prisma.complianceEvidenceExport.findUnique({
    where: {
      id: exportId,
    },
  });

  if (!evidenceExport) {
    throw new Error("Compliance evidence export not found");
  }

  await prisma.complianceEvidenceExport.update({
    where: {
      id: exportId,
    },
    data: {
      status: "PROCESSING",
      failureReason: null,
      failedAt: null,
    },
  });

  try {
    let evidence: unknown;

    if (evidenceExport.type === "CONTACT_COMPLIANCE") {
      if (!evidenceExport.contactId) {
        throw new Error("contactId is required");
      }

      evidence = await buildContactEvidence({
        companyId: evidenceExport.companyId,
        contactId: evidenceExport.contactId,
        dateFrom: evidenceExport.dateFrom,
        dateTo: evidenceExport.dateTo,
      });
    } else if (evidenceExport.type === "PRIVACY_COMPLIANCE") {
      evidence = await buildPrivacyEvidence({
        companyId: evidenceExport.companyId,
        dateFrom: evidenceExport.dateFrom,
        dateTo: evidenceExport.dateTo,
      });
    } else if (evidenceExport.type === "SECURITY_COMPLIANCE") {
      evidence = await buildSecurityEvidence({
        dateFrom: evidenceExport.dateFrom,
        dateTo: evidenceExport.dateTo,
      });
    } else if (evidenceExport.type === "RETENTION_COMPLIANCE") {
      evidence = await buildRetentionEvidence({
        dateFrom: evidenceExport.dateFrom,
        dateTo: evidenceExport.dateTo,
      });
    } else {
      evidence = await buildCompanyEvidence({
        companyId: evidenceExport.companyId,
        dateFrom: evidenceExport.dateFrom,
        dateTo: evidenceExport.dateTo,
      });
    }

    const pack = {
      generatedAt: new Date().toISOString(),
      exportId,
      type: evidenceExport.type,
      companyId: evidenceExport.companyId,
      contactId: evidenceExport.contactId,
      dateFrom: evidenceExport.dateFrom.toISOString(),
      dateTo: evidenceExport.dateTo.toISOString(),
      disclaimer:
        "This file is a system-generated evidence export. Review with legal/compliance advisors before external submission.",
      evidence: redactSensitiveData(evidence),
    };

    const { fileName, filePath } = await writeEvidenceFile({
      companyId: evidenceExport.companyId,
      exportId,
      data: pack,
    });
    const expiresAt = new Date(
      Date.now() + exportTtlHours() * 60 * 60 * 1000,
    );

    return prisma.complianceEvidenceExport.update({
      where: {
        id: exportId,
      },
      data: {
        status: "COMPLETED",
        fileName,
        filePath,
        expiresAt,
        processedAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });
  } catch (error) {
    const failureReason =
      error instanceof Error
        ? error.message
        : "Unknown compliance evidence export error";

    await prisma.complianceEvidenceExport.update({
      where: {
        id: exportId,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason,
      },
    });

    await createIncident({
      companyId: evidenceExport.companyId,
      title: "Compliance evidence export failed",
      description: failureReason,
      source: "SYSTEM",
      severity: "HIGH",
      idempotencyKey: `compliance-evidence-export-failed:${exportId}`,
      metadata: {
        exportId,
        type: evidenceExport.type,
      },
    }).catch(() => undefined);

    throw error;
  }
}

export async function listComplianceEvidenceExports({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.complianceEvidenceExport.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    include: {
      contact: true,
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getComplianceEvidenceExport({
  companyId,
  exportId,
}: {
  companyId: string;
  exportId: string;
}) {
  return prisma.complianceEvidenceExport.findFirst({
    where: {
      id: exportId,
      companyId,
    },
  });
}

export async function cleanupExpiredComplianceEvidenceExports() {
  const expired = await prisma.complianceEvidenceExport.findMany({
    where: {
      status: "COMPLETED",
      filePath: {
        not: null,
      },
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  let deleted = 0;

  for (const item of expired) {
    if (item.filePath) {
      await fs.unlink(item.filePath).catch(() => undefined);
    }

    await prisma.complianceEvidenceExport.update({
      where: {
        id: item.id,
      },
      data: {
        status: "EXPIRED",
        filePath: null,
        fileName: null,
      },
    });

    deleted += 1;
  }

  return {
    deleted,
  };
}

export async function getComplianceEvidenceHealth() {
  const [completed24h, failed24h, pending, expiredFiles] = await Promise.all([
    prisma.complianceEvidenceExport.count({
      where: {
        status: "COMPLETED",
        processedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.complianceEvidenceExport.count({
      where: {
        status: "FAILED",
        failedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.complianceEvidenceExport.count({
      where: {
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
    }),
    prisma.complianceEvidenceExport.count({
      where: {
        status: "COMPLETED",
        expiresAt: {
          lt: new Date(),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    completed24h,
    failed24h,
    pending,
    expiredFiles,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
