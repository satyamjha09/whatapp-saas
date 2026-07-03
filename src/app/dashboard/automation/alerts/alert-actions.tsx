"use client";

import { Check, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type AlertAction = "acknowledge" | "resolve" | "mute";

const labels: Record<AlertAction, string> = {
  acknowledge: "Acknowledge",
  resolve: "Resolve",
  mute: "Mute",
};

const icons = {
  acknowledge: ShieldCheck,
  resolve: Check,
  mute: EyeOff,
};

export function AlertActionButton({
  action,
  alertId,
}: {
  action: AlertAction;
  alertId: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const Icon = icons[action];

  async function submit() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/automation/alerts/${alertId}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to update alert");
      }

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      className={actionButtonClass(action === "resolve" ? "primary" : "secondary")}
      disabled={isSaving}
      onClick={() => void submit()}
      type="button"
    >
      <Icon className="mr-2 h-4 w-4" />
      {isSaving ? "Saving..." : labels[action]}
    </button>
  );
}
