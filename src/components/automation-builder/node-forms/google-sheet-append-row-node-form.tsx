"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  JsonTextarea,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function GoogleSheetAppendRowNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="connectedGoogleAccountId"
        label="Connected Google account ID"
        placeholder="google_account_123"
        setDraft={setDraft}
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="spreadsheetId"
        label="Spreadsheet ID"
        setDraft={setDraft}
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="sheetName"
        label="Sheet name"
        placeholder="Sheet1"
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="columnMappings"
        label="Column mappings"
        placeholder='[{"columnName":"Phone","sourceType":"CONTACT_FIELD","sourceValue":"phoneNumber"}]'
        setDraft={setDraft}
      />
    </div>
  );
}
