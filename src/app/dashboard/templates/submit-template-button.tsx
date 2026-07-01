"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";

type SubmitTemplateButtonProps = {
  canManage: boolean;
  templateId: string;
  status: string;
};

type SubmitTemplateResponse = {
  message?: string;
};

export default function SubmitTemplateButton({
  canManage,
  status,
  templateId,
}: SubmitTemplateButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit =
    canManage && (status === "DRAFT" || status === "REJECTED");

  async function submitTemplate() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/templates/${templateId}/submit`, {
        method: "POST",
      });
      const data = (await response.json()) as SubmitTemplateResponse;

      if (!response.ok) {
        setError(data.message ?? "Unable to submit template.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to submit template.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canSubmit) {
    return null;
  }

  return (
    <div className="inline-flex shrink-0">
      <button
        type="button"
        onClick={submitTemplate}
        disabled={isSubmitting}
        title={isSubmitting ? "Submitting template" : "Submit template"}
        aria-label={isSubmitting ? "Submitting template" : "Submit template"}
        className="inline-grid h-8 w-8 place-items-center rounded-md bg-[#E8F7EF] text-[#087443] hover:bg-[#D8F0E4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        <span className="sr-only">
          {isSubmitting ? "Submitting..." : "Submit"}
        </span>
      </button>
      {error ? <p className="sr-only">{error}</p> : null}
    </div>
  );
}
