"use client";

import Link from "next/link";
import { Workflow, ChevronRight, AlertTriangle } from "lucide-react";
import ApprovalStatusBadge from "./approval-status-badge";

type ApprovalItem = {
  id: string;
  flowId: string;
  status: string;
  publishNotes?: string | null;
  requestedAt: Date | string;
  flow?: {
    name: string;
  };
  validationSnapshot?: unknown;
};

type AutomationApprovalListProps = {
  requests: ApprovalItem[];
};

export default function AutomationApprovalList({ requests }: AutomationApprovalListProps) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-[#FFFFFF] rounded-xl border border-[#D8E6F3] text-center p-6 space-y-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F0F8FF] text-[#0052CC]">
          <Workflow className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-[#081B3A]">No publish requests found</h3>
        <p className="text-xs text-[#526173] max-w-sm leading-relaxed">
          When team members submit automation flow drafts for approval, review requests will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFFFF] rounded-xl border border-[#D8E6F3] overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#D8E6F3] bg-[#F8FAFC] text-[#526173] font-bold uppercase tracking-wider">
              <th className="py-3.5 px-4">Automation Flow</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Requested At</th>
              <th className="py-3.5 px-4">Publish Notes</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((req) => {
              const reqDate = new Date(req.requestedAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const valRecord = req.validationSnapshot as { warnings?: unknown[] } | null | undefined;
              const warnings = valRecord?.warnings?.length || 0;

              return (
                <tr key={req.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-[#081B3A]">
                    <Link
                      href={`/dashboard/automation/approvals/${req.id}`}
                      className="hover:text-[#0052CC] flex items-center gap-2"
                    >
                      <span>{req.flow?.name || "WhatsApp Automation"}</span>
                      {warnings > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <AlertTriangle className="h-3 w-3" />
                          {warnings} warnings
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <ApprovalStatusBadge status={req.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium">{reqDate}</td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                    {req.publishNotes || "No notes provided"}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/dashboard/automation/approvals/${req.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#F0F8FF] text-[#0052CC] rounded-lg hover:bg-[#0052CC] hover:text-white transition"
                    >
                      <span>Review</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
