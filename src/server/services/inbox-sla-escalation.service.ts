import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";

type ProcessInboxSlaBreachesInput = {
  companyId?: string;
  limit?: number;
};

export async function processInboxSlaBreaches(
  input: ProcessInboxSlaBreachesInput = {},
) {
  const now = new Date();
  const limit = input.limit ?? 100;

  const contacts = await prisma.contact.findMany({
    where: {
      ...(input.companyId
        ? {
            companyId: input.companyId,
          }
        : {}),
      inboxStatus: "OPEN",
      inboxSlaDueAt: {
        lt: now,
      },
      inboxSlaBreachedAt: null,
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      inboxSlaDueAt: "asc",
    },
    take: limit,
  });

  let breachedCount = 0;

  for (const contact of contacts) {
    const updated = await prisma.contact.updateMany({
      where: {
        id: contact.id,
        companyId: contact.companyId,
        inboxStatus: "OPEN",
        inboxSlaDueAt: {
          lt: now,
        },
        inboxSlaBreachedAt: null,
      },
      data: {
        inboxSlaBreachedAt: now,
        inboxSlaEscalationCount: {
          increment: 1,
        },
      },
    });

    if (updated.count === 0) {
      continue;
    }

    await createAuditLog({
      companyId: contact.companyId,
      actorUserId: null,
      action: "inbox.sla.breached",
      entityType: "Contact",
      entityId: contact.id,
      metadata: {
        contactId: contact.id,
        contactName: contact.name,
        phoneNumber: contact.phoneNumber,
        countryCode: contact.countryCode,
        priority: contact.inboxPriority,
        slaDueAt: contact.inboxSlaDueAt,
        breachedAt: now,
        assignedToUserId: contact.assignedToUserId,
        assignedToEmail: contact.assignedTo?.email ?? null,
      },
    });

    breachedCount += 1;
  }

  return {
    scanned: contacts.length,
    breached: breachedCount,
  };
}
