"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";

type RejectPublishModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rejectionReason: string) => Promise<void>;
};

export default function RejectPublishModal({
  isOpen,
  onClose,
  onSubmit,
}: RejectPublishModalProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError("Please provide a reason for rejecting this publish request.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await onSubmit(rejectionReason.trim());
      onClose();
    } catch (err: unknown) {
      const errorVal = err as Error;
      setError(errorVal.message || "Failed to reject request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#D8E6F3]">
        <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
          <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            <span>Reject Publish Request</span>
          </h3>
          <button
            onClick={onClose}
            className="text-[#526173] hover:text-[#081B3A] text-xl font-bold"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          <p className="text-xs text-[#526173] leading-relaxed">
            Please specify why this automation flow publish request is being rejected. This feedback will be recorded in the request history.
          </p>

          <div>
            <label className="block text-xs font-bold text-[#081B3A] uppercase tracking-wider mb-1">
              Rejection Reason *
            </label>
            <textarea
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D8E6F3] focus:outline-none focus:border-rose-500"
              placeholder="e.g. Needs template mapping verification or wrong trigger keyword."
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold border border-[#D8E6F3] rounded-lg hover:bg-slate-50 text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>{submitting ? "Rejecting..." : "Reject Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
