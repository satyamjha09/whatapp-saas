"use client";

import type { AutomationTestStep } from "@/components/automation-builder/automation-test-types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function latestPreviewStep(steps: AutomationTestStep[]) {
  return [...steps].reverse().find((step) => {
    const output = asRecord(step.output);
    return Boolean(output.messageType || output.body || output.bodyText || output.preview);
  });
}

export default function AutomationTestMessagePreview({
  steps,
}: {
  steps: AutomationTestStep[];
}) {
  const step = latestPreviewStep(steps);
  const output = asRecord(step?.output);

  if (!step) {
    return (
      <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-white p-4 text-sm text-[#526173]">
        Preview will appear after a message node runs.
      </div>
    );
  }

  const messageType = String(output.messageType ?? "text");
  const body = String(output.preview ?? output.body ?? output.bodyText ?? "");
  const buttons = Array.isArray(output.buttons) ? output.buttons.map(asRecord) : [];
  const sections = Array.isArray(output.sections) ? output.sections.map(asRecord) : [];

  return (
    <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
      <div className="mx-auto max-w-sm rounded-2xl bg-white p-3 shadow-[0_12px_24px_rgba(8,27,58,0.10)]">
        <p className="text-[11px] font-bold uppercase tracking-normal text-[#128C7E]">
          {messageType.replace(/_/g, " ")}
        </p>
        {messageType === "template" ? (
          <p className="mt-1 text-[11px] font-semibold text-[#526173]">
            {String(output.templateName ?? output.templateId ?? "Template")} ·{" "}
            {String(output.languageCode ?? "en_US")}
          </p>
        ) : null}
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#081B3A]">
          {body || "No body text"}
        </p>
        {buttons.length > 0 ? (
          <div className="mt-3 grid gap-1 border-t border-[#E7F8EF] pt-2">
            {buttons.map((button, index) => (
              <span
                className="rounded-lg bg-[#F0FDF5] px-3 py-2 text-center text-xs font-bold text-[#128C7E]"
                key={`${String(button.id)}-${index}`}
              >
                {String(button.label || button.id)}
              </span>
            ))}
          </div>
        ) : null}
        {sections.length > 0 ? (
          <div className="mt-3 grid gap-2 border-t border-[#E7F8EF] pt-2">
            {sections.map((section, sectionIndex) => {
              const items = Array.isArray(section.items)
                ? section.items.map(asRecord)
                : [];

              return (
                <div key={`${String(section.id)}-${sectionIndex}`}>
                  <p className="text-[11px] font-bold text-[#526173]">
                    {String(section.title || "Options")}
                  </p>
                  {items.map((item, itemIndex) => (
                    <div
                      className="mt-1 rounded-lg bg-[#F8FFFB] px-3 py-2"
                      key={`${String(item.id)}-${itemIndex}`}
                    >
                      <p className="text-xs font-bold text-[#081B3A]">
                        {String(item.title || item.id)}
                      </p>
                      {item.description ? (
                        <p className="mt-0.5 text-[11px] text-[#526173]">
                          {String(item.description)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
