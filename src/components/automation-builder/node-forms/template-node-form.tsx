"use client";

import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import type { NodeFormProps } from "@/components/automation-builder/types";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

export default function TemplateNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Template ID</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              templateId: event.target.value,
            }))
          }
          placeholder="hello_world"
          value={draft.templateId ?? ""}
        />
        <FieldError message={errors.templateId} />
      </label>

      <label className="block">
        <span className={labelClass}>Language code</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              languageCode: event.target.value,
            }))
          }
          placeholder="en_US"
          value={draft.languageCode ?? "en_US"}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Variable mappings</span>
        <textarea
          className={`${fieldClass} min-h-28 resize-y font-mono`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              variableMappings: event.target.value,
            }))
          }
          placeholder='{"1":"{{name}}","2":"{{order_id}}"}'
          value={draft.variableMappings ?? ""}
        />
      </label>
    </div>
  );
}
