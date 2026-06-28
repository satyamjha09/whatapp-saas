"use client";

import { useMemo } from "react";

type PreviewTemplate = {
  name: string;
  language: string;
  category: string;
  body: string;
} | null;

type WhatsAppMessagePreviewProps = {
  recipientLabel: string;
  template: PreviewTemplate;
  variables: string[];
  emptyMessage?: string;
  bodyOverride?: string;
  media?: {
    type: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
    name: string;
    url?: string;
  } | null;
};

export default function WhatsAppMessagePreview({
  recipientLabel,
  template,
  variables,
  emptyMessage = "",
  bodyOverride,
  media,
}: WhatsAppMessagePreviewProps) {
  const renderedPreviewBody = useMemo(() => {
    if (bodyOverride !== undefined) return bodyOverride;
    if (!template) return emptyMessage;

    return template.body.replace(/{{(\d+)}}/g, (placeholder, index) => {
      const value = variables[Number(index) - 1]?.trim();
      return value || placeholder;
    });
  }, [bodyOverride, emptyMessage, template, variables]);

  const previewTime = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  }, []);

  return (
    <aside
      aria-label={`Message preview for ${recipientLabel}`}
      className="overflow-hidden rounded-xl border border-[#D8E6F3] bg-white"
    >
      <div className="border-b border-[#D8E6F3] px-7 py-6">
        <h3 className="text-xl font-bold text-[#081B3A]">Preview</h3>
      </div>

      <div className="min-h-[430px] bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
        <div className="mx-auto mb-3 w-fit rounded-full bg-white px-3 py-2 text-xs text-[#526173] shadow-sm">
          Today
        </div>

        <div className="ml-auto max-w-full overflow-hidden rounded-lg bg-white text-sm text-[#102040] shadow-sm">
          {media ? (
            <div className="bg-white">
              {media.type === "IMAGE" && media.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.url}
                  alt={media.name}
                  className="max-h-72 w-full object-cover"
                />
              ) : (
                <div className="flex min-h-36 items-center justify-center bg-[#F0F8FF] px-4 text-center text-sm font-medium text-[#526173]">
                  {media.type}: {media.name}
                </div>
              )}
            </div>
          ) : null}

          <div className="min-h-9 px-4 py-2">
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {renderedPreviewBody}
            </p>

            <div className="text-right text-xs text-[#526173]">
              {previewTime}
            </div>
          </div>
        </div>

        {template ? (
          <div className="mt-4 rounded-lg bg-white/90 p-3 text-xs text-[#526173] shadow-sm">
            <span className="font-semibold text-[#081B3A]">{template.name}</span>{" "}
            - {template.language} - {template.category}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
