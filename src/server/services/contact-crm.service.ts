import { prisma } from "@/lib/prisma";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { queueLeadScoreRecalculation } from "@/server/services/lead-scoring.service";

export async function getContactCrmProfile({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  return prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      inboxTags: {
        include: {
          tag: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      _count: {
        select: {
          messages: true,
          inboxNotes: true,
        },
      },
    },
  });
}

export async function updateContactCrmProfile({
  companyId,
  contactId,
  actorUserId,
  data,
}: {
  companyId: string;
  contactId: string;
  actorUserId?: string | null;
  data: {
    name?: string | null;
    email?: string | null;
    companyName?: string | null;
    externalCustomerId?: string | null;
    lifecycleStage?: string | null;
  };
}) {
  const before = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
  });

  if (!before) {
    throw new Error("Contact not found");
  }

  const contact = await prisma.contact.update({
    where: {
      id: contactId,
    },
    data: {
      name: data.name ?? before.name,
      email: data.email ?? before.email,
      companyName: data.companyName ?? before.companyName,
      externalCustomerId:
        data.externalCustomerId ?? before.externalCustomerId,
      lifecycleStage: data.lifecycleStage ?? before.lifecycleStage,
      lastProfileUpdatedAt: new Date(),
    },
  });

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: "PROFILE_UPDATED",
    title: "Customer profile updated",
    metadata: {
      before: {
        name: before.name,
        email: before.email,
        companyName: before.companyName,
        externalCustomerId: before.externalCustomerId,
        lifecycleStage: before.lifecycleStage,
      },
      after: {
        name: contact.name,
        email: contact.email,
        companyName: contact.companyName,
        externalCustomerId: contact.externalCustomerId,
        lifecycleStage: contact.lifecycleStage,
      },
    },
  });

  await queueLeadScoreRecalculation(companyId, contactId).catch(() => undefined);

  return contact;
}
