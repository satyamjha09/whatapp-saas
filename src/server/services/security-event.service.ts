import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { createIncident } from "@/server/services/incident.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

type RecordSecurityEventInput = {
  type: string;
  severity: string;
  source: string;
  summary: string;
  method?: string | null;
  path?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordSecurityEvent(input: RecordSecurityEventInput) {
  const securityEvent = await prisma.securityEvent.create({
    data: {
      type: input.type,
      severity: input.severity,
      source: input.source,
      summary: input.summary,
      method: input.method ?? null,
      path: input.path ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata
        ? (redactSensitiveData(input.metadata) as Prisma.InputJsonValue)
        : undefined,
    },
  });

  if (["HIGH", "CRITICAL"].includes(input.severity)) {
    await createIncident({
      companyId: null,
      title: `Security event: ${input.type}`,
      description: input.summary,
      source: "SECURITY",
      severity: input.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
      idempotencyKey: `security-event:${input.type}:${input.path ?? "unknown"}:${input.ipAddress ?? "unknown"}`,
      metadata: {
        securityEventId: securityEvent.id,
        type: input.type,
        path: input.path,
        method: input.method,
        source: input.source,
      },
    }).catch(() => undefined);
  }

  return securityEvent;
}

export async function getSecurityEventById({
  eventId,
}: {
  eventId: string;
}) {
  return prisma.securityEvent.findUnique({
    where: {
      id: eventId,
    },
  });
}

export async function resolveSecurityEvent({
  eventId,
  resolvedByUserId,
  resolutionNote,
}: {
  eventId: string;
  resolvedByUserId: string;
  resolutionNote?: string | null;
}) {
  return prisma.securityEvent.update({
    where: {
      id: eventId,
    },
    data: {
      resolvedAt: new Date(),
      resolvedByUserId,
      resolutionNote: resolutionNote?.slice(0, 1000) ?? null,
    },
  });
}

export async function reopenSecurityEvent({
  eventId,
}: {
  eventId: string;
}) {
  return prisma.securityEvent.update({
    where: {
      id: eventId,
    },
    data: {
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
    },
  });
}
