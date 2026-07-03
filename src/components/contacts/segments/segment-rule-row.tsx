"use client";

import { Trash2 } from "lucide-react";
import { fieldClass } from "@/app/dashboard/dashboard-ui";
import {
  FIELD_OPTIONS,
  OPERATOR_LABELS,
  operatorNeedsValue,
  valueInputType,
  type SegmentRuleDraft,
} from "./segment-fields";

export function SegmentRuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: SegmentRuleDraft;
  onChange: (rule: SegmentRuleDraft) => void;
  onRemove: () => void;
}) {
  const fieldMeta = FIELD_OPTIONS.find((option) => option.value === rule.field);
  const operators = fieldMeta?.operators ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#BFE9D0] bg-[#F7FCF9] p-3">
      <select
        aria-label="Rule field"
        className={`${fieldClass} w-auto min-w-[160px] flex-none py-2`}
        value={rule.field}
        onChange={(event) => {
          const nextField = event.target.value as SegmentRuleDraft["field"];
          const nextMeta = FIELD_OPTIONS.find((option) => option.value === nextField);
          const nextOperator = nextMeta?.operators[0] ?? "EQUALS";

          onChange({
            field: nextField,
            operator: nextOperator,
            value: "",
            customFieldKey: "",
          });
        }}
      >
        {FIELD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {rule.field === "CUSTOM_FIELD" && (
        <input
          aria-label="Custom attribute key"
          className={`${fieldClass} w-auto min-w-[140px] flex-none py-2`}
          placeholder="attribute key (e.g. city)"
          value={rule.customFieldKey ?? ""}
          onChange={(event) =>
            onChange({ ...rule, customFieldKey: event.target.value })
          }
        />
      )}

      <select
        aria-label="Rule operator"
        className={`${fieldClass} w-auto min-w-[150px] flex-none py-2`}
        value={rule.operator}
        onChange={(event) =>
          onChange({
            ...rule,
            operator: event.target.value as SegmentRuleDraft["operator"],
          })
        }
      >
        {operators.map((operator) => (
          <option key={operator} value={operator}>
            {OPERATOR_LABELS[operator]}
          </option>
        ))}
      </select>

      {operatorNeedsValue(rule.operator) && (
        <input
          aria-label="Rule value"
          type={valueInputType(rule.field, rule.operator)}
          className={`${fieldClass} w-auto min-w-[160px] flex-1 py-2`}
          placeholder={
            rule.operator === "IN_LAST_DAYS" || rule.operator === "NOT_IN_LAST_DAYS"
              ? "days"
              : "value"
          }
          value={rule.value ?? ""}
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
        />
      )}

      <button
        type="button"
        aria-label="Remove rule"
        onClick={onRemove}
        className="grid h-9 w-9 flex-none place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
