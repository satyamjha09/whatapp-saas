"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  JsonTextarea,
  SelectInput,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function WebhookNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <SelectInput
        draft={draft}
        field="method"
        label="Method"
        options={["GET", "POST", "PUT", "PATCH", "DELETE"]}
        setDraft={setDraft}
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="url"
        label="Webhook URL"
        placeholder="https://api.example.com/webhook"
        setDraft={setDraft}
        type="url"
      />
      <SelectInput
        draft={draft}
        field="authMode"
        label="Auth mode"
        options={["NONE", "API_KEY", "BEARER_TOKEN", "BASIC"]}
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="authConfig"
        label="Auth config JSON"
        placeholder='{"headerName":"X-API-Key","tokenSecretId":"secret_123"}'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="headers"
        label="Headers JSON"
        placeholder='[{"key":"X-Source","value":"metawhat","secret":false}]'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="body"
        label="Body JSON/template"
        placeholder='{"phone":"{{contact.phoneNumber}}"}'
        setDraft={setDraft}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="timeoutMs"
          label="Timeout ms"
          setDraft={setDraft}
          type="number"
        />
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="retryCount"
          label="Retry count"
          setDraft={setDraft}
          type="number"
        />
      </div>
      <JsonTextarea
        draft={draft}
        field="responseMapping"
        label="Response mapping JSON"
        placeholder='[{"responsePath":"data.id","saveAs":"leadId"}]'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="mockResponse"
        label="Mock response for Live Test"
        placeholder='{"ok":true,"data":{"id":"lead_123"}}'
        setDraft={setDraft}
      />
    </div>
  );
}
