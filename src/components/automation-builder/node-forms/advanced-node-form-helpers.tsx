"use client";

import type { Dispatch, SetStateAction } from "react";
import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import type { AutomationEditableNodeData } from "@/components/automation-builder/types";

type DraftSetter = Dispatch<SetStateAction<AutomationEditableNodeData>>;

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

export function jsonText(value: unknown, fallback: unknown = {}) {
  return typeof value === "string" ? value : JSON.stringify(value ?? fallback, null, 2);
}

export function TextInput({
  errors,
  field,
  label,
  placeholder,
  setDraft,
  type = "text",
}: {
  errors?: Record<string, string>;
  field: keyof AutomationEditableNodeData;
  label: string;
  placeholder?: string;
  setDraft: DraftSetter;
  type?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        className={fieldClass}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [field]:
              type === "number" ? Number(event.target.value) : event.target.value,
          }))
        }
        placeholder={placeholder}
        type={type}
      />
      <FieldError message={errors?.[String(field)]} />
    </label>
  );
}

export function BoundTextInput({
  draft,
  errors,
  field,
  label,
  placeholder,
  setDraft,
  type = "text",
}: {
  draft: AutomationEditableNodeData;
  errors?: Record<string, string>;
  field: keyof AutomationEditableNodeData;
  label: string;
  placeholder?: string;
  setDraft: DraftSetter;
  type?: string;
}) {
  const value = draft[field];

  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        className={fieldClass}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [field]:
              type === "number" ? Number(event.target.value) : event.target.value,
          }))
        }
        placeholder={placeholder}
        type={type}
        value={value === undefined ? "" : String(value)}
      />
      <FieldError message={errors?.[String(field)]} />
    </label>
  );
}

export function SelectInput({
  draft,
  field,
  label,
  options,
  setDraft,
}: {
  draft: AutomationEditableNodeData;
  field: keyof AutomationEditableNodeData;
  label: string;
  options: string[];
  setDraft: DraftSetter;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select
        className={fieldClass}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [field]: event.target.value,
          }))
        }
        value={String(draft[field] ?? options[0] ?? "")}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export function JsonTextarea({
  draft,
  field,
  label,
  placeholder,
  setDraft,
}: {
  draft: AutomationEditableNodeData;
  field: keyof AutomationEditableNodeData;
  label: string;
  placeholder?: string;
  setDraft: DraftSetter;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea
        className={`${fieldClass} min-h-28 resize-y font-mono`}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [field]: event.target.value,
          }))
        }
        placeholder={placeholder}
        value={jsonText(draft[field])}
      />
    </label>
  );
}

export function BooleanCheckbox({
  draft,
  field,
  label,
  setDraft,
}: {
  draft: AutomationEditableNodeData;
  field: keyof AutomationEditableNodeData;
  label: string;
  setDraft: DraftSetter;
}) {
  return (
    <label className="flex items-start gap-2 text-sm font-semibold text-[#526173]">
      <input
        checked={Boolean(draft[field])}
        className="mt-1"
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [field]: event.target.checked,
          }))
        }
        type="checkbox"
      />
      {label}
    </label>
  );
}
