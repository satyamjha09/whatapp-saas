"use client";

import {
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import type { NodeFormProps } from "@/components/automation-builder/types";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

export default function MessageNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Message text</span>
        <textarea
          className={`${fieldClass} min-h-32 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              messageText: event.target.value,
            }))
          }
          placeholder="Hi {{name}}, welcome to our business."
          value={draft.messageText ?? ""}
        />
        <FieldError message={errors.messageText} />
      </label>

      <label className="block">
        <span className={labelClass}>Media URL</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              mediaUrl: event.target.value,
            }))
          }
          placeholder="https://example.com/image.jpg"
          type="url"
          value={draft.mediaUrl ?? ""}
        />
        <p className={helperTextClass}>Optional image, document, or video URL.</p>
      </label>
    </div>
  );
}
