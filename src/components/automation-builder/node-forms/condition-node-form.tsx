"use client";

import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import type { NodeFormProps } from "@/components/automation-builder/types";

const operators = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "exists",
  "greater_than",
  "less_than",
];

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

export default function ConditionNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Variable</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              variable: event.target.value,
            }))
          }
          placeholder="last_reply"
          value={draft.variable ?? ""}
        />
        <FieldError message={errors.variable} />
      </label>

      <label className="block">
        <span className={labelClass}>Operator</span>
        <select
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              operator: event.target.value,
            }))
          }
          value={draft.operator ?? "equals"}
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {operator.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <FieldError message={errors.operator} />
      </label>

      <label className="block">
        <span className={labelClass}>Value</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              value: event.target.value,
            }))
          }
          placeholder="sales"
          value={draft.value ?? ""}
        />
        <FieldError message={errors.value} />
      </label>
    </div>
  );
}
