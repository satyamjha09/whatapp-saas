"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import TemplateSelectorModal, {
  type AutomationTemplateOption,
} from "@/components/automation-builder/template-selector-modal";
import type { NodeFormProps } from "@/components/automation-builder/types";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyList(value: unknown) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export default function TemplateTriggerNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);

  function selectTemplate(template: AutomationTemplateOption) {
    setDraft((current) => ({
      ...current,
      templateId: template.id,
      templateName: template.name,
    }));
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Trigger name</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              triggerName: event.target.value,
            }))
          }
          placeholder="Template reply received"
          value={draft.triggerName ?? ""}
        />
        <FieldError message={errors.triggerName} />
      </label>

      <label className="block">
        <span className={labelClass}>Trigger mode</span>
        <select
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              triggerMode: event.target.value,
            }))
          }
          value={draft.triggerMode ?? "ANY_TEMPLATE_REPLY"}
        >
          <option value="ANY_TEMPLATE_REPLY">Any template reply</option>
          <option value="SPECIFIC_TEMPLATE_REPLY">Specific template reply</option>
          <option value="SPECIFIC_CAMPAIGN_REPLY">Specific campaign reply</option>
          <option value="BUTTON_REPLY">Button reply</option>
          <option value="TEXT_REPLY">Text reply</option>
        </select>
      </label>

      {draft.triggerMode === "SPECIFIC_TEMPLATE_REPLY" ? (
        <div className="rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#081B3A]">
                {draft.templateName || draft.templateId || "No template selected"}
              </p>
              <p className="mt-1 text-xs text-[#526173]">
                Replies to this template start the flow.
              </p>
            </div>
            <button
              className="rounded-xl bg-[#128C7E] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#075E54]"
              onClick={() => setSelectorOpen(true)}
              type="button"
            >
              Select
            </button>
          </div>
          <FieldError message={errors.templateId} />
        </div>
      ) : null}

      {draft.triggerMode === "SPECIFIC_CAMPAIGN_REPLY" ? (
        <label className="block">
          <span className={labelClass}>Campaign ID</span>
          <input
            className={fieldClass}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                campaignId: event.target.value,
              }))
            }
            placeholder="campaign_id"
            value={draft.campaignId ?? ""}
          />
          <FieldError message={errors.campaignId} />
        </label>
      ) : null}

      <label className="block">
        <span className={labelClass}>Keywords</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              keywords: parseList(event.target.value),
            }))
          }
          placeholder="price&#10;interested"
          value={stringifyList(draft.keywords)}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Button IDs</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              buttonIds: parseList(event.target.value),
            }))
          }
          placeholder="sales&#10;support"
          value={stringifyList(draft.buttonIds)}
        />
        <FieldError message={errors.buttonIds} />
      </label>

      <TemplateSelectorModal
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={selectTemplate}
      />
    </div>
  );
}
