"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clock, MessageSquare, X } from "lucide-react";

export type InboxApproval = {
  id: string;
  companyId: string;
  contactId: string;
  queueId: string | null;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  body: string;
  rejectionReason: string | null;
  messageId: string | null;
  submittedAt: Date | string;
  reviewedAt: Date | string | null;
  expiresAt: Date | string | null;
  contact: {
    id: string;
    name: string | null;
    countryCode: string;
    phoneNumber: string;
  };
  queue: {
    id: string;
    name: string;
  } | null;
  requestedBy: {
    id: string;
    name: string | null;
    email: string;
  };
};

type InboxApprovalCardProps = {
  approval: InboxApproval;
  onResolved: (approvalId: string) => void;
};

export default function InboxApprovalCard({
  approval,
  onResolved,
}: InboxApprovalCardProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const expiresAt = approval.expiresAt ? new Date(approval.expiresAt) : null;
  const isExpired = expiresAt ? expiresAt <= new Date() : false;

  async function act(action: "approve" | "reject" | "cancel") {
    setError("");
    setIsBusy(true);

    try {
      const response = await fetch(
        `/api/inbox/reply-approvals/${approval.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            action === "reject" || action === "cancel"
              ? JSON.stringify({ reason })
              : JSON.stringify({}),
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to update approval request.");
        return;
      }

      onResolved(approval.id);
    } catch {
      setError("Unable to update approval request.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-[#BFE9D0] bg-[#F7FCFA] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-bold text-[#102040]">
                {approval.contact.name || "WhatsApp contact"}
              </h3>
              <p className="text-sm text-[#526173]">
                +{approval.contact.countryCode}
                {approval.contact.phoneNumber}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#526173]">
            Requested by{" "}
            <span className="font-semibold text-[#102040]">
              {approval.requestedBy.name ?? approval.requestedBy.email}
            </span>
            {approval.queue ? ` in ${approval.queue.name}` : ""}
          </p>
        </div>

        <div className="text-right text-xs text-[#526173]">
          <p>Submitted {new Date(approval.submittedAt).toLocaleString()}</p>
          <p
            className={
              isExpired ? "mt-1 font-semibold text-rose-700" : "mt-1"
            }
          >
            <Clock className="mr-1 inline h-3.5 w-3.5" />
            {expiresAt
              ? `Window ends ${expiresAt.toLocaleString()}`
              : "No active reply window"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#BFE9D0] bg-white p-4 text-sm leading-6 text-[#102040]">
        {approval.body}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#526173]">
            Rejection or cancellation reason
          </span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Required when rejecting"
            className="mt-2 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#102040] outline-none focus:border-[#128C7E]"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isBusy || isExpired}
            onClick={() => act("approve")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            Approve
          </button>
          <button
            type="button"
            disabled={isBusy || reason.trim().length === 0}
            onClick={() => act("reject")}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => act("cancel")}
            className="inline-flex items-center rounded-xl border border-[#BFE9D0] px-4 py-2 text-sm font-semibold text-[#526173] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <Link
            href={`/dashboard/inbox/${approval.contactId}`}
            className="inline-flex items-center rounded-xl border border-[#BFE9D0] px-4 py-2 text-sm font-semibold text-[#128C7E] transition hover:bg-white"
          >
            View chat
          </Link>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </article>
  );
}
