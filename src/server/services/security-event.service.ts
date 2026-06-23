import { prisma } from "@/lib/prisma";

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
