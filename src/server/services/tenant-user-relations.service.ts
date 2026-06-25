import { prisma } from "@/lib/prisma";

export function getAssignedContactsForWorkspace({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  return prisma.contact.findMany({
    where: {
      companyId,
      assignedToUserId: userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export function getInboxNotesForWorkspace({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  return prisma.inboxNote.findMany({
    where: {
      companyId,
      authorUserId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          countryCode: true,
          phoneNumber: true,
        },
      },
    },
  });
}

export function getPrivacyRequestsForWorkspace({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  return prisma.privacyRequest.findMany({
    where: {
      companyId,
      requestedByUserId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          countryCode: true,
          phoneNumber: true,
        },
      },
    },
  });
}
