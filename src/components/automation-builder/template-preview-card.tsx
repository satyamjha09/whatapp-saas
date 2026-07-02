"use client";

import { FileText, ImageIcon, Video } from "lucide-react";
import type { TemplatePreview } from "@/lib/automation-builder/template-preview";

function MediaIcon({ type }: { type?: string }) {
  if (type === "VIDEO") return <Video className="h-5 w-5" />;
  return <ImageIcon className="h-5 w-5" />;
}

export default function TemplatePreviewCard({
  preview,
}: {
  preview: TemplatePreview;
}) {
  return (
    <div className="rounded-xl border border-[#BFE9D0] bg-[#F4FBF7] p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-normal text-[#128C7E]">
        WhatsApp preview
      </p>
      <div className="rounded-lg bg-white p-3 shadow-sm">
        {preview.mediaType ? (
          <div className="mb-3 grid min-h-28 place-items-center rounded-lg border border-dashed border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]">
            <div className="text-center text-xs font-semibold">
              <MediaIcon type={preview.mediaType} />
              <span className="mt-2 block">{preview.mediaType} header</span>
            </div>
          </div>
        ) : null}

        {preview.headerText ? (
          <p className="mb-2 text-sm font-bold text-[#081B3A]">
            {preview.headerText}
          </p>
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-6 text-[#1B2B45]">
          {preview.bodyText || "Template body preview unavailable."}
        </p>

        {preview.footerText ? (
          <p className="mt-2 text-xs text-[#7C8797]">{preview.footerText}</p>
        ) : null}

        {preview.buttons.length > 0 ? (
          <div className="mt-3 grid gap-2 border-t border-[#E7F8EF] pt-3">
            {preview.buttons.map((button, index) => (
              <span
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E7F8EF] px-3 py-2 text-xs font-bold text-[#128C7E]"
                key={`${button.type}-${button.text}-${index}`}
              >
                <FileText className="h-3.5 w-3.5" />
                {button.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
