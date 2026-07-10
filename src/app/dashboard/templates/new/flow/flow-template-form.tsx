"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FormInput,
  Loader2,
  Plus,
  Send,
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
import {
  FLOW_RESPONSE_CONFLICT_POLICIES,
  FLOW_RESPONSE_CONTACT_FIELD_TARGETS,
  FLOW_RESPONSE_TARGET_TYPES,
  FLOW_RESPONSE_TRANSFORMS,
  validateFlowResponseMappings,
  type FlowResponseConflictPolicy,
  type FlowResponseMapping,
  type FlowResponseTargetType,
  type FlowResponseTransform,
} from "@/lib/whatsapp-flow-response-mapping";

type TemplateCategory = "MARKETING" | "UTILITY";
type FlowAction = "NAVIGATE" | "DATA_EXCHANGE";

type FlowOption = {
  id: string;
  isUsableForTemplates?: boolean;
  metaFlowId: string;
  name: string;
  remoteMissingAt?: string | null;
  status: string;
  defaultCta?: string | null;
  defaultScreen?: string | null;
  updatedAt?: string | null;
};

type FlowTemplateFormProps = {
  initialCategory?: string;
  initialFlowId?: string;
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

const categories: Array<{ label: string; value: TemplateCategory }> = [
  { label: "Marketing", value: "MARKETING" },
  { label: "Utility", value: "UTILITY" },
];

const languages = [
  { label: "English (US)", value: "en_US" },
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
];

const contactFieldLabels: Record<string, string> = {
  city: "City",
  companyName: "Company name",
  email: "Email",
  lifecycleStage: "Lifecycle stage",
  name: "Name",
};

function cleanTemplateName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function sampleInputKey(variable: TemplateVariable) {
  return variable.component === "BUTTON"
    ? `BUTTON_${variable.buttonIndex ?? 0}_${variable.key}`
    : `${variable.component}_${variable.key}`;
}

function normalizeCategory(value: string | undefined): TemplateCategory {
  return value === "UTILITY" ? "UTILITY" : "MARKETING";
}

function normalizeLanguage(value: string | undefined) {
  return languages.some((language) => language.value === value) ? value : "en_US";
}

export default function FlowTemplateForm({
  initialCategory,
  initialFlowId,
  initialLanguage,
  initialName,
}: FlowTemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(cleanTemplateName(initialName ?? ""));
  const [language, setLanguage] = useState(normalizeLanguage(initialLanguage));
  const [category, setCategory] = useState<TemplateCategory>(
    normalizeCategory(initialCategory),
  );
  const [body, setBody] = useState(
    "Hi {{1}},\n\nPlease complete the short form below so we can process your request.",
  );
  const [footer, setFooter] = useState("metawhat");
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState(initialFlowId ?? "");
  const [buttonText, setButtonText] = useState("Complete form");
  const [flowAction, setFlowAction] = useState<FlowAction>("NAVIGATE");
  const [navigateScreen, setNavigateScreen] = useState("");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({
    "1": "Satyam Jha",
    BODY_1: "Satyam Jha",
  });
  const [responseMappings, setResponseMappings] = useState<FlowResponseMapping[]>(
    [],
  );
  const [error, setError] = useState("");
  const [isLoadingFlows, setIsLoadingFlows] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch("/api/whatsapp-flows?usableOnly=true", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { flows?: FlowOption[] };

        if (!response.ok) {
          throw new Error("Unable to fetch WhatsApp flows");
        }

        if (mounted) {
          setFlows(
            (data.flows ?? []).filter(
              (flow) =>
                flow.isUsableForTemplates !== false &&
                !flow.remoteMissingAt &&
                Boolean(flow.metaFlowId),
            ),
          );
        }
      })
      .catch(() => {
        if (mounted) setError("Unable to load published WhatsApp Flows.");
      })
      .finally(() => {
        if (mounted) setIsLoadingFlows(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedFlow = useMemo(
    () => flows.find((flow) => flow.id === selectedFlowId) ?? null,
    [flows, selectedFlowId],
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

  function addResponseMapping() {
    setResponseMappings((current) => [
      ...current,
      {
        conflictPolicy: "OVERWRITE",
        id: crypto.randomUUID(),
        sourcePath: "",
        targetKey: "name",
        targetType: "CONTACT_FIELD",
        transform: "TRIM",
      },
    ]);
  }

  function updateResponseMapping(
    id: string | undefined,
    patch: Partial<FlowResponseMapping>,
  ) {
    setResponseMappings((current) =>
      current.map((mapping) =>
        mapping.id === id
          ? {
              ...mapping,
              ...patch,
              ...(patch.targetType === "CONTACT_FIELD"
                ? { targetKey: "name" }
                : {}),
              ...(patch.targetType === "CUSTOM_FIELD" ? { targetKey: "" } : {}),
            }
          : mapping,
      ),
    );
  }

  function removeResponseMapping(id: string | undefined) {
    setResponseMappings((current) =>
      current.filter((mapping) => mapping.id !== id),
    );
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
          flowAction,
          flowId: selectedFlow?.metaFlowId,
          navigateScreen: navigateScreen.trim() || undefined,
          text: buttonText.trim(),
          type: "FLOW",
        },
      ],
      type: "BUTTONS",
    });

    return {
      components,
      flow: {
        action: flowAction,
        buttonText: buttonText.trim(),
        localFlowId: selectedFlow?.id,
        metaFlowId: selectedFlow?.metaFlowId,
        navigateScreen: navigateScreen.trim() || null,
      },
      responseMappings: responseMappings.map((mapping) => ({
        conflictPolicy: mapping.conflictPolicy,
        sourcePath: mapping.sourcePath.trim(),
        targetKey: mapping.targetKey.trim(),
        targetType: mapping.targetType,
        transform: mapping.transform,
      })),
      templateType: "FLOWS",
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

    if (!selectedFlow) {
      setError("Select a published WhatsApp Flow.");
      return;
    }

    if (!selectedFlow.metaFlowId) {
      setError("Selected Flow is missing its Meta Flow ID.");
      return;
    }

    if (!buttonText.trim()) {
      setError("Flow button text is required.");
      return;
    }

    if (buttonText.trim().length > 25) {
      setError("Flow button text must be 25 characters or less.");
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

    const mappingIssues = validateFlowResponseMappings(responseMappings);
    if (mappingIssues.length > 0) {
      setError(mappingIssues[0]?.message ?? "Fix Flow response mappings.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/templates", {
        body: JSON.stringify({
          body,
          category,
          components: buildComponents(),
          language,
          name,
          templateType: "FLOWS",
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
      setError("Unable to create Flow template. Please try again.");
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
              Flow template details
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
                placeholder="lead_capture_flow"
                required
                value={name}
              />
              <p className={helperTextClass}>Lowercase letters, numbers, and underscores.</p>
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
              <select
                className={fieldClass}
                onChange={(event) =>
                  setCategory(event.target.value as TemplateCategory)
                }
                value={category}
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Message Content
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Message around the Flow CTA
            </h2>
          </div>
          <div className="space-y-5 p-5">
            <label className="block">
              <span className={labelClass}>Message Body</span>
              <textarea
                className={`${fieldClass} mt-2 min-h-40 resize-y leading-6`}
                maxLength={1024}
                onChange={(event) => setBody(event.target.value)}
                required
                value={body}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-bold text-[#128C7E] hover:bg-[#E7F8EF]"
                  onClick={addVariable}
                  type="button"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add variable
                </button>
                <span className="text-xs font-medium text-[#526173]">
                  {body.length} / 1024
                </span>
              </div>
            </label>

            <label className="block">
              <span className={labelClass}>Footer</span>
              <input
                className={`${fieldClass} mt-2`}
                maxLength={60}
                onChange={(event) => setFooter(event.target.value)}
                placeholder="metawhat"
                value={footer}
              />
              <p className={helperTextClass}>Optional. Keep it short.</p>
            </label>

            <div>
              <span className={labelClass}>Variable Samples</span>
              {variableMetadata.variables.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm text-[#526173]">
                  Add placeholders like {"{{1}}"} in the body to collect sample
                  values for Meta review.
                </div>
              ) : (
                <div className="mt-2 grid gap-3">
                  {variableMetadata.variables.map((variable) => {
                    const key = sampleInputKey(variable);

                    return (
                      <label
                        className="grid gap-2 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3 md:grid-cols-[150px_minmax(0,1fr)] md:items-center"
                        key={`${variable.component}-${variable.key}`}
                      >
                        <span className="text-sm font-bold text-[#081B3A]">
                          {variable.token}
                          <span className="mt-1 block text-xs font-medium text-[#526173]">
                            {variable.component.toLowerCase()}
                          </span>
                        </span>
                        <input
                          className={fieldClass}
                          onChange={(event) =>
                            updateSampleValue(variable, event.target.value)
                          }
                          placeholder="Satyam Jha"
                          value={sampleValues[key] ?? sampleValues[variable.key] ?? ""}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              WhatsApp Flow Selection
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Select a published Flow
            </h2>
          </div>
          <div className="space-y-4 p-5">
            {isLoadingFlows ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm font-semibold text-[#526173]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading published WhatsApp Flows...
              </div>
            ) : flows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-5">
                <p className="font-bold text-[#081B3A]">
                  No published WhatsApp Flows available.
                </p>
                <p className="mt-2 text-sm leading-6 text-[#526173]">
                  Create or sync a published Flow first, then return to this
                  builder.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    className={actionButtonClass("secondary")}
                    href="/dashboard/whatsapp/flows/new"
                  >
                    Create Flow
                  </Link>
                  <Link
                    className={actionButtonClass("secondary")}
                    href="/dashboard/whatsapp/flows"
                  >
                    View Flows
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {flows.map((flow) => {
                  const selected = flow.id === selectedFlowId;

                  return (
                    <button
                      className={[
                        "rounded-xl border p-4 text-left transition",
                        selected
                          ? "border-[#128C7E] bg-[#E7F8EF]"
                          : "border-[#BFE9D0] bg-[#F8FCFA] hover:border-[#128C7E]/50",
                      ].join(" ")}
                      key={flow.id}
                      onClick={() => {
                        setSelectedFlowId(flow.id);
                        setButtonText(flow.defaultCta || buttonText);
                        setNavigateScreen(flow.defaultScreen || "");
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#081B3A]">
                            {flow.name}
                          </p>
                          <p className="mt-1 truncate text-xs font-medium text-[#526173]">
                            Meta Flow ID: {flow.metaFlowId}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {flow.status}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-medium text-[#526173]">
                        Start screen: {flow.defaultScreen || "Default entry screen"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Flow Button Configuration
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              CTA behavior
            </h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Button text</span>
              <input
                className={fieldClass}
                maxLength={25}
                onChange={(event) => setButtonText(event.target.value)}
                placeholder="Complete form"
                required
                value={buttonText}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Flow action</span>
              <select
                className={fieldClass}
                onChange={(event) => setFlowAction(event.target.value as FlowAction)}
                value={flowAction}
              >
                <option value="NAVIGATE">Navigate</option>
                <option value="DATA_EXCHANGE">Data exchange</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Navigate screen</span>
              <input
                className={fieldClass}
                onChange={(event) => setNavigateScreen(event.target.value)}
                placeholder="LEAD_DETAILS"
                value={navigateScreen}
              />
              <p className={helperTextClass}>Optional when the Flow has a default entry screen.</p>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#BFE9D0] px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
                Response Mapping
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
                Save submitted Flow answers
              </h2>
            </div>
            <button
              className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-bold text-[#128C7E] hover:bg-[#E7F8EF]"
              onClick={addResponseMapping}
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add mapping
            </button>
          </div>
          <div className="space-y-3 p-5">
            {responseMappings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm leading-6 text-[#526173]">
                Optional. Add mappings when you want Flow answers like
                <span className="font-semibold text-[#081B3A]"> customer.name </span>
                or
                <span className="font-semibold text-[#081B3A]"> invoice.amount </span>
                saved back to the contact.
              </div>
            ) : (
              responseMappings.map((mapping, index) => (
                <div
                  className="grid gap-3 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4 lg:grid-cols-[minmax(0,1.2fr)_150px_minmax(0,1fr)_150px_170px_auto]"
                  key={mapping.id ?? index}
                >
                  <label className="block">
                    <span className={labelClass}>Source path</span>
                    <input
                      className={fieldClass}
                      onChange={(event) =>
                        updateResponseMapping(mapping.id, {
                          sourcePath: event.target.value,
                        })
                      }
                      placeholder="customer.name"
                      value={mapping.sourcePath}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Target type</span>
                    <select
                      className={fieldClass}
                      onChange={(event) =>
                        updateResponseMapping(mapping.id, {
                          targetType: event.target.value as FlowResponseTargetType,
                        })
                      }
                      value={mapping.targetType}
                    >
                      {FLOW_RESPONSE_TARGET_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type === "CONTACT_FIELD" ? "Contact" : "Custom"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>Target</span>
                    {mapping.targetType === "CONTACT_FIELD" ? (
                      <select
                        className={fieldClass}
                        onChange={(event) =>
                          updateResponseMapping(mapping.id, {
                            targetKey: event.target.value,
                          })
                        }
                        value={mapping.targetKey}
                      >
                        {FLOW_RESPONSE_CONTACT_FIELD_TARGETS.map((field) => (
                          <option key={field} value={field}>
                            {contactFieldLabels[field] ?? field}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={fieldClass}
                        onChange={(event) =>
                          updateResponseMapping(mapping.id, {
                            targetKey: event.target.value,
                          })
                        }
                        placeholder="lead_budget"
                        value={mapping.targetKey}
                      />
                    )}
                  </label>

                  <label className="block">
                    <span className={labelClass}>Transform</span>
                    <select
                      className={fieldClass}
                      onChange={(event) =>
                        updateResponseMapping(mapping.id, {
                          transform: event.target.value as FlowResponseTransform,
                        })
                      }
                      value={mapping.transform}
                    >
                      {FLOW_RESPONSE_TRANSFORMS.map((transform) => (
                        <option key={transform} value={transform}>
                          {transform.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>Conflict</span>
                    <select
                      className={fieldClass}
                      onChange={(event) =>
                        updateResponseMapping(mapping.id, {
                          conflictPolicy:
                            event.target.value as FlowResponseConflictPolicy,
                        })
                      }
                      value={mapping.conflictPolicy}
                    >
                      {FLOW_RESPONSE_CONFLICT_POLICIES.map((policy) => (
                        <option key={policy} value={policy}>
                          {policy.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50"
                      onClick={() => removeResponseMapping(mapping.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white shadow-[0_18px_48px_rgba(8,27,58,0.08)]">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Live WhatsApp Preview
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Flow CTA message
            </h2>
          </div>

          <div className="bg-[#ECE5DD] bg-[radial-gradient(circle_at_14px_14px,rgba(8,27,58,0.08)_1px,transparent_1.5px)] bg-[length:34px_34px] p-4">
            <div className="mx-auto mb-3 w-fit rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-[#526173] shadow-sm">
              Today
            </div>

            <div className="ml-auto max-w-[300px] rounded-lg bg-[#DCF8C6] p-3 text-sm text-[#081B3A] shadow-sm">
              <p className="whitespace-pre-wrap break-words leading-6">
                {renderPreview(body, sampleValues, { component: "BODY" })}
              </p>

              {footer.trim() ? (
                <p className="mt-3 border-t border-[#CFEABD] pt-2 text-xs text-[#526173]">
                  {footer}
                </p>
              ) : null}

              <div className="mt-2 flex items-center justify-center gap-2 border-t border-[#DCEFE4] pt-2 text-sm font-semibold text-[#128C7E]">
                <FormInput className="h-4 w-4" />
                <span className="truncate">{buttonText || "Complete form"}</span>
              </div>

              <div className="mt-2 flex justify-end gap-1 text-[11px] text-[#526173]">
                <span>10:12 PM</span>
                <span className="text-[#128C7E]">sent</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#BFE9D0] bg-white p-4">
          <div className="flex items-start gap-3">
            {selectedFlow ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#081B3A]">
                {selectedFlow ? selectedFlow.name : "No Flow selected"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#526173]">
                {selectedFlow
                  ? `Meta Flow ID: ${selectedFlow.metaFlowId}`
                  : "Select a published Flow before saving."}
              </p>
              {selectedFlow?.defaultScreen ? (
                <p className="mt-2 inline-flex rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-bold text-[#128C7E]">
                  Start screen: {selectedFlow.defaultScreen}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <button
          className={`${actionButtonClass()} mt-5 w-full rounded-xl py-4 text-base`}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isSubmitting ? "Saving draft..." : "Save Flow Template Draft"}
        </button>

        <p className="mt-3 flex items-center gap-2 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3 text-xs leading-5 text-[#526173]">
          <FileText className="h-4 w-4 shrink-0 text-[#128C7E]" />
          This saves a template draft only. It does not send messages or debit
          wallet balance.
        </p>
      </aside>
    </form>
  );
}
