"use client";

import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import type { NodeFormProps } from "@/components/automation-builder/types";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

export default function WaitForReplyNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Accepted reply type</span>
        <select
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              acceptedReplyType: event.target.value,
            }))
          }
          value={draft.acceptedReplyType ?? "ANY"}
        >
          <option value="ANY">Any</option>
          <option value="TEXT">Text</option>
          <option value="BUTTON">Button</option>
          <option value="LIST">List</option>
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Timeout minutes</span>
        <input
          className={fieldClass}
          min={1}
          max={10080}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              timeoutMinutes: Number(event.target.value),
            }))
          }
          type="number"
          value={String(draft.timeoutMinutes ?? 1440)}
        />
        <FieldError message={errors.timeoutMinutes} />
      </label>

      <label className="block">
        <span className={labelClass}>Save reply as</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              saveReplyAs: event.target.value,
            }))
          }
          placeholder="last_reply"
          value={draft.saveReplyAs ?? ""}
        />
        <FieldError message={errors.saveReplyAs} />
      </label>

      <label className="block">
        <span className={labelClass}>Timeout message</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              timeoutMessage: event.target.value,
            }))
          }
          placeholder="We did not receive a reply in time."
          value={draft.timeoutMessage ?? ""}
        />
      </label>
    </div>
  );
}
