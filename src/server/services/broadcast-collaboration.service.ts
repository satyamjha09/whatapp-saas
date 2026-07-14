import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  broadcastDraftDataSchema,
  type BroadcastDraftData,
} from "@/server/validators/broadcast-draft.validator";

export type BroadcastCollaborationEvent =
  | "APPROVAL_SUBMITTED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_REJECTED"
  | "COMMENT_ADDED"
  | "DRAFT_UPDATED";

export type BroadcastApprovalStatus =
  | "DRAFT"
  | "SUBMITTED_FOR_APPROVAL"
  | "APPROVED"
  | "REJECTED";

type Actor = {
  id: string;
  label: string;
};

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function getBroadcastDraftData(value: unknown): BroadcastDraftData {
  const parsed = broadcastDraftDataSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getBroadcastApprovalStatus(
  draftData: BroadcastDraftData,
): BroadcastApprovalStatus {
  const collaboration = asRecord(
    (draftData as Record<string, unknown>).collaboration,
  );
  const approval = asRecord(collaboration.approval);
  const status = typeof approval.status === "string" ? approval.status : "DRAFT";

  return status === "SUBMITTED_FOR_APPROVAL" ||
    status === "APPROVED" ||
    status === "REJECTED"
    ? status
    : "DRAFT";
}

export function appendBroadcastHistory({
  actor,
  draftData,
  event,
  metadata = {},
  summary,
}: {
  actor: Actor;
  draftData: BroadcastDraftData;
  event: BroadcastCollaborationEvent;
  metadata?: Record<string, unknown>;
  summary: string;
}) {
  const collaboration = asRecord(
    (draftData as Record<string, unknown>).collaboration,
  );
  const history = Array.isArray(collaboration.history)
    ? collaboration.history
    : [];

  return {
    ...draftData,
    collaboration: {
      ...collaboration,
      history: [
        {
          actorLabel: actor.label,
          actorUserId: actor.id,
          at: new Date().toISOString(),
          event,
          id: id("history"),
          metadata,
          summary,
        },
        ...history,
      ].slice(0, 100),
    },
  };
}

export async function updateBroadcastDraftApproval({
  action,
  actor,
  companyId,
  draftId,
  note,
}: {
  action: "SUBMIT" | "APPROVE" | "REJECT";
  actor: Actor;
  companyId: string;
  draftId: string;
  note?: string | null;
}) {
  const draft = await prisma.broadcastCampaignDraft.findFirst({
    where: { companyId, id: draftId },
  });

  if (!draft) throw new Error("Broadcast draft not found");
  if (
    ["READY_TO_SEND", "SCHEDULED", "PAUSED", "LAUNCHED", "CANCELED"].includes(
      draft.status,
    )
  ) {
    throw new Error("This broadcast can no longer enter approval workflow.");
  }

  const draftData = getBroadcastDraftData(draft.draftData);
  const currentApproval = getBroadcastApprovalStatus(draftData);

  if (action === "SUBMIT" && !["DRAFT", "REJECTED"].includes(currentApproval)) {
    throw new Error("Only draft or rejected broadcasts can be submitted.");
  }
  if (["APPROVE", "REJECT"].includes(action) && currentApproval !== "SUBMITTED_FOR_APPROVAL") {
    throw new Error("Only submitted broadcasts can be reviewed.");
  }

  const nextStatus =
    action === "SUBMIT"
      ? "SUBMITTED_FOR_APPROVAL"
      : action === "APPROVE"
        ? "APPROVED"
        : "REJECTED";
  const collaboration = asRecord(
    (draftData as Record<string, unknown>).collaboration,
  );
  const previousApproval = asRecord(collaboration.approval);
  const approval = {
    ...previousApproval,
    approvedAt: action === "APPROVE" ? new Date().toISOString() : null,
    approvedByUserId: action === "APPROVE" ? actor.id : null,
    rejectionReason: action === "REJECT" ? note?.trim() || "Rejected" : null,
    reviewedAt: ["APPROVE", "REJECT"].includes(action)
      ? new Date().toISOString()
      : previousApproval.reviewedAt ?? null,
    reviewedByUserId: ["APPROVE", "REJECT"].includes(action)
      ? actor.id
      : previousApproval.reviewedByUserId ?? null,
    status: nextStatus,
    submittedAt: action === "SUBMIT"
      ? new Date().toISOString()
      : previousApproval.submittedAt ?? null,
    submittedByUserId: action === "SUBMIT"
      ? actor.id
      : previousApproval.submittedByUserId ?? null,
  };
  const withApproval = {
    ...draftData,
    collaboration: {
      ...collaboration,
      approval,
    },
  };
  const withHistory = appendBroadcastHistory({
    actor,
    draftData: withApproval,
    event:
      action === "SUBMIT"
        ? "APPROVAL_SUBMITTED"
        : action === "APPROVE"
          ? "APPROVAL_APPROVED"
          : "APPROVAL_REJECTED",
    metadata: note?.trim() ? { note: note.trim() } : {},
    summary:
      action === "SUBMIT"
        ? "Submitted broadcast for approval"
        : action === "APPROVE"
          ? "Approved broadcast for launch"
          : "Rejected broadcast approval request",
  });

  const updated = await prisma.broadcastCampaignDraft.update({
    where: { id: draft.id },
    data: {
      draftData: safeJson(withHistory),
      status: nextStatus,
    },
  });

  return { draft: updated };
}

export async function addBroadcastDraftComment({
  actor,
  body,
  companyId,
  draftId,
}: {
  actor: Actor;
  body: string;
  companyId: string;
  draftId: string;
}) {
  const draft = await prisma.broadcastCampaignDraft.findFirst({
    where: { companyId, id: draftId },
  });

  if (!draft) throw new Error("Broadcast draft not found");

  const draftData = getBroadcastDraftData(draft.draftData);
  const collaboration = asRecord(
    (draftData as Record<string, unknown>).collaboration,
  );
  const comments = Array.isArray(collaboration.comments)
    ? collaboration.comments
    : [];
  const withComment = {
    ...draftData,
    collaboration: {
      ...collaboration,
      comments: [
        {
          actorLabel: actor.label,
          actorUserId: actor.id,
          body: body.trim(),
          createdAt: new Date().toISOString(),
          id: id("comment"),
        },
        ...comments,
      ].slice(0, 100),
    },
  };
  const withHistory = appendBroadcastHistory({
    actor,
    draftData: withComment,
    event: "COMMENT_ADDED",
    summary: "Added a collaboration comment",
  });

  const updated = await prisma.broadcastCampaignDraft.update({
    where: { id: draft.id },
    data: {
      draftData: safeJson(withHistory),
    },
  });

  return { draft: updated };
}
