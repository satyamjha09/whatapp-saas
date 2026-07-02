"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  JsonTextarea,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";
import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";

function parseIds(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AiReplyNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="agentId"
        label="Agent ID"
        setDraft={setDraft}
      />
      <label className="block">
        <span className={labelClass}>System instruction</span>
        <textarea
          className={`${fieldClass} min-h-28 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              systemInstruction: event.target.value,
            }))
          }
          value={String(draft.systemInstruction ?? "")}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Knowledge base IDs</span>
        <textarea
          className={`${fieldClass} min-h-20 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              knowledgeBaseIds: parseIds(event.target.value),
            }))
          }
          placeholder="kb_123&#10;kb_456"
          value={
            Array.isArray(draft.knowledgeBaseIds)
              ? draft.knowledgeBaseIds.join("\n")
              : ""
          }
        />
      </label>
      <JsonTextarea
        draft={draft}
        field="userMessageSource"
        label="User message source"
        placeholder='{"sourceType":"TRIGGER_MESSAGE","sourceValue":"trigger.text"}'
        setDraft={setDraft}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="saveReplyAs"
          label="Save reply as"
          setDraft={setDraft}
        />
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="confidenceThreshold"
          label="Confidence threshold"
          setDraft={setDraft}
          type="number"
        />
      </div>
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="maxTokens"
        label="Max tokens"
        setDraft={setDraft}
        type="number"
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="fallbackMessage"
        label="Fallback message"
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="mockResponse"
        label="Mock AI response"
        placeholder='{"text":"This is a simulated AI reply.","confidence":0.82}'
        setDraft={setDraft}
      />
    </div>
  );
}
