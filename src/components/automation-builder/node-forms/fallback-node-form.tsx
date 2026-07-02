"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  SelectInput,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function FallbackNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="fallbackMessage"
        label="Fallback message"
        placeholder="Sorry, I could not process that."
        setDraft={setDraft}
      />
      <SelectInput
        draft={draft}
        field="nextAction"
        label="Next action"
        options={["SEND_MESSAGE", "HUMAN_HANDOFF", "END"]}
        setDraft={setDraft}
      />
    </div>
  );
}
