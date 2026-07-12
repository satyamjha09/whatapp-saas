"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PackageSearch,
  Plus,
  Send,
  ShoppingBag,
} from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import {
  buildMetaExamples,
  buildVariableMetadata,
  renderPreview,
  validateSampleValues,
  validateVariableSequence,
  type TemplateVariable,
} from "@/lib/whatsapp-template/template-variable-engine";

type CatalogOption = {
  id: string;
  isUsable?: boolean;
  metaCatalogId: string;
  name: string;
  productCount: number;
  lastSyncedAt?: string | null;
  remoteMissingAt?: string | null;
  status: string;
};

type CatalogTemplateFormProps = {
  initialLanguage?: string;
  initialName?: string;
};

type CreateTemplateResponse = {
  message: string;
  errors?: {
    name?: string[];
    language?: string[];
    category?: string[];
    body?: string[];
    components?: string[];
  };
};

const languages = [
  { label: "English (US)", value: "en_US" },
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
];

function cleanTemplateName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeLanguage(value: string | undefined) {
  return languages.some((language) => language.value === value) ? value : "en_US";
}

function sampleInputKey(variable: TemplateVariable) {
  return variable.component === "BUTTON"
    ? `BUTTON_${variable.buttonIndex ?? 0}_${variable.key}`
    : `${variable.component}_${variable.key}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not synced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not synced";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CatalogTemplateForm({
  initialLanguage,
  initialName,
}: CatalogTemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(cleanTemplateName(initialName ?? ""));
  const [language, setLanguage] = useState(normalizeLanguage(initialLanguage));
  const [body, setBody] = useState(
    "Hi {{1}}, browse our latest products from the catalog below.",
  );
  const [footer, setFooter] = useState("metawhat");
  const [catalogs, setCatalogs] = useState<CatalogOption[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({
    "1": "Satyam Jha",
    BODY_1: "Satyam Jha",
  });
  const [error, setError] = useState("");
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch("/api/whatsapp/catalogs?usableOnly=true&pageSize=100", {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          catalogs?: CatalogOption[];
          message?: string;
        };

        if (!response.ok) {
          throw new Error(data.message ?? "Unable to fetch WhatsApp catalogs");
        }

        if (!mounted) return;

        const usableCatalogs = (data.catalogs ?? []).filter(
          (catalog) =>
            catalog.isUsable !== false &&
            !catalog.remoteMissingAt &&
            Boolean(catalog.metaCatalogId),
        );

        setCatalogs(usableCatalogs);
        setSelectedCatalogId((current) => current || usableCatalogs[0]?.id || "");
      })
      .catch(() => {
        if (mounted) {
          setError("Unable to load synced WhatsApp Catalogs.");
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingCatalogs(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedCatalog = useMemo(
    () => catalogs.find((catalog) => catalog.id === selectedCatalogId) ?? null,
    [catalogs, selectedCatalogId],
  );
  const variableMetadata = useMemo(
    () => buildVariableMetadata({ body, sampleValues }),
    [body, sampleValues],
  );

  function updateSampleValue(variable: TemplateVariable, value: string) {
    const key = sampleInputKey(variable);
    setSampleValues((current) => ({
      ...current,
      [key]: value,
      [variable.key]: value,
    }));
  }

  function addVariable() {
    const nextIndex = (body.match(/{{\s*[a-zA-Z0-9_]+\s*}}/g)?.length ?? 0) + 1;
    setBody((current) => `${current}${current ? " " : ""}{{${nextIndex}}}`);
  }

  function buildComponents() {
    const bodyExample = buildMetaExamples(
      variableMetadata.variables,
      sampleValues,
      "BODY",
    );
    const components: Array<Record<string, unknown>> = [
      {
        ...(bodyExample ? { example: bodyExample } : {}),
        text: body.trim(),
        type: "BODY",
      },
    ];

    if (footer.trim()) {
      components.push({
        text: footer.trim(),
        type: "FOOTER",
      });
    }

    components.push({
      buttons: [
        {
          text: "View catalog",
          type: "CATALOG",
        },
      ],
      type: "BUTTONS",
    });

    return {
      catalog: {
        localCatalogId: selectedCatalog?.id,
        metaCatalogId: selectedCatalog?.metaCatalogId,
        name: selectedCatalog?.name,
      },
      components,
      templateType: "CATALOG",
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    if (!body.trim()) {
      setError("Message body is required.");
      return;
    }

    if (body.trim().length > 1024) {
      setError("Message body must be less than 1024 characters.");
      return;
    }

    if (footer.trim().length > 60) {
      setError("Footer must be 60 characters or less.");
      return;
    }

    if (!selectedCatalog) {
      setError("Select a synced WhatsApp Catalog.");
      return;
    }

    const sequenceIssues = validateVariableSequence(variableMetadata.variables);
    if (sequenceIssues.length > 0) {
      setError(sequenceIssues[0]?.message ?? "Invalid variable sequence.");
      return;
    }

    const sampleIssues = validateSampleValues(
      variableMetadata.variables,
      sampleValues,
    );
    if (sampleIssues.length > 0) {
      setError(sampleIssues[0]?.message ?? "Sample values are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/templates", {
        body: JSON.stringify({
          body,
          category: "MARKETING",
          components: buildComponents(),
          language,
          name,
          templateType: "CATALOG",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as CreateTemplateResponse;

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ??
          data.errors?.language?.[0] ??
          data.errors?.category?.[0] ??
          data.errors?.body?.[0] ??
          data.errors?.components?.[0] ??
          data.message;
        setError(firstError);
        return;
      }

      router.push("/dashboard/templates");
      router.refresh();
    } catch {
      setError("Unable to create Catalog template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Template Configuration
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Catalog template details
            </h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={fieldClass}
                maxLength={80}
                onChange={(event) =>
                  setName(cleanTemplateName(event.target.value))
                }
                placeholder="summer_catalog_offer"
                required
                value={name}
              />
              <p className={helperTextClass}>
                Lowercase letters, numbers, and underscores.
              </p>
            </label>

            <label className="block">
              <span className={labelClass}>Language</span>
              <select
                className={fieldClass}
                onChange={(event) => setLanguage(event.target.value)}
                value={language}
              >
                {languages.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Category</span>
              <input
                className={`${fieldClass} bg-[#F8FCFA]`}
                readOnly
                value="Marketing"
              />
              <p className={helperTextClass}>
                Catalog templates are created as Marketing drafts.
              </p>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Message Content
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Body and footer
            </h2>
          </div>
          <div className="space-y-5 p-5">
            <label className="block">
              <span className={labelClass}>Message body</span>
              <textarea
                className={`${fieldClass} min-h-36 resize-y`}
                maxLength={1024}
                onChange={(event) => setBody(event.target.value)}
                required
                value={body}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className={helperTextClass}>
                  Use variables like {"{{1}}"} and provide sample values below.
                </p>
                <button
                  className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-bold text-[#128C7E] hover:bg-[#E7F8EF]"
                  onClick={addVariable}
                  type="button"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add variable
                </button>
              </div>
            </label>

            <label className="block">
              <span className={labelClass}>Footer</span>
              <input
                className={fieldClass}
                maxLength={60}
                onChange={(event) => setFooter(event.target.value)}
                placeholder="metawhat"
                value={footer}
              />
              <p className={helperTextClass}>Optional, 60 characters maximum.</p>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Catalog Selection
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Choose synced catalog
            </h2>
          </div>
          <div className="space-y-4 p-5">
            {isLoadingCatalogs ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm font-semibold text-[#526173]">
                <Loader2 className="h-4 w-4 animate-spin text-[#128C7E]" />
                Loading usable Catalogs...
              </div>
            ) : catalogs.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-bold">No usable Catalogs found.</p>
                <p className="mt-1 leading-6">
                  Go to Catalogs, sync from Meta, then sync products before
                  creating a Catalog template.
                </p>
              </div>
            ) : (
              <label className="block">
                <span className={labelClass}>WhatsApp Catalog</span>
                <select
                  className={fieldClass}
                  onChange={(event) => setSelectedCatalogId(event.target.value)}
                  required
                  value={selectedCatalogId}
                >
                  {catalogs.map((catalog) => (
                    <option key={catalog.id} value={catalog.id}>
                      {catalog.name} - {catalog.productCount} products
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedCatalog ? (
              <div className="grid gap-3 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm text-[#526173] md:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase text-[#128C7E]">
                    Catalog
                  </p>
                  <p className="mt-1 font-bold text-[#081B3A]">
                    {selectedCatalog.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#128C7E]">
                    Meta Catalog ID
                  </p>
                  <p className="mt-1 font-mono text-xs text-[#081B3A]">
                    {selectedCatalog.metaCatalogId}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#128C7E]">
                    Products
                  </p>
                  <p className="mt-1 font-bold text-[#081B3A]">
                    {selectedCatalog.productCount}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Catalog Button
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              View catalog CTA
            </h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4">
              <div>
                <p className="text-sm font-bold text-[#081B3A]">View catalog</p>
                <p className={helperTextClass}>
                  Uses the shared Catalog button rule and is stored as the
                  WhatsApp SPM button during Meta payload building.
                </p>
              </div>
              <span className="inline-flex rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-bold text-[#128C7E]">
                Catalog button
              </span>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Variable Samples
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Review examples
            </h2>
          </div>
          <div className="space-y-4 p-5">
            {variableMetadata.variables.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm text-[#526173]">
                No variables detected in this message body.
              </div>
            ) : (
              variableMetadata.variables.map((variable) => (
                <label className="block" key={sampleInputKey(variable)}>
                  <span className={labelClass}>{`{{${variable.key}}}`}</span>
                  <input
                    className={fieldClass}
                    onChange={(event) =>
                      updateSampleValue(variable, event.target.value)
                    }
                    placeholder="Sample value"
                    value={sampleValues[sampleInputKey(variable)] ?? ""}
                  />
                </label>
              ))
            )}
          </div>
        </section>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            className={actionButtonClass("secondary")}
            onClick={() => router.push("/dashboard/templates/new")}
            type="button"
          >
            Back
          </button>
          <button
            className={actionButtonClass()}
            disabled={isSubmitting || isLoadingCatalogs}
            type="submit"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Save Draft
          </button>
        </div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white shadow-sm">
          <div className="border-b border-[#DCEFE4] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              WhatsApp Preview
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Catalog message
            </h2>
          </div>
          <div className="bg-[#ECE5DD] p-5">
            <div className="ml-auto max-w-[290px] rounded-lg bg-white p-3 text-sm text-[#081B3A] shadow">
              <p className="whitespace-pre-wrap leading-6">
                {renderPreview(body, sampleValues, { component: "BODY" }) ||
                  "Your message body will appear here."}
              </p>
              {footer.trim() ? (
                <p className="mt-2 border-t border-[#E5E7EB] pt-2 text-xs text-[#7C8794]">
                  {footer.trim()}
                </p>
              ) : null}
              {selectedCatalog ? (
                <div className="mt-3 rounded-lg border border-[#DCEFE4] bg-[#F8FCFA] p-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-[#128C7E]" />
                    <p className="truncate text-xs font-bold text-[#081B3A]">
                      {selectedCatalog.name}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[#526173]">
                    {selectedCatalog.productCount} synced products
                  </p>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-center gap-2 border-t border-[#DCEFE4] pt-3 text-sm font-bold text-[#128C7E]">
                <PackageSearch className="h-4 w-4" />
                View catalog
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#128C7E]" />
            <div>
              <p className="text-sm font-bold text-[#081B3A]">
                Draft only in this phase
              </p>
              <p className="mt-1 text-sm leading-6 text-[#526173]">
                Saving stores the local template draft with the selected
                Catalog. Meta submission and runtime sending are handled in
                later phases.
              </p>
            </div>
          </div>
        </section>

        {selectedCatalog ? (
          <section className="rounded-xl border border-[#BFE9D0] bg-white p-4">
            <p className="text-xs font-bold uppercase text-[#128C7E]">
              Selected Catalog
            </p>
            <h3 className="mt-2 text-base font-bold text-[#081B3A]">
              {selectedCatalog.name}
            </h3>
            <dl className="mt-3 space-y-2 text-sm text-[#526173]">
              <div className="flex justify-between gap-3">
                <dt>Status</dt>
                <dd className="font-semibold text-[#081B3A]">
                  {selectedCatalog.status}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Products</dt>
                <dd className="font-semibold text-[#081B3A]">
                  {selectedCatalog.productCount}
                </dd>
              </div>
              <div>
                <dt>Last synced</dt>
                <dd className="mt-1 text-xs text-[#526173]">
                  {formatDate(selectedCatalog.lastSyncedAt)}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}
      </aside>
    </form>
  );
}
