import {
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function normalizeMetadata(metadata?: unknown) {
  return metadata
    ? (redactSensitiveData(metadata) as Prisma.InputJsonValue)
    : undefined;
}

export async function createIncident({
  companyId,
  title,
  description,
  source,
  severity = "MEDIUM",
  idempotencyKey,
  metadata,
}: {
  companyId?: string | null;
  title: string;
  description?: string | null;
  source: IncidentSource;
  severity?: IncidentSeverity;
  idempotencyKey?: string | null;
  metadata?: unknown;
}) {
  const effectiveIdempotencyKey = idempotencyKey ?? `incident:${source}:${title}`;
  const normalizedMetadata = normalizeMetadata(metadata);

  const incident = await prisma.incident.upsert({
    where: {
      idempotencyKey: effectiveIdempotencyKey,
    },
    create: {
      companyId: companyId ?? null,
      title,
      description: description ?? null,
      source,
      severity,
      status: "OPEN",
      idempotencyKey: effectiveIdempotencyKey,
      metadata: normalizedMetadata,
      timeline: {
        create: {
          type: "CREATED",
          message: "Incident opened",
          metadata: normalizedMetadata,
        },
      },
    },
    update: {
      status: "OPEN",
      severity,
      resolvedAt: null,
      resolvedByUserId: null,
      description: description ?? undefined,
      metadata: normalizedMetadata,
      timeline: {
        create: {
          type: "SYSTEM_UPDATE",
          message: "Incident signal received again",
          metadata: normalizedMetadata,
        },
      },
    },
    include: {
      timeline: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
    },
  });

  if (companyId && ["HIGH", "CRITICAL"].includes(severity)) {
    await createCompanyNotification({
      companyId,
      type: "SYSTEM",
      severity: severity === "CRITICAL" ? "ERROR" : "WARNING",
      title,
      message: description ?? "A production incident needs attention.",
      actionHref: `/dashboard/incidents/${incident.id}`,
      idempotencyKey: `incident-notification:${incident.id}`,
      metadata: {
        incidentId: incident.id,
        source,
        severity,
      },
    }).catch(() => undefined);
  }

  return incident;
}

export async function getIncidentSummary({ companyId }: { companyId?: string }) {
  const where = companyId ? { companyId } : {};

  const [open, acknowledged, criticalOpen, highOpen, recent] = await Promise.all([
    prisma.incident.count({
      where: {
        ...where,
        status: "OPEN",
      },
    }),
    prisma.incident.count({
      where: {
        ...where,
        status: "ACKNOWLEDGED",
      },
    }),
    prisma.incident.count({
      where: {
        ...where,
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
        severity: "CRITICAL",
      },
    }),
    prisma.incident.count({
      where: {
        ...where,
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
        severity: "HIGH",
      },
    }),
    prisma.incident.findMany({
      where,
      orderBy: {
        openedAt: "desc",
      },
      take: 10,
    }),
  ]);

  return {
    isHealthy: criticalOpen === 0 && highOpen === 0,
    open,
    acknowledged,
    criticalOpen,
    highOpen,
    recent,
  };
}

export async function listIncidents({
  companyId,
  status,
  take = 50,
}: {
  companyId?: string;
  status?: IncidentStatus;
  take?: number;
}) {
  return prisma.incident.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: {
      openedAt: "desc",
    },
    take,
  });
}

export async function getIncidentById({
  incidentId,
  companyId,
}: {
  incidentId: string;
  companyId?: string;
}) {
  return prisma.incident.findFirst({
    where: {
      id: incidentId,
      ...(companyId ? { companyId } : {}),
    },
    include: {
      timeline: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function acknowledgeIncident({
  incidentId,
  actorUserId,
  message,
}: {
  incidentId: string;
  companyId?: string;
  actorUserId?: string | null;
  message?: string;
}) {
  return prisma.incident.update({
    where: {
      id: incidentId,
    },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: actorUserId ?? null,
      timeline: {
        create: {
          actorUserId: actorUserId ?? null,
          type: "ACKNOWLEDGED",
          message: message ?? "Incident acknowledged",
        },
      },
    },
    include: {
      timeline: true,
    },
  });
}

export async function resolveIncident({
  incidentId,
  actorUserId,
  message,
}: {
  incidentId: string;
  actorUserId?: string | null;
  message?: string;
}) {
  return prisma.incident.update({
    where: {
      id: incidentId,
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: actorUserId ?? null,
      timeline: {
        create: {
          actorUserId: actorUserId ?? null,
          type: "RESOLVED",
          message: message ?? "Incident resolved",
        },
      },
    },
    include: {
      timeline: true,
    },
  });
}

export async function reopenIncident({
  incidentId,
  actorUserId,
  message,
}: {
  incidentId: string;
  actorUserId?: string | null;
  message?: string;
}) {
  return prisma.incident.update({
    where: {
      id: incidentId,
    },
    data: {
      status: "OPEN",
      resolvedAt: null,
      resolvedByUserId: null,
      timeline: {
        create: {
          actorUserId: actorUserId ?? null,
          type: "REOPENED",
          message: message ?? "Incident reopened",
        },
      },
    },
    include: {
      timeline: true,
    },
  });
}
