import { InboxReplyApprovalStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createTargetedCompanyNotification } from "@/server/services/company-notification.service";
import { createQueuedInboxReply } from "@/server/services/message.service";

function getServiceWindowEndsAt(startedAt: Date | null) {
  return startedAt
    ? new Date(startedAt.getTime() + 24 * 60 * 60 * 1000)
    : null;
}

function isExpiredApproval(approval: {
  expiresAt: Date | null;
  contact: {
    inboxLastCustomerMessageAt: Date | null;
  };
}) {
  const now = new Date();
  const contactWindowEndsAt = getServiceWindowEndsAt(
    approval.contact.inboxLastCustomerMessageAt,
  );
  const expiresAt = approval.expiresAt ?? contactWindowEndsAt;

  return !expiresAt || expiresAt <= now || !contactWindowEndsAt || contactWindowEndsAt <= now;
}

async function notifyRequester({
  companyId,
  approvalId,
  requestedByUserId,
  title,
  message,
  severity = "INFO",
}: {
  companyId: string;
  approvalId: string;
  requestedByUserId: string;
  title: string;
  message: string;
  severity?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}) {
  await createTargetedCompanyNotification({
    companyId,
    userIds: [requestedByUserId],
    type: "INBOX",
    severity,
    title,
    message,
    actionHref: "/dashboard/inbox/approvals",
    idempotencyKey: `inbox-reply-approval:${approvalId}:${title}`,
    metadata: {
      approvalId,
      source: "inbox_reply_approval",
    },
  });
}

export async function listInboxReplyApprovals({
  companyId,
  status = "PENDING",
}: {
  companyId: string;
  status?: InboxReplyApprovalStatus;
}) {
  return prisma.inboxReplyApproval.findMany({
    where: {
      companyId,
      status,
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
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
      message: true,
    },
    orderBy: {
      submittedAt: "asc",
    },
    take: 100,
  });
}

export async function approveInboxReplyApproval({
  companyId,
  approvalId,
  reviewedByUserId,
}: {
  companyId: string;
  approvalId: string;
  reviewedByUserId: string;
}) {
  const approval = await prisma.inboxReplyApproval.findFirst({
    where: {
      id: approvalId,
      companyId,
    },
    include: {
      contact: true,
    },
  });

  if (!approval) {
    throw new Error("Approval request not found");
  }

  if (approval.status !== "PENDING") {
    throw new Error("Approval request is no longer pending");
  }

  if (isExpiredApproval(approval)) {
    const expiredApproval = await prisma.inboxReplyApproval.update({
      where: {
        id: approval.id,
      },
      data: {
        status: "EXPIRED",
        reviewedByUserId,
        reviewedAt: new Date(),
        metadata: {
          ...(typeof approval.metadata === "object" && approval.metadata
            ? approval.metadata
            : {}),
          expiredReason: "Customer service window has expired",
        },
      },
    });

    await notifyRequester({
      companyId,
      approvalId: approval.id,
      requestedByUserId: approval.requestedByUserId,
      title: "Inbox reply approval expired",
      message: "The 24-hour WhatsApp reply window expired before approval.",
      severity: "WARNING",
    });

    return expiredApproval;
  }

  const message = await createQueuedInboxReply(
    companyId,
    approval.contactId,
    { body: approval.body },
    {
      actorUserId: approval.requestedByUserId,
      approvedByUserId: reviewedByUserId,
      inboxReplyApprovalId: approval.id,
    },
  );

  const updatedApproval = await prisma.inboxReplyApproval.update({
    where: {
      id: approval.id,
    },
    data: {
      status: "APPROVED",
      reviewedByUserId,
      reviewedAt: new Date(),
      messageId: message.id,
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
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
      message: true,
    },
  });

  await notifyRequester({
    companyId,
    approvalId: approval.id,
    requestedByUserId: approval.requestedByUserId,
    title: "Inbox reply approved",
    message: "Your WhatsApp inbox reply was approved and queued for sending.",
    severity: "SUCCESS",
  });

  return updatedApproval;
}

export async function rejectInboxReplyApproval({
  companyId,
  approvalId,
  reviewedByUserId,
  reason,
}: {
  companyId: string;
  approvalId: string;
  reviewedByUserId: string;
  reason: string;
}) {
  const approval = await prisma.inboxReplyApproval.findFirst({
    where: {
      id: approvalId,
      companyId,
    },
  });

  if (!approval) {
    throw new Error("Approval request not found");
  }

  if (approval.status !== "PENDING") {
    throw new Error("Approval request is no longer pending");
  }

  const updatedApproval = await prisma.inboxReplyApproval.update({
    where: {
      id: approval.id,
    },
    data: {
      status: "REJECTED",
      reviewedByUserId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await notifyRequester({
    companyId,
    approvalId: approval.id,
    requestedByUserId: approval.requestedByUserId,
    title: "Inbox reply rejected",
    message: reason,
    severity: "ERROR",
  });

  return updatedApproval;
}

export async function cancelInboxReplyApproval({
  companyId,
  approvalId,
  actorUserId,
  reason,
}: {
  companyId: string;
  approvalId: string;
  actorUserId: string;
  reason?: string;
}) {
  const approval = await prisma.inboxReplyApproval.findFirst({
    where: {
      id: approvalId,
      companyId,
    },
  });

  if (!approval) {
    throw new Error("Approval request not found");
  }

  if (approval.status !== "PENDING") {
    throw new Error("Approval request is no longer pending");
  }

  if (approval.requestedByUserId !== actorUserId) {
    throw new Error("Only the requester can cancel this approval");
  }

  return prisma.inboxReplyApproval.update({
    where: {
      id: approval.id,
    },
    data: {
      status: "CANCELLED",
      reviewedAt: new Date(),
      rejectionReason: reason ?? null,
      metadata: {
        ...(typeof approval.metadata === "object" && approval.metadata
          ? approval.metadata
          : {}),
        cancelledByUserId: actorUserId,
      },
    },
  });
}
