"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import type {
  QuickReplyButton,
  NodeFormProps,
} from "@/components/automation-builder/types";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

function getButtons(value: unknown): QuickReplyButton[] {
  return Array.isArray(value)
    ? value
        .filter(
          (button): button is QuickReplyButton =>
            Boolean(button) &&
            typeof button === "object" &&
            "id" in button &&
            "label" in button,
        )
        .map((button) => ({
          id: String(button.id),
          label: String(button.label),
        }))
    : [];
}

function createButtonId(label = "button") {
  const slug =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "button";
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${slug}_${suffix}`;
}

export default function QuickReplyNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  const buttons = getButtons(draft.buttons);

  function updateButton(index: number, field: keyof QuickReplyButton, value: string) {
    setDraft((current) => {
      const nextButtons = getButtons(current.buttons);
      nextButtons[index] = {
        ...nextButtons[index],
        [field]: value,
      };

      return {
        ...current,
        buttons: nextButtons,
      };
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Body text</span>
        <textarea
          className={`${fieldClass} min-h-28 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              bodyText: event.target.value,
            }))
          }
          placeholder="Choose an option below."
          value={draft.bodyText ?? ""}
        />
        <FieldError message={errors.bodyText} />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className={labelClass}>Buttons</span>
          <button
            className="inline-flex items-center rounded-lg bg-[#E7F8EF] px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#D7F2E3]"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                buttons: [
                  ...getButtons(current.buttons),
                  {
                    id: createButtonId("New button"),
                    label: "New button",
                  },
                ],
              }))
            }
            type="button"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </button>
        </div>

        <div className="space-y-3">
          {buttons.map((button, index) => (
            <div
              className="rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3"
              key={`${button.id}-${index}`}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  aria-label="Button ID"
                  className={fieldClass}
                  onChange={(event) =>
                    updateButton(index, "id", event.target.value)
                  }
                  placeholder="sales"
                  value={button.id}
                />
                <input
                  aria-label="Button label"
                  className={fieldClass}
                  onChange={(event) =>
                    updateButton(index, "label", event.target.value)
                  }
                  placeholder="Sales"
                  value={button.label}
                />
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      buttons: getButtons(current.buttons).filter(
                        (_button, buttonIndex) => buttonIndex !== index,
                      ),
                    }))
                  }
                  title="Remove button"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <FieldError message={errors.buttons} />
        {buttons.length === 0 ? (
          <button
            className={`${actionButtonClass("secondary")} mt-3 w-full`}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                buttons: [{ id: createButtonId("Sales"), label: "Sales" }],
              }))
            }
            type="button"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add first button
          </button>
        ) : null}
      </div>
    </div>
  );
}
