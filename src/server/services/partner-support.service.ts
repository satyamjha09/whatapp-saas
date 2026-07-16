import {
  CompanyType,
  Prisma,
  type PartnerSupportCommentVisibility,
  type PartnerSupportTicketEventType,
  type PartnerSupportTicketPriority,
  type PartnerSupportTicketStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  CreatePartnerSupportTicketInput,
  UpdatePartnerSupportTicketInput,
} from "@/server/validators/partner-support.validator";

export class PartnerSupportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerSupportError";
    this.status = status;
  }
}

const ticketInclude = {
  partnerCompany: { select: { id: true, name: true, type: true, status: true } },
  clientCompany: { select: { id: true, name: true, type: true, status: true } },
  openedBy: { select: { id: true, name: true, email: true } },
  assignedPlatformUser: { select: { id: true, name: true, email: true } },
  comments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  },
  events: {
    orderBy: { createdAt: "asc" },
    include: { actorUser: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.PartnerSupportTicketInclude;

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function normalizeOptionalId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getSlaDueDates(priority: PartnerSupportTicketPriority) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const firstResponseMs = {
    URGENT: hour,
    HIGH: 4 * hour,
    NORMAL: day,
    LOW: 2 * day,
  }[priority];
  const resolutionMs = {
    URGENT: 8 * hour,
    HIGH: day,
    NORMAL: 3 * day,
    LOW: 5 * day,
  }[priority];

  return {
    firstResponseDueAt: new Date(now + firstResponseMs),
    resolutionDueAt: new Date(now + resolutionMs),
  };
}

async function assertPartnerCompany(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: { id: partnerCompanyId },
    select: { id: true, name: true, type: true, status: true },
  });

  if (!partner) throw new PartnerSupportError("Partner workspace not found.", 404);
  if (partner.type !== CompanyType.PARTNER) {
    throw new PartnerSupportError("Partner workspace required.", 403);
  }
  if (partner.status !== "ACTIVE" && partner.status !== "PENDING_ONBOARDING") {
    throw new PartnerSupportError("Partner workspace is not active.", 403);
  }

  return partner;
}

async function assertClientBelongsToPartner({
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
}) {
  const relationship = await prisma.partnerClientRelationship.findUnique({
    where: {
      partnerCompanyId_clientCompanyId: { partnerCompanyId, clientCompanyId },
    },
    include: {
      clientCompany: {
        select: { id: true, name: true, type: true, status: true, parentCompanyId: true },
      },
    },
  });

  if (!relationship || relationship.clientCompany.parentCompanyId !== partnerCompanyId) {
    throw new PartnerSupportError("Client does not belong to this partner.", 403);
  }

  return relationship.clientCompany;
}

async function recordTicketEvent({
  actorUserId,
  clientCompanyId,
  message,
  metadata,
  newValues,
  partnerCompanyId,
  previousValues,
  ticketId,
  type,
}: {
  ticketId: string;
  partnerCompanyId: string;
  clientCompanyId?: string | null;
  actorUserId?: string | null;
  type: PartnerSupportTicketEventType;
  previousValues?: unknown;
  newValues?: unknown;
  message?: string | null;
  metadata?: unknown;
}) {
  return prisma.partnerSupportTicketEvent.create({
    data: {
      ticketId,
      partnerCompanyId,
      clientCompanyId: clientCompanyId ?? null,
      actorUserId: actorUserId ?? null,
      type,
      previousValues: previousValues ? safeJson(previousValues) : undefined,
      newValues: newValues ? safeJson(newValues) : undefined,
      message: message ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

export async function listPartnerSupportTickets({
  partnerCompanyId,
  status,
}: {
  partnerCompanyId: string;
  status?: PartnerSupportTicketStatus;
}) {
  await assertPartnerCompany(partnerCompanyId);

  return prisma.partnerSupportTicket.findMany({
    where: {
      partnerCompanyId,
      ...(status ? { status } : {}),
    },
    include: ticketInclude,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });
}

export async function listPlatformPartnerSupportTickets({
  status,
}: {
  status?: PartnerSupportTicketStatus;
} = {}) {
  return prisma.partnerSupportTicket.findMany({
    where: status ? { status } : undefined,
    include: ticketInclude,
    orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
}

export async function getPartnerSupportTicketForPartner({
  partnerCompanyId,
  ticketId,
}: {
  partnerCompanyId: string;
  ticketId: string;
}) {
  const ticket = await prisma.partnerSupportTicket.findFirst({
    where: { id: ticketId, partnerCompanyId },
    include: ticketInclude,
  });

  if (!ticket) throw new PartnerSupportError("Support ticket not found.", 404);
  return ticket;
}

export async function createPartnerSupportTicket({
  actorUserId,
  actorEmail,
  partnerCompanyId,
  input,
}: {
  actorUserId: string;
  actorEmail?: string | null;
  partnerCompanyId: string;
  input: CreatePartnerSupportTicketInput;
}) {
  await assertPartnerCompany(partnerCompanyId);
  const clientCompanyId = normalizeOptionalId(input.clientCompanyId);

  if (clientCompanyId) {
    await assertClientBelongsToPartner({ partnerCompanyId, clientCompanyId });
  }

  const priority = input.priority ?? "NORMAL";
  const sla = getSlaDueDates(priority);
  const ticket = await prisma.partnerSupportTicket.create({
    data: {
      partnerCompanyId,
      clientCompanyId,
      openedByUserId: actorUserId,
      subject: input.subject.trim(),
      description: input.description.trim(),
      category: input.category ?? "GENERAL",
      priority,
      ...sla,
    },
    include: ticketInclude,
  });

  await recordTicketEvent({
    ticketId: ticket.id,
    partnerCompanyId,
    clientCompanyId,
    actorUserId,
    type: "CREATED",
    newValues: {
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_support.ticket_created",
    entityType: "PartnerSupportTicket",
    entityId: ticket.id,
    metadata: { partnerCompanyId, clientCompanyId, priority: ticket.priority },
  }).catch(() => undefined);

  return ticket;
}

export async function updatePartnerSupportTicket({
  actorUserId,
  actorEmail,
  input,
  ticketId,
}: {
  actorUserId: string;
  actorEmail?: string | null;
  ticketId: string;
  input: UpdatePartnerSupportTicketInput;
}) {
  const current = await prisma.partnerSupportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!current) throw new PartnerSupportError("Support ticket not found.", 404);

  const nextStatus = input.status;
  const nextPriority = input.priority;
  const closedAt =
    nextStatus === "CLOSED" && current.status !== "CLOSED" ? new Date() : undefined;
  const resolvedAt =
    nextStatus === "RESOLVED" && current.status !== "RESOLVED"
      ? new Date()
      : undefined;

  const updated = await prisma.partnerSupportTicket.update({
    where: { id: ticketId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextPriority ? { priority: nextPriority } : {}),
      ...(input.assignedPlatformUserId !== undefined
        ? { assignedPlatformUserId: input.assignedPlatformUserId || null }
        : {}),
      ...(resolvedAt ? { resolvedAt } : {}),
      ...(closedAt ? { closedAt } : {}),
      ...(input.csatScore ? { csatScore: input.csatScore } : {}),
      ...(input.csatComment ? { csatComment: input.csatComment } : {}),
    },
    include: ticketInclude,
  });

  if (nextStatus && nextStatus !== current.status) {
    await recordTicketEvent({
      ticketId,
      partnerCompanyId: current.partnerCompanyId,
      clientCompanyId: current.clientCompanyId,
      actorUserId,
      type:
        nextStatus === "RESOLVED"
          ? "RESOLVED"
          : nextStatus === "CLOSED"
            ? "CLOSED"
            : "STATUS_CHANGED",
      previousValues: { status: current.status },
      newValues: { status: nextStatus },
    });
  }
  if (nextPriority && nextPriority !== current.priority) {
    await recordTicketEvent({
      ticketId,
      partnerCompanyId: current.partnerCompanyId,
      clientCompanyId: current.clientCompanyId,
      actorUserId,
      type: "PRIORITY_CHANGED",
      previousValues: { priority: current.priority },
      newValues: { priority: nextPriority },
    });
  }
  if (
    input.assignedPlatformUserId !== undefined &&
    input.assignedPlatformUserId !== current.assignedPlatformUserId
  ) {
    await recordTicketEvent({
      ticketId,
      partnerCompanyId: current.partnerCompanyId,
      clientCompanyId: current.clientCompanyId,
      actorUserId,
      type: "ASSIGNED",
      previousValues: { assignedPlatformUserId: current.assignedPlatformUserId },
      newValues: { assignedPlatformUserId: input.assignedPlatformUserId ?? null },
    });
  }
  if (input.csatScore) {
    await recordTicketEvent({
      ticketId,
      partnerCompanyId: current.partnerCompanyId,
      clientCompanyId: current.clientCompanyId,
      actorUserId,
      type: "CSAT_RECORDED",
      newValues: { csatScore: input.csatScore },
    });
  }

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_support.ticket_updated",
    entityType: "PartnerSupportTicket",
    entityId: ticketId,
    metadata: { input },
  }).catch(() => undefined);

  return updated;
}

export async function addPartnerSupportTicketComment({
  actorUserId,
  body,
  ticketId,
  visibility,
}: {
  actorUserId: string;
  ticketId: string;
  body: string;
  visibility: PartnerSupportCommentVisibility;
}) {
  const ticket = await prisma.partnerSupportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) throw new PartnerSupportError("Support ticket not found.", 404);

  const comment = await prisma.partnerSupportTicketComment.create({
    data: {
      ticketId,
      authorUserId: actorUserId,
      body: body.trim(),
      visibility,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  const updateData: Prisma.PartnerSupportTicketUpdateInput = {
    status: visibility === "INTERNAL" ? ticket.status : "PENDING_METAWHAT",
  };
  if (!ticket.firstRespondedAt && visibility === "INTERNAL") {
    updateData.firstRespondedAt = new Date();
  }
  await prisma.partnerSupportTicket.update({
    where: { id: ticketId },
    data: updateData,
  });

  await recordTicketEvent({
    ticketId,
    partnerCompanyId: ticket.partnerCompanyId,
    clientCompanyId: ticket.clientCompanyId,
    actorUserId,
    type: "COMMENT_ADDED",
    newValues: { visibility },
  });

  return comment;
}
