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
    <div>
      <button
        type="button"
        onClick={submitTemplate}
        disabled={isSubmitting}
        className="inline-flex items-center rounded-md bg-[#E8F7EF] px-3 py-2 font-medium text-[#087443] hover:bg-[#D8F0E4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="mr-2 h-4 w-4" />
        {isSubmitting ? "Submitting..." : "Submit"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
