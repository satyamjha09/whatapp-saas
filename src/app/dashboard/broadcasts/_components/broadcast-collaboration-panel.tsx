"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  History,
  MessageSquareText,
  Send,
  XCircle,
} from "lucide-react";
import { actionButtonClass, StatusPill } from "@/app/dashboard/dashboard-ui";

type CollaborationComment = {
  actorLabel?: string;
  body?: string;
  createdAt?: string;
  id?: string;
};

type CollaborationHistoryItem = {
  actorLabel?: string;
  at?: string;
  event?: string;
  id?: string;
  summary?: string;
};

type BroadcastCollaboration = {
  approval?: {
    rejectionReason?: string | null;
    status?: string;
  };
  comments?: CollaborationComment[];
  history?: CollaborationHistoryItem[];
};

type BroadcastCollaborationPanelProps = {
  canReview: boolean;
  collaboration?: unknown;
  draftId: string;
  status: string;
};

function formatDateTime(value?: string) {
  if (!value) return "Just now";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function approvalTone(status: string) {
  if (status === "APPROVED") return "green";
  if (status === "REJECTED") return "red";
  if (status === "SUBMITTED_FOR_APPROVAL") return "amber";

  return "blue";
}

function approvalCopy(status: string) {
  if (status === "APPROVED") {
    return "Approved broadcasts can run dry-run checks and launch.";
  }
  if (status === "REJECTED") {
    return "Rejected broadcasts should be edited and submitted again.";
  }
  if (status === "SUBMITTED_FOR_APPROVAL") {
    return "Waiting for an owner or admin to approve this broadcast.";
  }

  return "Submit this draft for review before launch when your team needs approval.";
}

function asCollaboration(value: unknown): BroadcastCollaboration {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as BroadcastCollaboration)
    : {};
}

export function BroadcastCollaborationPanel({
  canReview,
  collaboration,
  draftId,
  status,
}: BroadcastCollaborationPanelProps) {
  const router = useRouter();
  const collaborationData = asCollaboration(collaboration);
  const approvalStatus = collaborationData.approval?.status ?? "DRAFT";
  const comments = collaborationData.comments ?? [];
  const history = collaborationData.history ?? [];
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const locked = useMemo(
    () => ["READY_TO_SEND", "SCHEDULED", "PAUSED", "LAUNCHED", "CANCELED"].includes(status),
    [status],
  );

  async function updateApproval(action: "SUBMIT" | "APPROVE" | "REJECT") {
    if (action === "REJECT" && !note.trim()) {
      setError("Add a rejection reason before rejecting this broadcast.");
      return;
    }

    setError("");
    setIsBusy(true);

    try {
      const response = await fetch(`/api/broadcast-drafts/${draftId}/approval`, {
        body: JSON.stringify({ action, note: note.trim() || null }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Unable to update approval.");
      }

      setNote("");
      router.refresh();
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Unable to update approval.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) return;

    setError("");
    setIsBusy(true);

    try {
      const response = await fetch(`/api/broadcast-drafts/${draftId}/comments`, {
        body: JSON.stringify({ body: comment.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Unable to add comment.");
      }

      setComment("");
      router.refresh();
    } catch (commentError) {
      setError(
        commentError instanceof Error
          ? commentError.message
          : "Unable to add comment.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="mb-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[24px] border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_42px_rgba(8,27,58,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#E7F8EF] p-3 text-[#128C7E]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[#128C7E]">
                Approval workflow
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-[#081B3A]">
                Draft review and launch gate
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#526173]">
                {approvalCopy(approvalStatus)}
              </p>
            </div>
          </div>
          <StatusPill tone={approvalTone(approvalStatus)}>
            {approvalStatus.replaceAll("_", " ")}
          </StatusPill>
        </div>

        {collaborationData.approval?.rejectionReason ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {collaborationData.approval.rejectionReason}
          </div>
        ) : null}

        <textarea
          className="mt-5 min-h-24 w-full resize-y rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] px-4 py-3 text-sm font-medium text-[#081B3A] outline-none focus:border-[#128C7E]"
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional approval note or rejection reason"
          value={note}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {["DRAFT", "REJECTED"].includes(approvalStatus) ? (
            <button
              className={actionButtonClass("primary")}
              disabled={isBusy || locked}
              onClick={() => updateApproval("SUBMIT")}
              type="button"
            >
              <Send className="mr-2 h-4 w-4" />
              Submit for approval
            </button>
          ) : null}

          {approvalStatus === "SUBMITTED_FOR_APPROVAL" ? (
            <>
              <button
                className={actionButtonClass("primary")}
                disabled={isBusy || !canReview}
                onClick={() => updateApproval("APPROVE")}
                type="button"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </button>
              <button
                className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy || !canReview}
                onClick={() => updateApproval("REJECT")}
                type="button"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </button>
            </>
          ) : null}
        </div>

        {!canReview && approvalStatus === "SUBMITTED_FOR_APPROVAL" ? (
          <p className="mt-3 text-sm font-semibold text-[#7A4B00]">
            Only owners and admins can approve or reject broadcasts.
          </p>
        ) : null}

        {locked ? (
          <p className="mt-3 text-sm font-semibold text-[#526173]">
            This broadcast already entered launch controls, so approval changes are locked.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-2">
        <div className="rounded-[24px] border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_42px_rgba(8,27,58,0.06)]">
          <div className="flex items-center gap-3">
            <MessageSquareText className="h-5 w-5 text-[#128C7E]" />
            <h3 className="font-extrabold text-[#081B3A]">Draft comments</h3>
          </div>
          <textarea
            className="mt-4 min-h-20 w-full resize-y rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] px-4 py-3 text-sm text-[#081B3A] outline-none focus:border-[#128C7E]"
            onChange={(event) => setComment(event.target.value)}
            placeholder="Leave a note for your team"
            value={comment}
          />
          <button
            className={`${actionButtonClass("secondary")} mt-3`}
            disabled={isBusy || !comment.trim()}
            onClick={addComment}
            type="button"
          >
            Add comment
          </button>
          <div className="mt-4 grid max-h-52 gap-3 overflow-y-auto pr-1">
            {comments.length ? (
              comments.map((item) => (
                <div className="rounded-2xl bg-[#F7FBFF] p-3" key={item.id}>
                  <p className="text-sm font-bold text-[#081B3A]">
                    {item.actorLabel ?? "Team member"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#526173]">
                    {item.body}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#128C7E]">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[#BFE9D0] p-4 text-sm text-[#526173]">
                No comments yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_42px_rgba(8,27,58,0.06)]">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-[#128C7E]" />
            <h3 className="font-extrabold text-[#081B3A]">Change history</h3>
          </div>
          <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto pr-1">
            {history.length ? (
              history.map((item) => (
                <div className="rounded-2xl border border-[#E7F8EF] bg-[#F7FBFF] p-3" key={item.id}>
                  <p className="text-sm font-bold text-[#081B3A]">
                    {item.summary ?? item.event}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase text-[#128C7E]">
                    {item.actorLabel ?? "System"} · {formatDateTime(item.at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[#BFE9D0] p-4 text-sm text-[#526173]">
                <Clock3 className="mb-2 h-4 w-4 text-[#128C7E]" />
                Draft history starts after the next save or approval action.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
