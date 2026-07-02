"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  SelectInput,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function RetryNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="maxRetries"
          label="Max retries"
          setDraft={setDraft}
          type="number"
        />
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="retryDelaySeconds"
          label="Retry delay seconds"
          setDraft={setDraft}
          type="number"
        />
      </div>
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="retryTargetNodeId"
        label="Retry target node ID"
        placeholder="node_webhook"
        setDraft={setDraft}
      />
      <SelectInput
        draft={draft}
        field="onMaxRetriesAction"
        label="On max retries"
        options={["ERROR_PATH", "HUMAN_HANDOFF", "END"]}
        setDraft={setDraft}
      />
    </div>
  );
}
