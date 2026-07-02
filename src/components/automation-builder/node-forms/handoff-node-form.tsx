"use client";

import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import type { NodeFormProps } from "@/components/automation-builder/types";

const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
const assignmentModes = ["ROUND_ROBIN", "TEAM_QUEUE", "OWNER_ONLY", "MANUAL"];

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

export default function HandoffNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Inbox priority</span>
        <select
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              inboxPriority: event.target.value,
            }))
          }
          value={draft.inboxPriority ?? "NORMAL"}
        >
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Assignment mode</span>
        <select
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              assignmentMode: event.target.value,
            }))
          }
          value={draft.assignmentMode ?? "ROUND_ROBIN"}
        >
          {assignmentModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Message to customer</span>
        <textarea
          className={`${fieldClass} min-h-28 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              messageToCustomer: event.target.value,
            }))
          }
          placeholder="Our team will join this conversation shortly."
          value={draft.messageToCustomer ?? ""}
        />
        <FieldError message={errors.messageToCustomer} />
      </label>
    </div>
  );
}
