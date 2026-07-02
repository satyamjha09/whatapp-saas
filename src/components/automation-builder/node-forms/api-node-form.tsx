"use client";

import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import type { NodeFormProps } from "@/components/automation-builder/types";

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

export default function ApiNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Method</span>
        <select
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              method: event.target.value,
            }))
          }
          value={draft.method ?? "POST"}
        >
          {methods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>URL</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              url: event.target.value,
            }))
          }
          placeholder="https://api.example.com/leads"
          type="url"
          value={draft.url ?? ""}
        />
        <FieldError message={errors.url} />
      </label>

      <label className="block">
        <span className={labelClass}>Headers</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-y font-mono`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              headers: event.target.value,
            }))
          }
          placeholder='{"Authorization":"Bearer {{token}}"}'
          value={draft.headers ?? ""}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Body</span>
        <textarea
          className={`${fieldClass} min-h-28 resize-y font-mono`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              body: event.target.value,
            }))
          }
          placeholder='{"phone":"{{phone}}","reply":"{{last_reply}}"}'
          value={draft.body ?? ""}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Response mapping</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-y font-mono`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              responseMapping: event.target.value,
            }))
          }
          placeholder='{"leadId":"$.id"}'
          value={draft.responseMapping ?? ""}
        />
      </label>
    </div>
  );
}
