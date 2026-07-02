"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import TemplatePreviewCard from "@/components/automation-builder/template-preview-card";
import type { TemplatePreview } from "@/lib/automation-builder/template-preview";
import type { TemplateVariableMetadata } from "@/lib/automation-builder/template-variables";

export type AutomationTemplateOption = {
  body?: string;
  category: string;
  components: unknown;
  id: string;
  languageCode: string;
  name: string;
  preview: TemplatePreview;
  status: string;
  variableMetadata: TemplateVariableMetadata;
};

export default function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: AutomationTemplateOption) => void;
}) {
  const [category, setCategory] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<AutomationTemplateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedPreview = useMemo(() => templates[0]?.preview, [templates]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    const searchParams = new URLSearchParams({
      limit: "30",
      status: "APPROVED",
    });

    if (search.trim()) searchParams.set("search", search.trim());
    if (category) searchParams.set("category", category);
    if (languageCode.trim()) searchParams.set("languageCode", languageCode.trim());

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
    });

    fetch(`/api/automation/templates?${searchParams.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load templates");
        }

        return response.json() as Promise<{
          templates: AutomationTemplateOption[];
        }>;
      })
      .then((data) => setTemplates(data.templates ?? []))
      .catch((fetchError) => {
        if (controller.signal.aborted) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load templates",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [category, isOpen, languageCode, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white shadow-[0_26px_70px_rgba(8,27,58,0.24)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#BFE9D0] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Approved templates
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#081B3A]">
              Select WhatsApp template
            </h3>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#BFE9D0] text-[#128C7E] transition hover:bg-[#E7F8EF]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_140px]">
              <label className="block">
                <span className={labelClass}>Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7C8797]" />
                  <input
                    className={`${fieldClass} pl-9`}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="hello_world, order update..."
                    value={search}
                  />
                </div>
              </label>

              <label className="block">
                <span className={labelClass}>Category</span>
                <select
                  className={fieldClass}
                  onChange={(event) => setCategory(event.target.value)}
                  value={category}
                >
                  <option value="">All</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </label>

              <label className="block">
                <span className={labelClass}>Language</span>
                <input
                  className={fieldClass}
                  onChange={(event) => setLanguageCode(event.target.value)}
                  placeholder="en_US"
                  value={languageCode}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2">
              {loading ? (
                <p className="rounded-xl bg-[#F8FCFA] p-4 text-sm text-[#526173]">
                  Loading templates...
                </p>
              ) : null}

              {error ? (
                <p className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">
                  {error}
                </p>
              ) : null}

              {!loading && templates.length === 0 && !error ? (
                <p className="rounded-xl bg-[#F8FCFA] p-4 text-sm text-[#526173]">
                  No approved templates found for these filters.
                </p>
              ) : null}

              {templates.map((template) => (
                <button
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4 text-left transition hover:border-[#128C7E]/50 hover:bg-[#F4FBF7]"
                  key={template.id}
                  onClick={() => {
                    onSelect(template);
                    onClose();
                  }}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#081B3A]">
                        {template.name}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {template.category} - {template.languageCode}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-bold text-[#128C7E]">
                      {template.status}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#526173]">
                    {template.preview.bodyText || "No preview available"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            {selectedPreview ? (
              <TemplatePreviewCard preview={selectedPreview} />
            ) : (
              <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm leading-6 text-[#526173]">
                Template preview appears after results load.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
