"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlatformCompanyPlanActions({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [planCode, setPlanCode] = useState("starter");
  const [status, setStatus] = useState<"TRIAL" | "ACTIVE">("ACTIVE");
  const [days, setDays] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function assignPlan() {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/platform/companies/${companyId}/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planCode,
          status,
          days,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to assign plan.");
        return;
      }

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function extendTrial() {
    const value = window.prompt("Extend trial by how many days?", "7");
    if (!value) return;

    setIsSaving(true);

    try {
      await fetch(`/api/platform/companies/${companyId}/plan/extend-trial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          days: Number(value),
        }),
      });

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function suspendPlan() {
    const reason = window.prompt("Reason for plan suspension:");
    if (!reason) return;

    setIsSaving(true);

    try {
      await fetch(`/api/platform/companies/${companyId}/plan/suspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
        }),
      });

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelPlan() {
    const ok = window.confirm("Cancel current company plan?");
    if (!ok) return;

    setIsSaving(true);

    try {
      await fetch(`/api/platform/companies/${companyId}/plan/cancel`, {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        Platform Plan Control
      </h2>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <select
          value={planCode}
          onChange={(event) => setPlanCode(event.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
        >
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "TRIAL" | "ACTIVE")}
          className="rounded-xl border px-3 py-2 text-sm"
        >
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
        </select>

        <input
          type="number"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          min={1}
          max={3650}
          className="rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={assignPlan}
          disabled={isSaving}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Assign Plan
        </button>

        <button
          type="button"
          onClick={extendTrial}
          disabled={isSaving}
          className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          Extend Trial
        </button>

        <button
          type="button"
          onClick={suspendPlan}
          disabled={isSaving}
          className="rounded-xl border px-4 py-2 text-sm font-semibold text-yellow-700 disabled:opacity-60"
        >
          Suspend Plan
        </button>

        <button
          type="button"
          onClick={cancelPlan}
          disabled={isSaving}
          className="rounded-xl border px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
        >
          Cancel Plan
        </button>
      </div>
    </section>
  );
}
