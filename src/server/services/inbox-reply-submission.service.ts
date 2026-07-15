import { prisma } from "@/lib/prisma";
import { createQueuedInboxReply } from "@/server/services/message.service";
import { CreateInboxReplyInput } from "@/server/validators/inbox-reply.validator";

function getServiceWindowEndsAt(startedAt: Date | null) {
  return startedAt
    ? new Date(startedAt.getTime() + 24 * 60 * 60 * 1000)
    : null;
}

function assertContactCanReceiveInboxReply(contact: {
  isBlocked: boolean;
  optedOutAt: Date | null;
  inboxLastCustomerMessageAt: Date | null;
}) {
  if (contact.isBlocked || contact.optedOutAt) {
    throw new Error("Contact has opted out or is blocked");
  }

  const expiresAt = getServiceWindowEndsAt(contact.inboxLastCustomerMessageAt);

  if (!expiresAt || expiresAt <= new Date()) {
    throw new Error("Customer service window has expired");
  }

  return expiresAt;
}

export type InboxReplySubmissionResult =
  | {
      status: "QUEUED";
      message: Awaited<ReturnType<typeof createQueuedInboxReply>>;
      approvalRequired: false;
    }
  | {
      status: "PENDING_APPROVAL";
      approval: Awaited<ReturnType<typeof prisma.inboxReplyApproval.create>>;
      approvalRequired: true;
    };

export async function submitInboxReply({
  companyId,
  contactId,
  actorUserId,
  input,
}: {
  companyId: string;
  contactId: string;
  actorUserId: string;
  input: CreateInboxReplyInput;
}): Promise<InboxReplySubmissionResult> {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
    include: {
      inboxQueue: true,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const expiresAt = assertContactCanReceiveInboxReply(contact);

  if (!contact.inboxQueue?.approvalRequired) {
    const message = await createQueuedInboxReply(companyId, contactId, input, {
      actorUserId,
    });

    return {
      status: "QUEUED",
      message,
      approvalRequired: false,
    };
  }

  const approval = await prisma.inboxReplyApproval.create({
    data: {
      companyId,
      contactId,
      queueId: contact.inboxQueueId,
      requestedByUserId: actorUserId,
      body: input.body,
      expiresAt,
      metadata: {
        source: "inbox_reply",
        policy: "queue_approval_required",
      },
    },
    include: {
      contact: true,
      queue: true,
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
    },
  });

  return {
    status: "PENDING_APPROVAL",
    approval,
    approvalRequired: true,
  };
}
