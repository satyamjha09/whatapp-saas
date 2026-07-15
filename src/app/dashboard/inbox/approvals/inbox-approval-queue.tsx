"use client";

import { useMemo, useState } from "react";
import InboxApprovalCard, { InboxApproval } from "./inbox-approval-card";

type InboxApprovalQueueProps = {
  initialApprovals: InboxApproval[];
};

export default function InboxApprovalQueue({
  initialApprovals,
}: InboxApprovalQueueProps) {
  const [approvals, setApprovals] = useState(initialApprovals);

  const pendingCount = approvals.filter(
    (approval) => approval.status === "PENDING",
  ).length;
  const sortedApprovals = useMemo(
    () =>
      [...approvals].sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() -
          new Date(b.submittedAt).getTime(),
      ),
    [approvals],
  );

  function removeApproval(approvalId: string) {
    setApprovals((current) =>
      current.filter((approval) => approval.id !== approvalId),
    );
  }

  return (
    <section className="rounded-[20px] border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#102040]">
            Pending replies
          </h2>
          <p className="mt-1 text-sm text-[#526173]">
            {pendingCount} reply{pendingCount === 1 ? "" : "ies"} waiting for
            approval.
          </p>
        </div>
        <span className="rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#128C7E]">
          No wallet charge while pending
        </span>
      </div>

      {sortedApprovals.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FCFA] p-10 text-center">
          <p className="text-lg font-bold text-[#102040]">
            No replies need approval right now.
          </p>
          <p className="mt-2 text-sm text-[#526173]">
            New replies from approval-required queues will appear here before
            they are sent to WhatsApp.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {sortedApprovals.map((approval) => (
            <InboxApprovalCard
              key={approval.id}
              approval={approval}
              onResolved={removeApproval}
            />
          ))}
        </div>
      )}
    </section>
  );
}
