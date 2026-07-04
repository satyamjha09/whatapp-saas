"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Info,
  ExternalLink,
} from "lucide-react";
import AutomationGraphPreview from "@/components/automation-builder/automation-graph-preview";
import ApprovalStatusBadge from "./approval-status-badge";
import RejectPublishModal from "./reject-publish-modal";
import type { AutomationGraph } from "@/components/automation-builder/types";

type AutomationApprovalDetailProps = {
  request: {
    id: string;
    flowId: string;
    status: string;
    requestedByUserId: string;
    reviewedByUserId?: string | null;
    draftGraph: unknown;
    validationSnapshot?: unknown;
    publishNotes?: string | null;
    requestedAt: Date | string;
    reviewedAt?: Date | string | null;
    rejectionReason?: string | null;
    flow?: {
      id: string;
      name: string;
      description?: string | null;
      draftGraph?: unknown;
      publishedVersionId?: string | null;
    };
  };
  currentUserId: string;
  isManagement: boolean;
};

export default function AutomationApprovalDetail({
  request,
  currentUserId,
  isManagement,
}: AutomationApprovalDetailProps) {
  const router = useRouter();

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const snapshotGraph = request.draftGraph as AutomationGraph;
  const isPending = request.status === "PENDING";
  const canCancel = isPending && (isManagement || request.requestedByUserId === currentUserId);
  const canReview = isPending && isManagement;

  // Detect if current flow draft in builder differs from request snapshot graph
  const isDraftDifferent =
    Boolean(request.flow?.draftGraph) &&
    JSON.stringify(request.flow?.draftGraph) !== JSON.stringify(request.draftGraph);

  const handleApprove = async () => {
    try {
      setApproving(true);
      setActionError("");

      const res = await fetch(`/api/automation/publish-requests/${request.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: "Approved via dashboard" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to approve request.");
      }

      setActionSuccess("Publish request approved successfully! Flow version is now live.");
      router.refresh();
    } catch (err: unknown) {
      const errorVal = err as Error;
      setActionError(errorVal.message || "Approval failed.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (rejectionReason: string) => {
    const res = await fetch(`/api/automation/publish-requests/${request.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to reject request.");
    }

    setActionSuccess("Publish request rejected.");
    router.refresh();
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      setActionError("");

      const res = await fetch(`/api/automation/publish-requests/${request.id}/cancel`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to cancel request.");
      }

      setActionSuccess("Publish request cancelled.");
      router.refresh();
    } catch (err: unknown) {
      const errorVal = err as Error;
      setActionError(errorVal.message || "Cancellation failed.");
    } finally {
      setCancelling(false);
    }
  };

  const valSnapshot = request.validationSnapshot as {
    errors?: unknown[];
    warnings?: Array<{ message?: string }>;
  } | null | undefined;

  const publishNotesText = request.publishNotes ? String(request.publishNotes) : null;
  const rejectionReasonText = request.rejectionReason ? String(request.rejectionReason) : null;

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/automation/approvals"
          className="flex items-center gap-2 text-sm font-semibold text-[#526173] hover:text-[#081B3A] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Approvals</span>
        </Link>

        <Link
          href={`/automation/builder/${request.flowId}`}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-white border border-[#D8E6F3] text-[#081B3A] rounded-lg hover:bg-[#F0F8FF] transition"
        >
          <span>Open Flow Builder</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Review Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left Side: Summary & Graph Canvas */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-[#D8E6F3] space-y-4">
            <div className="flex items-center justify-between">
              <ApprovalStatusBadge status={request.status} />
              <span className="text-xs text-slate-500 font-medium">
                Requested {new Date(request.requestedAt).toLocaleString()}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#081B3A]">
                {request.flow?.name || "Automation Flow"}
              </h1>
              {Boolean(request.flow?.description) && (
                <p className="text-xs text-[#526173] mt-1">{String(request.flow?.description)}</p>
              )}
            </div>

            {/* Version Notes */}
            <div className="bg-[#F8FAFC] border border-[#D8E6F3] p-4 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526173]">
                Version / Publish Notes
              </span>
              <p className="text-xs text-[#081B3A] leading-relaxed">
                {publishNotesText || "No version notes supplied."}
              </p>
            </div>

            {/* Rejection Reason if rejected */}
            {Boolean(request.status === "REJECTED" && rejectionReasonText) ? (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1 text-rose-900">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Rejection Reason
                </span>
                <p className="text-xs leading-relaxed font-medium">{rejectionReasonText}</p>
              </div>
            ) : null}

            {/* Draft Mismatch Warning */}
            {isDraftDifferent && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                <Info className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950">Draft Changed Since Request</h4>
                  <p className="mt-0.5">
                    The builder draft has been edited since this approval request was created. Approving this request will publish the exact <strong>snapshot graph</strong> captured at request time. Existing customer sessions will remain on their current version.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Read-only Graph Canvas */}
          <div className="bg-white rounded-xl border border-[#D8E6F3] overflow-hidden flex flex-col h-[500px]">
            <div className="border-b border-[#D8E6F3] px-4 py-3 bg-[#F8FAFC] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#081B3A] uppercase tracking-wider">
                Snapshot Flow Canvas ({snapshotGraph.nodes.length} nodes, {snapshotGraph.edges.length} edges)
              </h3>
              <span className="text-[10px] text-slate-500">Read-only Snapshot</span>
            </div>
            <div className="flex-1 relative">
              <AutomationGraphPreview graph={snapshotGraph} />
            </div>
          </div>
        </div>

        {/* Right Side: Validation & Action Panel */}
        <div className="space-y-6">
          {/* Validation Snapshot */}
          <div className="bg-[#FFFFFF] p-6 rounded-xl border border-[#D8E6F3] space-y-4">
            <h3 className="text-sm font-bold text-[#081B3A]">Graph Validation Summary</h3>

            {valSnapshot ? (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex-1 bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Errors</span>
                    <span className="text-base font-bold text-emerald-900 mt-0.5 block">
                      {valSnapshot.errors?.length || 0}
                    </span>
                  </div>
                  <div className="flex-1 bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Warnings</span>
                    <span className="text-base font-bold text-amber-900 mt-0.5 block">
                      {valSnapshot.warnings?.length || 0}
                    </span>
                  </div>
                </div>

                {Boolean(valSnapshot.warnings && valSnapshot.warnings.length > 0) && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-[#526173] uppercase tracking-wider block">
                      Warnings to review
                    </span>
                    {valSnapshot.warnings?.map((w, idx) => (
                      <div key={idx} className="bg-amber-50/70 border border-amber-200/60 p-2.5 rounded text-xs text-amber-900">
                        • {w.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No validation snapshot recorded.</p>
            )}
          </div>

          {/* Action Box */}
          <div className="bg-white p-6 rounded-xl border border-[#D8E6F3] space-y-4">
            <h3 className="text-sm font-bold text-[#081B3A]">Review Actions</h3>

            {canReview && (
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={approving || cancelling}
                  className="w-full py-2.5 px-4 text-xs font-bold bg-[#128C7E] text-white rounded-xl hover:bg-[#075E54] disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs transition"
                >
                  {approving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>{approving ? "Publishing Version..." : "Approve & Publish Live"}</span>
                </button>

                <button
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={approving || cancelling}
                  className="w-full py-2.5 px-4 text-xs font-bold bg-white border border-rose-200 text-rose-700 rounded-xl hover:bg-rose-50 disabled:opacity-50 flex items-center justify-center gap-2 transition"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject Request</span>
                </button>
              </div>
            )}

            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={approving || cancelling}
                className="w-full py-2 px-3 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-1.5 transition"
              >
                {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Cancel Request</span>
              </button>
            )}

            {!isPending && (
              <p className="text-xs text-slate-500 text-center py-2">
                This request is already <strong>{request.status.toLowerCase()}</strong> and can no longer be modified.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      <RejectPublishModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onSubmit={handleReject}
      />
    </div>
  );
}
