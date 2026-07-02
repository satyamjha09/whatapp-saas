"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BooleanCheckbox,
  BoundTextInput,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function ErrorHandlerNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="errorMessageToCustomer"
        label="Customer error message"
        placeholder="Something went wrong. Our team will check this."
        setDraft={setDraft}
      />
      <BooleanCheckbox
        draft={draft}
        field="notifyTeam"
        label="Notify team"
        setDraft={setDraft}
      />
      <BooleanCheckbox
        draft={draft}
        field="openInbox"
        label="Open inbox"
        setDraft={setDraft}
      />
      <BooleanCheckbox
        draft={draft}
        field="endSession"
        label="End session"
        setDraft={setDraft}
      />
    </div>
  );
}
