"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MaintenanceMode = {
  enabled: boolean;
  message: string | null;
  startedAt: Date | string | null;
};

type MaintenanceModeCardProps = {
  maintenanceMode: MaintenanceMode;
};

type MaintenanceResponse = {
  message: string;
};

export default function MaintenanceModeCard({
  maintenanceMode,
}: MaintenanceModeCardProps) {
  const router = useRouter();

  const [message, setMessage] = useState(
    maintenanceMode.message ?? "System maintenance is in progress.",
  );
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function updateMaintenanceMode(enabled: boolean) {
    const confirmed = window.confirm(
      enabled
        ? "Enable maintenance mode? Sending and other write actions can be blocked."
        : "Disable maintenance mode and resume normal operations?",
    );

    if (!confirmed) return;

    setSuccess("");
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/system/maintenance-mode", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled,
          message,
        }),
      });

      const data = (await response.json()) as MaintenanceResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setSuccess(data.message);
      router.refresh();
    } catch {
      setError("Unable to update maintenance mode.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Maintenance Mode
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Temporarily block critical write actions during restores,
            migrations, or incidents.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            maintenanceMode.enabled
              ? "bg-yellow-50 text-yellow-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {maintenanceMode.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-gray-700">
          Public maintenance message
        </span>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        {maintenanceMode.enabled ? (
          <button
            type="button"
            onClick={() => updateMaintenanceMode(false)}
            disabled={isSaving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Disable Maintenance Mode"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => updateMaintenanceMode(true)}
            disabled={isSaving}
            className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Enable Maintenance Mode"}
          </button>
        )}
      </div>

      {success && <p className="mt-3 text-sm text-green-700">{success}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
