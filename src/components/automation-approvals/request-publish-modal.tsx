"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

type RequestPublishModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (publishNotes: string) => Promise<void>;
};

export default function RequestPublishModal({
  isOpen,
  onClose,
  onSubmit,
}: RequestPublishModalProps) {
  const [publishNotes, setPublishNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await onSubmit(publishNotes);
      onClose();
    } catch (err: unknown) {
      const errorVal = err as Error;
      setError(errorVal.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#D8E6F3]">
        <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
          <h3 className="text-base font-bold text-[#081B3A]">Request Publish Approval</h3>
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
            Company settings require an Admin or Owner to approve automation flow changes before going live. A snapshot of your current draft will be sent for review.
          </p>

          <div>
            <label className="block text-xs font-bold text-[#081B3A] uppercase tracking-wider mb-1">
              Publish / Version Notes (Optional)
            </label>
            <textarea
              value={publishNotes}
              onChange={(e) => setPublishNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D8E6F3] focus:outline-none focus:border-[#0052CC]"
              placeholder="What changes did you make in this flow draft?"
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
              className="flex-1 py-2 text-xs font-semibold bg-[#0052CC] text-white rounded-lg hover:bg-[#0040A3] disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{submitting ? "Submitting..." : "Submit Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
