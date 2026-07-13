"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  MessageSquareText,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import {
  BUTTON_TYPE_LABELS,
  buildMetaTemplateButton,
  splitButtonsForWhatsAppPreview,
  validateTemplateButtons,
  type TemplateButtonDraft,
  type TemplateButtonType,
} from "@/lib/whatsapp-template/template-button-rules";
import {
  buildMetaExamples,
  buildVariableMetadata,
  renderPreview,
  validateSampleValues,
  validateVariableSequence,
  type TemplateVariable,
} from "@/lib/whatsapp-template/template-variable-engine";
import {
  isAllowedOrderStatusTemplateField,
  ORDER_STATUS_CONTACT_FIELDS,
  ORDER_STATUS_ORDER_FIELDS,
  ORDER_STATUS_PURPOSE_DEFAULT_BODY,
  ORDER_STATUS_PURPOSE_LABELS,
  ORDER_STATUS_REQUIRED_FIELDS,
  ORDER_STATUS_SYSTEM_FIELDS,
  ORDER_STATUS_TEMPLATE_PURPOSES,
  ORDER_STATUS_VARIABLE_SOURCES,
  type OrderStatusTemplatePurpose,
  type OrderStatusVariableSource,
} from "@/lib/whatsapp-template/order-status-template";

type OrderStatusTemplateFormProps = {
  initialLanguage?: string;
  initialName?: string;
};

type TemplateButton = TemplateButtonDraft & {
  id: string;
  type: Extract<TemplateButtonType, "QUICK_REPLY" | "URL" | "PHONE_NUMBER">;
  text: string;
  url: string;
  phoneNumber: string;
};

type VariableMapping = {
  variable: string;
  source: OrderStatusVariableSource;
  field: string;
  sampleValue: string;
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

const buttonTypeOptions: Array<{ label: string; value: TemplateButton["type"] }> = [
  { label: BUTTON_TYPE_LABELS.URL, value: "URL" },
  { label: BUTTON_TYPE_LABELS.PHONE_NUMBER, value: "PHONE_NUMBER" },
  { label: BUTTON_TYPE_LABELS.QUICK_REPLY, value: "QUICK_REPLY" },
];

const fieldLabels: Record<string, string> = {
  cancelReason: "Cancellation reason",
  city: "City",
  companyName: "Company name",
  currency: "Currency",
  currentStatus: "Order status",
  email: "Email",
  expectedDeliveryDate: "Expected delivery date",
  itemCount: "Item count",
  name: "Customer name",
  notes: "Order notes",
  orderDate: "Order date",
  orderNumber: "Order number",
  phoneNumber: "Phone number",
  shippingProvider: "Shipping provider",
  supportEmail: "Support email",
  supportPhone: "Support phone",
  today: "Today",
  totalAmount: "Order total",
  trackingNumber: "Tracking number",
  trackingUrl: "Tracking URL",
};

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

function newButton(type: TemplateButton["type"] = "URL"): TemplateButton {
  return {
    id: crypto.randomUUID(),
    phoneNumber: "",
    text: type === "URL" ? "Track Order" : type === "PHONE_NUMBER" ? "Call Support" : "View Order",
    type,
    url: type === "URL" ? "https://metawhat.in/orders/{{1}}" : "",
  };
}

function fieldsForSource(source: OrderStatusVariableSource) {
  if (source === "CONTACT_FIELD") return ORDER_STATUS_CONTACT_FIELDS;
  if (source === "ORDER_FIELD") return ORDER_STATUS_ORDER_FIELDS;
  if (source === "SYSTEM_VALUE") return ORDER_STATUS_SYSTEM_FIELDS;
  return [] as readonly string[];
}

function defaultFieldForVariable(variable: string) {
  if (variable === "1") return { field: "name", source: "CONTACT_FIELD" as const };
  if (variable === "2") return { field: "orderNumber", source: "ORDER_FIELD" as const };
  if (variable === "3") return { field: "trackingNumber", source: "ORDER_FIELD" as const };
  if (variable === "4") {
    return { field: "expectedDeliveryDate", source: "ORDER_FIELD" as const };
  }

  return { field: "notes", source: "ORDER_FIELD" as const };
}

function defaultSampleForField(field: string, fallback: string) {
  const samples: Record<string, string> = {
    cancelReason: "Customer requested cancellation",
    companyName: "MetaWhat",
    currency: "INR",
    currentStatus: "Shipped",
    expectedDeliveryDate: "15 Jul 2026",
    itemCount: "3",
    name: "Satyam Jha",
    notes: "Please keep your phone available",
    orderDate: "13 Jul 2026",
    orderNumber: "ORD-2026-104",
    shippingProvider: "Delhivery",
    supportPhone: "+918810386013",
    today: "13 Jul 2026",
    totalAmount: "INR 2,997",
    trackingNumber: "TRK-88321",
    trackingUrl: "https://metawhat.in/track/TRK-88321",
  };

  return samples[field] ?? fallback;
}

function syncMappingsWithVariables(
  variables: TemplateVariable[],
  currentMappings: VariableMapping[],
) {
  const bodyVariables = variables.filter((variable) => variable.component === "BODY");

  return bodyVariables.map((variable) => {
    const existing = currentMappings.find((mapping) => mapping.variable === variable.key);
    if (existing) return existing;

    const suggested = defaultFieldForVariable(variable.key);

    return {
      field: suggested.field,
      sampleValue: defaultSampleForField(suggested.field, `Sample ${variable.key}`),
      source: suggested.source,
      variable: variable.key,
    };
  });
}

export default function OrderStatusTemplateForm({
  initialLanguage,
  initialName,
}: OrderStatusTemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(cleanTemplateName(initialName ?? ""));
  const [language, setLanguage] = useState(normalizeLanguage(initialLanguage));
  const [purpose, setPurpose] =
    useState<OrderStatusTemplatePurpose>("ORDER_SHIPPED");
  const [headerText, setHeaderText] = useState("Order update");
  const [body, setBody] = useState(ORDER_STATUS_PURPOSE_DEFAULT_BODY.ORDER_SHIPPED);
  const [footer, setFooter] = useState("metawhat");
  const [buttons, setButtons] = useState<TemplateButton[]>([newButton("URL")]);
  const [mappings, setMappings] = useState<VariableMapping[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const variableMetadata = useMemo(() => {
    const sampleValues = Object.fromEntries(
      mappings.flatMap((mapping) => [
        [mapping.variable, mapping.sampleValue],
        [`BODY_${mapping.variable}`, mapping.sampleValue],
      ]),
    );

    return buildVariableMetadata({ body, sampleValues });
  }, [body, mappings]);

  const syncedMappings = useMemo(
    () => syncMappingsWithVariables(variableMetadata.variables, mappings),
    [variableMetadata.variables, mappings],
  );

  const previewSamples = useMemo(
    () =>
      Object.fromEntries(
        syncedMappings.flatMap((mapping) => [
          [mapping.variable, mapping.sampleValue],
          [`BODY_${mapping.variable}`, mapping.sampleValue],
        ]),
      ),
    [syncedMappings],
  );

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const bodyVariables = variableMetadata.variables.filter(
      (variable) => variable.component === "BODY",
    );

    validateVariableSequence(bodyVariables).forEach((issue) =>
      issues.push(issue.message),
    );
    validateSampleValues(bodyVariables, previewSamples).forEach((issue) =>
      issues.push(issue.message),
    );

    syncedMappings.forEach((mapping) => {
      if (!isAllowedOrderStatusTemplateField(mapping.source, mapping.field)) {
        issues.push(`Field ${mapping.field} is not allowed for ${mapping.source}.`);
      }
    });

    const mappedFields = new Set(
      syncedMappings
        .filter((mapping) => mapping.source === "ORDER_FIELD")
        .map((mapping) => mapping.field),
    );

    ORDER_STATUS_REQUIRED_FIELDS[purpose].forEach((field) => {
      if (!mappedFields.has(field)) {
        issues.push(`${fieldLabels[field] ?? field} mapping is required.`);
      }
    });

    validateTemplateButtons({
      buttons,
      templateCategory: "UTILITY",
      templateType: "ORDER_STATUS",
    })
      .filter((issue) => issue.severity === "ERROR")
      .forEach((issue) => issues.push(issue.message));

    return issues;
  }, [buttons, previewSamples, purpose, syncedMappings, variableMetadata.variables]);

  function updatePurpose(nextPurpose: OrderStatusTemplatePurpose) {
    setPurpose(nextPurpose);
    setBody(ORDER_STATUS_PURPOSE_DEFAULT_BODY[nextPurpose]);
    setMappings([]);
  }

  function updateMapping(
    variable: string,
    patch: Partial<Omit<VariableMapping, "variable">>,
  ) {
    setMappings((current) => {
      const next = syncMappingsWithVariables(variableMetadata.variables, current);

      return next.map((mapping) => {
        if (mapping.variable !== variable) return mapping;
        const updated = { ...mapping, ...patch };

        if (patch.field && !patch.sampleValue) {
          updated.sampleValue = defaultSampleForField(patch.field, updated.sampleValue);
        }

        if (patch.source) {
          const fields = fieldsForSource(patch.source);
          updated.field =
            fields.length > 0 ? fields[0] ?? updated.field : updated.field;
        }

        return updated;
      });
    });
  }

  function addVariable() {
    const nextIndex =
      Math.max(
        0,
        ...variableMetadata.variables
          .filter((variable) => variable.numeric)
          .map((variable) => variable.index),
      ) + 1;

    setBody((current) => `${current}${current ? " " : ""}{{${nextIndex}}}`);
  }

  function updateSampleValue(variable: TemplateVariable, value: string) {
    updateMapping(variable.key, { sampleValue: value });
  }

  function updateButton(id: string, patch: Partial<TemplateButton>) {
    setButtons((current) =>
      current.map((button) =>
        button.id === id
          ? {
              ...button,
              ...patch,
            }
          : button,
      ),
    );
  }

  function buildComponents() {
    const bodyExample = buildMetaExamples(
      variableMetadata.variables,
      previewSamples,
      "BODY",
    );
    const components: Array<Record<string, unknown>> = [];

    if (headerText.trim()) {
      components.push({
        format: "TEXT",
        text: headerText.trim(),
        type: "HEADER",
      });
    }

    components.push({
      ...(bodyExample ? { example: bodyExample } : {}),
      text: body.trim(),
      type: "BODY",
    });

    if (footer.trim()) {
      components.push({
        text: footer.trim(),
        type: "FOOTER",
      });
    }

    const builtButtons = buttons
      .map((button) => buildMetaTemplateButton(button))
      .filter(Boolean);

    if (builtButtons.length > 0) {
      components.push({
        buttons: builtButtons,
        type: "BUTTONS",
      });
    }

    return {
      components,
      orderStatus: {
        purpose,
        variableMappings: syncedMappings.map((mapping) => ({
          field: mapping.field,
          sampleValue: mapping.sampleValue,
          source: mapping.source,
          variable: mapping.variable,
        })),
      },
      templateType: "ORDER_STATUS",
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanedName = cleanTemplateName(name);
    if (!cleanedName) {
      setError("Template name is required.");
      return;
    }

    if (validationIssues.length > 0) {
      setError(validationIssues[0] ?? "Fix validation errors before saving.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/templates", {
        body: JSON.stringify({
          body,
          category: "UTILITY",
          components: buildComponents(),
          language,
          name: cleanedName,
          templateType: "ORDER_STATUS",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as CreateTemplateResponse;

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ||
          data.errors?.body?.[0] ||
          data.errors?.components?.[0] ||
          data.message;
        throw new Error(firstError || "Unable to save order status template");
      }

      router.push("/dashboard/templates");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save order status template",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const buttonPreview = splitButtonsForWhatsAppPreview(buttons);
  const previewBody = renderPreview(body, previewSamples);

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <h2 className="text-lg font-bold text-[#081B3A]">
            Template configuration
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>Template name</span>
              <input
                className={fieldClass}
                onChange={(event) => setName(cleanTemplateName(event.target.value))}
                placeholder="order_shipped_update"
                value={name}
              />
            </label>

            <label>
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

            <label>
              <span className={labelClass}>Category</span>
              <input className={fieldClass} readOnly value="Utility" />
              <span className={helperTextClass}>
                Order updates are transactional messages.
              </span>
            </label>

            <label>
              <span className={labelClass}>Order status purpose</span>
              <select
                className={fieldClass}
                onChange={(event) =>
                  updatePurpose(event.target.value as OrderStatusTemplatePurpose)
                }
                value={purpose}
              >
                {ORDER_STATUS_TEMPLATE_PURPOSES.map((item) => (
                  <option key={item} value={item}>
                    {ORDER_STATUS_PURPOSE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#081B3A]">
                Message content
              </h2>
              <p className={helperTextClass}>
                Use variables like {"{{1}}"} and map them to approved order fields below.
              </p>
            </div>
            <button
              className={actionButtonClass("secondary")}
              onClick={addVariable}
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Variable
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <label>
              <span className={labelClass}>Header</span>
              <input
                className={fieldClass}
                onChange={(event) => setHeaderText(event.target.value)}
                placeholder="Order update"
                value={headerText}
              />
            </label>

            <label>
              <span className={labelClass}>Body</span>
              <textarea
                className={`${fieldClass} min-h-[220px]`}
                onChange={(event) => setBody(event.target.value)}
                value={body}
              />
            </label>

            <label>
              <span className={labelClass}>Footer</span>
              <input
                className={fieldClass}
                onChange={(event) => setFooter(event.target.value)}
                placeholder="metawhat"
                value={footer}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <h2 className="text-lg font-bold text-[#081B3A]">Variable mapping</h2>
          <div className="mt-4 space-y-3">
            {syncedMappings.length === 0 ? (
              <p className="text-sm text-[#526173]">
                Add body variables to configure order field mapping.
              </p>
            ) : (
              syncedMappings.map((mapping) => {
                const fields = fieldsForSource(mapping.source);

                return (
                  <div
                    key={mapping.variable}
                    className="grid gap-3 rounded-xl border border-[#E7F8EF] p-3 lg:grid-cols-[100px_160px_1fr_1fr]"
                  >
                    <div className="text-sm font-semibold text-[#081B3A]">
                      {"{{"}
                      {mapping.variable}
                      {"}}"}
                    </div>
                    <select
                      className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                      onChange={(event) =>
                        updateMapping(mapping.variable, {
                          source: event.target.value as OrderStatusVariableSource,
                        })
                      }
                      value={mapping.source}
                    >
                      {ORDER_STATUS_VARIABLE_SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {source.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>

                    {fields.length > 0 ? (
                      <select
                        className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                        onChange={(event) =>
                          updateMapping(mapping.variable, {
                            field: event.target.value,
                          })
                        }
                        value={mapping.field}
                      >
                        {fields.map((field) => (
                          <option key={field} value={field}>
                            {fieldLabels[field] ?? field}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                        onChange={(event) =>
                          updateMapping(mapping.variable, {
                            field: event.target.value,
                          })
                        }
                        placeholder={
                          mapping.source === "STATIC_VALUE"
                            ? "Static label"
                            : "Custom field key"
                        }
                        value={mapping.field}
                      />
                    )}

                    <input
                      className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                      onChange={(event) =>
                        updateSampleValue(
                          {
                            component: "BODY",
                            index: Number(mapping.variable),
                            key: mapping.variable,
                            numeric: true,
                            token: `{{${mapping.variable}}}`,
                          },
                          event.target.value,
                        )
                      }
                      placeholder="Sample value"
                      value={mapping.sampleValue}
                    />
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#081B3A]">Buttons</h2>
              <p className={helperTextClass}>
                Use website, phone, or quick reply buttons for order updates.
              </p>
            </div>
            <button
              className={actionButtonClass("secondary")}
              onClick={() => setButtons((current) => [...current, newButton()])}
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Button
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {buttons.map((button) => (
              <div
                className="grid gap-3 rounded-xl border border-[#E7F8EF] p-3 lg:grid-cols-[150px_1fr_1fr_auto]"
                key={button.id}
              >
                <select
                  className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                  onChange={(event) =>
                    updateButton(button.id, {
                      type: event.target.value as TemplateButton["type"],
                    })
                  }
                  value={button.type}
                >
                  {buttonTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                  onChange={(event) =>
                    updateButton(button.id, { text: event.target.value })
                  }
                  placeholder="Button text"
                  value={button.text}
                />
                {button.type === "URL" ? (
                  <input
                    className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                    onChange={(event) =>
                      updateButton(button.id, { url: event.target.value })
                    }
                    placeholder="https://example.com/track/{{1}}"
                    value={button.url}
                  />
                ) : button.type === "PHONE_NUMBER" ? (
                  <input
                    className="h-10 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                    onChange={(event) =>
                      updateButton(button.id, { phoneNumber: event.target.value })
                    }
                    placeholder="+918810386013"
                    value={button.phoneNumber}
                  />
                ) : (
                  <div />
                )}
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-600"
                  onClick={() =>
                    setButtons((current) =>
                      current.filter((item) => item.id !== button.id),
                    )
                  }
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <h2 className="text-lg font-bold text-[#081B3A]">Validation</h2>
          <div className="mt-4 space-y-2">
            {validationIssues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Ready to save as draft
              </div>
            ) : (
              validationIssues.map((issue) => (
                <div
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  key={issue}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {issue}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#128C7E]" />
            <h2 className="text-lg font-bold text-[#081B3A]">
              WhatsApp Preview
            </h2>
          </div>
          <div className="mt-5 rounded-[2rem] border border-[#BFE9D0] bg-[#E7F8EF] p-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              {headerText.trim() ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-[#E7F8EF] p-3 text-sm font-semibold text-[#081B3A]">
                  <MessageSquareText className="h-4 w-4 text-[#128C7E]" />
                  {headerText}
                </div>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-6 text-[#081B3A]">
                {previewBody}
              </p>
              {footer.trim() ? (
                <p className="mt-3 text-xs text-[#526173]">{footer}</p>
              ) : null}
              {buttonPreview.visible.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {buttonPreview.visible.map((button, index) => (
                    <div
                      className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-center text-sm font-semibold text-[#128C7E]"
                      key={`${button.text}-${index}`}
                    >
                      {button.text || BUTTON_TYPE_LABELS[button.type]}
                    </div>
                  ))}
                  {buttonPreview.hidden.length > 0 ? (
                    <div className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-center text-sm font-semibold text-[#128C7E]">
                      See all options
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            className={`${actionButtonClass("primary")} mt-5 w-full`}
            disabled={isSubmitting}
            type="submit"
          >
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Draft"}
          </button>
        </section>
      </aside>
    </form>
  );
}
