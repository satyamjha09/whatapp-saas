"use client";

import { Play, RotateCcw } from "lucide-react";

export type AutomationTestFormState = {
  countryCode: string;
  customAttributes: string;
  email: string;
  initialMessage: string;
  name: string;
  phoneNumber: string;
};

export default function AutomationTestInput({
  disabled,
  form,
  onChange,
  onReset,
  onRun,
}: {
  disabled?: boolean;
  form: AutomationTestFormState;
  onChange: (next: AutomationTestFormState) => void;
  onReset: () => void;
  onRun: () => void;
}) {
  function updateField(field: keyof AutomationTestFormState, value: string) {
    onChange({
      ...form,
      [field]: value,
    });
  }

  return (
    <div className="rounded-xl border border-[#D6EADF] bg-[#F8FFFB] p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-[#526173]">
          Customer name
          <input
            className="rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-2 focus:ring-[#128C7E]/15"
            onChange={(event) => updateField("name", event.target.value)}
            value={form.name}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#526173]">
          Email
          <input
            className="rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-2 focus:ring-[#128C7E]/15"
            onChange={(event) => updateField("email", event.target.value)}
            value={form.email}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#526173]">
          Country code
          <input
            className="rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-2 focus:ring-[#128C7E]/15"
            onChange={(event) => updateField("countryCode", event.target.value)}
            value={form.countryCode}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#526173]">
          Phone number
          <input
            className="rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-2 focus:ring-[#128C7E]/15"
            onChange={(event) => updateField("phoneNumber", event.target.value)}
            value={form.phoneNumber}
          />
        </label>
      </div>
      <label className="mt-3 grid gap-1.5 text-xs font-semibold text-[#526173]">
        Sample WhatsApp message
        <textarea
          className="min-h-20 rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-2 focus:ring-[#128C7E]/15"
          onChange={(event) => updateField("initialMessage", event.target.value)}
          value={form.initialMessage}
        />
      </label>
      <label className="mt-3 grid gap-1.5 text-xs font-semibold text-[#526173]">
        Custom attributes JSON
        <textarea
          className="min-h-20 rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 font-mono text-xs text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-2 focus:ring-[#128C7E]/15"
          onChange={(event) =>
            updateField("customAttributes", event.target.value)
          }
          value={form.customAttributes}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center rounded-xl bg-[#128C7E] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(18,140,126,0.18)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={onRun}
          type="button"
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Run Test
        </button>
        <button
          className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
          onClick={onReset}
          type="button"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset Test
        </button>
      </div>
    </div>
  );
}
