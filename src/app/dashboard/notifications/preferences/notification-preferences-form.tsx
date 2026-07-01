"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  NOTIFICATION_SEVERITY_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
} from "@/lib/notification-preferences";

type Preference = {
  id: string;
  type: string;
  inAppEnabled: boolean;
  minimumSeverity: string;
  emailEnabled: boolean;
  emailMinimumSeverity: string;
};

type NotificationPreferencesFormProps = { preferences: Preference[] };
type UpdateResponse = { message: string };

export default function NotificationPreferencesForm({
  preferences,
}: NotificationPreferencesFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");

  function getPreference(type: string) {
    return preferences.find((preference) => preference.type === type);
  }

  async function updatePreference({
    type,
    inAppEnabled,
    minimumSeverity,
    emailEnabled,
    emailMinimumSeverity,
  }: {
    type: string;
    inAppEnabled: boolean;
    minimumSeverity: string;
    emailEnabled: boolean;
    emailMinimumSeverity: string;
  }) {
    setError("");
    setSavingKey(type);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          inAppEnabled,
          minimumSeverity,
          emailEnabled,
          emailMinimumSeverity,
        }),
      });
      const data = (await response.json()) as UpdateResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update notification preference.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white shadow-sm">
      <div className="border-b border-[#BFE9D0] bg-[#E7F8EF] px-6 py-4">
        <h2 className="text-lg font-semibold text-[#081B3A]">Alert Routing</h2>
        <p className="mt-1 text-sm text-[#526173]">
          Choose which company alerts should appear in your notification inbox.
        </p>
      </div>

      <div className="divide-y divide-[#BFE9D0]">
        {NOTIFICATION_TYPE_OPTIONS.map((option) => {
          const preference = getPreference(option.type);
          const inAppEnabled = preference?.inAppEnabled ?? true;
          const minimumSeverity = preference?.minimumSeverity ?? "INFO";
          const emailEnabled = preference?.emailEnabled ?? false;
          const emailMinimumSeverity =
            preference?.emailMinimumSeverity ?? "ERROR";

          return (
            <div
              key={option.type}
              className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_180px_220px_180px_220px] md:items-center"
            >
              <div>
                <h3 className="font-medium text-[#081B3A]">{option.label}</h3>
                <p className="mt-1 text-sm text-[#526173]">
                  {option.description}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#526173]">
                <input
                  type="checkbox"
                  checked={inAppEnabled}
                  disabled={savingKey === option.type}
                  onChange={(event) =>
                    updatePreference({
                      type: option.type,
                      inAppEnabled: event.target.checked,
                      minimumSeverity,
                      emailEnabled,
                      emailMinimumSeverity,
                    })
                  }
                  className="h-4 w-4 accent-[#128C7E]"
                />
                In-app alerts
              </label>

              <select
                value={minimumSeverity}
                disabled={!inAppEnabled || savingKey === option.type}
                onChange={(event) =>
                  updatePreference({
                    type: option.type,
                    inAppEnabled,
                    minimumSeverity: event.target.value,
                    emailEnabled,
                    emailMinimumSeverity,
                  })
                }
                className="rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#102040] outline-none transition focus:border-[#128C7E]/50 focus:ring-4 focus:ring-[#128C7E]/10 disabled:bg-gray-50 disabled:opacity-60"
              >
                {NOTIFICATION_SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity.severity} value={severity.severity}>
                    {severity.label}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm text-[#526173]">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  disabled={savingKey === option.type}
                  onChange={(event) =>
                    updatePreference({
                      type: option.type,
                      inAppEnabled,
                      minimumSeverity,
                      emailEnabled: event.target.checked,
                      emailMinimumSeverity,
                    })
                  }
                  className="h-4 w-4 accent-[#128C7E]"
                />
                Email alerts
              </label>

              <select
                value={emailMinimumSeverity}
                disabled={!emailEnabled || savingKey === option.type}
                onChange={(event) =>
                  updatePreference({
                    type: option.type,
                    inAppEnabled,
                    minimumSeverity,
                    emailEnabled,
                    emailMinimumSeverity: event.target.value,
                  })
                }
                className="rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#102040] outline-none transition focus:border-[#128C7E]/50 focus:ring-4 focus:ring-[#128C7E]/10 disabled:bg-gray-50 disabled:opacity-60"
              >
                {NOTIFICATION_SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity.severity} value={severity.severity}>
                    {severity.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="border-t border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}
