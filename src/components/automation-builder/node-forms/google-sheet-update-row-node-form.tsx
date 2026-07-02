"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  JsonTextarea,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function GoogleSheetUpdateRowNodeForm({
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
        setDraft={setDraft}
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="lookupColumn"
        label="Lookup column"
        placeholder="Phone"
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="lookupValueSource"
        label="Lookup value source"
        placeholder='{"sourceType":"CONTACT_FIELD","sourceValue":"phoneNumber"}'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="updateMappings"
        label="Update mappings"
        placeholder='[{"columnName":"Status","sourceType":"STATIC","sourceValue":"Interested"}]'
        setDraft={setDraft}
      />
    </div>
  );
}
