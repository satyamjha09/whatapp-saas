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
  location?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    url: string;
  } | null;
  interactive?: {
    type:
      | "List Button"
      | "Reply Button"
      | "CTA Button"
      | "Call Permission Request"
      | "Location Request"
      | "Address Request"
      | "Flow";
    header?: string;
    body: string;
    footer?: string;
    primaryButton?: string;
    buttons?: string[];
    sections?: {
      title: string;
      rows: { title: string; description?: string }[];
    }[];
    ctaUrl?: string;
  } | null;
};

export default function WhatsAppMessagePreview({
  recipientLabel,
  template,
  variables,
  emptyMessage = "",
  bodyOverride,
  media,
  location,
  interactive,
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
      <div className="border-b border-[#D8E6F3] px-4 py-3">
        <h3 className="text-sm font-bold text-[#081B3A]">Preview</h3>
      </div>

      <div className="min-h-[300px] bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-3">
        <div className="mx-auto mb-2 w-fit rounded-full bg-white px-2 py-1 text-[10px] text-[#526173] shadow-sm">
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
                  className="max-h-36 w-full object-cover"
                />
              ) : (
                <div className="flex min-h-24 items-center justify-center bg-[#F0F8FF] px-3 text-center text-xs font-medium text-[#526173]">
                  {media.type}: {media.name}
                </div>
              )}
            </div>
          ) : null}

          {location ? (
            <a
              href={location.url}
              target="_blank"
              rel="noreferrer"
              className="block bg-white text-[#102040]"
            >
              <div className="relative h-28 overflow-hidden bg-[#F5F5F3]">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0,transparent_22%,#E6E8B6_22%,#E6E8B6_25%,transparent_25%,transparent_48%,#E6E8B6_48%,#E6E8B6_51%,transparent_51%,transparent_100%),linear-gradient(0deg,transparent_0,transparent_34%,#E6E8B6_34%,#E6E8B6_39%,transparent_39%,transparent_100%)]" />
                <div className="absolute left-[13%] top-0 h-full w-3 bg-[#E6E8B6]" />
                <div className="absolute right-[10%] top-0 h-full w-3 bg-[#E6E8B6]" />
                <div className="absolute left-[7%] top-[8%] h-10 w-20 bg-white/80" />
                <div className="absolute left-[29%] top-[6%] h-24 w-16 bg-[#B7E8A4]" />
                <div className="absolute right-[22%] top-[10%] h-16 w-20 bg-[#8BB2EE]" />
                <div className="absolute bottom-[11%] left-[23%] h-10 w-24 bg-white/80" />
                <div className="absolute bottom-[10%] right-[16%] h-14 w-28 bg-[#B7E8A4]" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-[#D4655A]">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-12 w-12 fill-current drop-shadow-sm"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
                  </svg>
                </div>
              </div>
              <div className="border-t border-[#E5E7EB] px-4 py-3">
                <p className="font-semibold leading-5">{location.name}</p>
                <p className="mt-1 text-xs leading-5 text-[#526173]">
                  {location.address}
                </p>
              </div>
            </a>
          ) : null}

          {interactive ? (
            <div className="bg-white">
              <div className="px-4 py-3">
                {interactive.header ? (
                  <p className="mb-2 font-semibold leading-5">
                    {interactive.header}
                  </p>
                ) : null}
                {interactive.type === "Call Permission Request" ? (
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-base">☎</span>
                    <p className="font-semibold">Can TallyKonnect call you ?</p>
                  </div>
                ) : null}
                {interactive.body ? (
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {interactive.body}
                  </p>
                ) : (
                  <div className="h-10 rounded-lg bg-[#E3F2FD]" />
                )}
                {interactive.type === "Call Permission Request" ? (
                  <p className="mt-2 leading-relaxed">
                    You can update your preference anytime in the business
                    profile settings.
                  </p>
                ) : null}
                {interactive.footer ? (
                  <p className="mt-2 text-xs leading-5 text-[#526173]">
                    {interactive.footer}
                  </p>
                ) : null}
              </div>

              {interactive.type === "List Button" ? (
                <div className="border-t border-[#E5E7EB] px-3 py-2">
                  <button className="w-full rounded-lg bg-[#E3F2FD] px-3 py-2 text-sm font-medium text-[#0B6BFF]">
                    {interactive.primaryButton || "List Button"}
                  </button>
                  {interactive.sections?.some((section) => section.rows.length) ? (
                    <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white p-2">
                      {interactive.sections.map((section, sectionIndex) => (
                        <div key={`${section.title}-${sectionIndex}`}>
                          {section.title ? (
                            <p className="px-2 py-1 text-xs font-semibold uppercase text-[#526173]">
                              {section.title}
                            </p>
                          ) : null}
                          {section.rows.map((row, rowIndex) => (
                            <div
                              key={`${row.title}-${rowIndex}`}
                              className="border-t border-[#F1F5F9] px-2 py-2 first:border-t-0"
                            >
                              <p className="font-medium">{row.title}</p>
                              {row.description ? (
                                <p className="mt-1 text-xs text-[#526173]">
                                  {row.description}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {interactive.type === "Reply Button" ? (
                <div className="space-y-2 border-t border-[#E5E7EB] px-3 py-2">
                  {(interactive.buttons?.length ? interactive.buttons : ["Button 1"]).map(
                    (button, index) => (
                      <button
                        key={`${button}-${index}`}
                        className="w-full rounded-lg bg-[#E3F2FD] px-3 py-2 text-sm font-medium text-[#0B6BFF]"
                      >
                        {button}
                      </button>
                    ),
                  )}
                </div>
              ) : null}

              {[
                "CTA Button",
                "Flow",
                "Location Request",
                "Address Request",
                "Call Permission Request",
              ].includes(interactive.type) ? (
                <div className="border-t border-[#E5E7EB] px-3 py-2">
                  <button className="w-full rounded-lg bg-[#E3F2FD] px-3 py-2 text-sm font-medium text-[#0B6BFF]">
                    {interactive.primaryButton ||
                      (interactive.type === "Location Request"
                        ? "Send Location"
                        : interactive.type === "Address Request"
                          ? "Provide Address"
                          : interactive.type === "Call Permission Request"
                            ? "Always allow calls"
                            : interactive.type === "Flow"
                              ? "Open Flow"
                              : "Open Link")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-9 px-4 py-2">
            {renderedPreviewBody ? (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {renderedPreviewBody}
              </p>
            ) : null}

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
