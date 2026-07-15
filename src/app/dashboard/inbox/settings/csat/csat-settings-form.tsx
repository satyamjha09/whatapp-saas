"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";

export type InboxCsatSettingsFormValue = {
  delayMinutes: number;
  enabled: boolean;
  expirationHours: number;
  followUpQuestion: string | null;
  lowScoreThreshold: number;
  surveyMessage: string;
};

export function InboxCsatSettingsForm({
  initialSettings,
}: {
  initialSettings: InboxCsatSettingsFormValue;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof InboxCsatSettingsFormValue>(
    key: K,
    value: InboxCsatSettingsFormValue[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/inbox/csat/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; settings?: InboxCsatSettingsFormValue }
        | null;

      if (!response.ok) {
        setError(payload?.message ?? "Unable to save CSAT settings");
        return;
      }

      if (payload?.settings) {
        setSettings(payload.settings);
      }

      setMessage(payload?.message ?? "CSAT settings saved");
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-6">
      <label className="flex items-start gap-3 rounded-2xl border border-[#BFE9D0] bg-[#F7FFFA] p-4">
        <input
          checked={settings.enabled}
          className="mt-1 h-5 w-5 rounded border-[#BFE9D0] accent-[#128C7E]"
          onChange={(event) => update("enabled", event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block font-black text-[#081B3A]">
            Send CSAT after a conversation is closed
          </span>
          <span className="mt-1 block text-sm leading-6 text-[#526173]">
            MetaWhat creates one survey per close cycle and listens for a 1-5
            customer reply before normal automation/routing continues.
          </span>
        </span>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label>
          <span className={labelClass}>Delay before sending</span>
          <input
            className={fieldClass}
            min={0}
            max={10080}
            onChange={(event) =>
              update("delayMinutes", Number(event.target.value))
            }
            type="number"
            value={settings.delayMinutes}
          />
          <span className="mt-1 block text-xs text-[#526173]">Minutes</span>
        </label>
        <label>
          <span className={labelClass}>Survey expires after</span>
          <input
            className={fieldClass}
            min={1}
            max={720}
            onChange={(event) =>
              update("expirationHours", Number(event.target.value))
            }
            type="number"
            value={settings.expirationHours}
          />
          <span className="mt-1 block text-xs text-[#526173]">Hours</span>
        </label>
        <label>
          <span className={labelClass}>Low-score threshold</span>
          <select
            className={fieldClass}
            onChange={(event) =>
              update("lowScoreThreshold", Number(event.target.value))
            }
            value={settings.lowScoreThreshold}
          >
            {[1, 2, 3, 4, 5].map((score) => (
              <option key={score} value={score}>
                {score} or lower
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span className={labelClass}>Survey message</span>
        <textarea
          className={`${fieldClass} min-h-32 resize-y`}
          maxLength={1000}
          onChange={(event) => update("surveyMessage", event.target.value)}
          value={settings.surveyMessage}
        />
      </label>

      <label>
        <span className={labelClass}>Optional follow-up question</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          maxLength={1000}
          onChange={(event) =>
            update("followUpQuestion", event.target.value || null)
          }
          placeholder="What could we improve?"
          value={settings.followUpQuestion ?? ""}
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF] px-4 py-3 text-sm font-semibold text-[#075E54]">
          {message}
        </div>
      ) : null}

      <button className={actionButtonClass("primary")} disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save CSAT settings"}
      </button>
    </form>
  );
}
