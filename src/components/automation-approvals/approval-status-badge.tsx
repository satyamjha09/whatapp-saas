"use client";

import type { AutomationPublishRequestStatus } from "@/generated/prisma/client";

type ApprovalStatusBadgeProps = {
  status: AutomationPublishRequestStatus | string;
};

export default function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  switch (status) {
    case "PENDING":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
          Approval Pending
        </span>
      );
    case "APPROVED":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
          Approved & Published
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
          Rejected
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 border border-slate-200">
          Cancelled
        </span>
      );
    case "SUPERSEDED":
      return (
        <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
          Superseded by New Draft
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
          {status}
        </span>
      );
  }
}
