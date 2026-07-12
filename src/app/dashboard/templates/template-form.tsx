"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  Image,
  LinkIcon,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  Send,
  Trash2,
  Type,
  UploadCloud,
  Video,
} from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import {
  BUTTON_TYPE_LABELS,
  MAX_TEMPLATE_BUTTONS,
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

type TemplateBuilderType =
  | ""
  | "STANDARD"
  | "CAROUSEL"
  | "PAYMENT"
  | "CATALOG"
  | "AUTHENTICATION"
  | "FLOWS"
  | "ORDER_STATUS"
  | "CALL_PERMISSION";
type TemplateCategory = "MARKETING" | "UTILITY";
type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

type TemplateButton = TemplateButtonDraft & {
  id: string;
  type: TemplateButtonType;
  text: string;
  url: string;
  phoneNumber: string;
  copyCode: string;
  flowId: string;
  navigateScreen: string;
  paymentConfigId: string;
};

type TemplateMediaAsset = {
  id: string;
  fileName: string;
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT";
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  metaHandle?: string | null;
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

type TemplateTypeOption = {
  autoCategoryLabel?: string;
  autoCategoryValue?: TemplateCategory;
  categoryMode: "SELECT" | "AUTO";
  description: string;
  enabled: boolean;
  label: string;
  route?: string;
  value: Exclude<TemplateBuilderType, "">;
};

const templateTypeOptions: TemplateTypeOption[] = [
  {
    categoryMode: "SELECT",
    description: "Normal marketing and utility messages with header, body, footer and buttons.",
    enabled: true,
    label: "Default",
    value: "STANDARD",
  },
  {
    autoCategoryLabel: "Marketing",
    autoCategoryValue: "MARKETING",
    categoryMode: "AUTO",
    description: "Nested card template with swipeable media cards.",
    enabled: true,
    label: "Carousel",
    route: "/dashboard/templates/new/carousel",
    value: "CAROUSEL",
  },
  {
    autoCategoryLabel: "Configured in the payment builder",
    categoryMode: "AUTO",
    description: "Payment and order detail templates need a dedicated payment setup.",
    enabled: false,
    label: "Order details (Payment)",
    value: "PAYMENT",
  },
  {
    autoCategoryLabel: "Marketing",
    autoCategoryValue: "MARKETING",
    categoryMode: "AUTO",
    description: "Catalog templates use a selected WhatsApp product catalog and a View catalog button.",
    enabled: true,
    label: "Catalog",
    route: "/dashboard/templates/new/catalog",
    value: "CATALOG",
  },
  {
    autoCategoryLabel: "Authentication",
    categoryMode: "AUTO",
    description: "OTP templates with copy code, one-tap, and zero-tap setup.",
    enabled: true,
    label: "Authentication",
    route: "/dashboard/templates/new/authentication",
    value: "AUTHENTICATION",
  },
  {
    categoryMode: "SELECT",
    description: "WhatsApp Flow templates will connect to published WhatsApp Flows.",
    enabled: true,
    label: "Flows",
    route: "/dashboard/templates/new/flow",
    value: "FLOWS",
  },
  {
    autoCategoryLabel: "Configured in the order-status builder",
    categoryMode: "AUTO",
    description: "Order status templates need commerce/order data mapping.",
    enabled: false,
    label: "Order Status",
    value: "ORDER_STATUS",
  },
  {
    autoCategoryLabel: "Configured in the call-permission builder",
    categoryMode: "AUTO",
    description: "Call permission request templates need call-permission business rules.",
    enabled: false,
    label: "Call Permission Request",
    value: "CALL_PERMISSION",
  },
];

const languages = [
  { label: "English (US)", value: "en_US" },
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
];

const headerTypes: Array<{
  label: string;
  value: HeaderType;
  icon: typeof Type;
}> = [
  { icon: MessageSquareText, label: "No header", value: "NONE" },
  { icon: Type, label: "Text", value: "TEXT" },
  { icon: Image, label: "Image", value: "IMAGE" },
  { icon: Video, label: "Video", value: "VIDEO" },
  { icon: FileText, label: "Document", value: "DOCUMENT" },
  { icon: MapPin, label: "Location", value: "LOCATION" },
];

const buttonTypeOptions: Array<{ label: string; value: TemplateButtonType }> = [
  { label: BUTTON_TYPE_LABELS.QUICK_REPLY, value: "QUICK_REPLY" },
  { label: BUTTON_TYPE_LABELS.URL, value: "URL" },
  { label: BUTTON_TYPE_LABELS.PHONE_NUMBER, value: "PHONE_NUMBER" },
  { label: BUTTON_TYPE_LABELS.COPY_CODE, value: "COPY_CODE" },
  { label: BUTTON_TYPE_LABELS.FLOW, value: "FLOW" },
  { label: BUTTON_TYPE_LABELS.VOICE_CALL, value: "VOICE_CALL" },
  { label: BUTTON_TYPE_LABELS.CATALOG, value: "CATALOG" },
  { label: BUTTON_TYPE_LABELS.PAYMENT, value: "PAYMENT" },
];

function cleanTemplateName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function newButton(): TemplateButton {
  return {
    copyCode: "",
    flowId: "",
    id: crypto.randomUUID(),
    navigateScreen: "",
    phoneNumber: "",
    paymentConfigId: "",
    text: "",
    type: "QUICK_REPLY",
    url: "",
  };
}

function isMediaHeaderType(
  headerType: HeaderType,
): headerType is TemplateMediaAsset["mediaType"] {
  return headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT";
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function buildComponents({
  body,
  buttons,
  footer,
  headerText,
  headerType,
  mediaAsset,
  sampleValues,
  variables,
}: {
  body: string;
  buttons: TemplateButton[];
  footer: string;
  headerText: string;
  headerType: HeaderType;
  mediaAsset: TemplateMediaAsset | null;
  sampleValues: Record<string, string>;
  variables: TemplateVariable[];
}) {
  const components: Array<Record<string, unknown>> = [];
  const headerExample = buildMetaExamples(variables, sampleValues, "HEADER");
  const bodyExample = buildMetaExamples(variables, sampleValues, "BODY");

  if (headerType === "TEXT" && headerText.trim()) {
    components.push({
      ...(headerExample ? { example: headerExample } : {}),
      format: "TEXT",
      text: headerText.trim(),
      type: "HEADER",
    });
  }

  if (isMediaHeaderType(headerType) && mediaAsset) {
    components.push({
      ...(mediaAsset.metaHandle
        ? { example: { header_handle: [mediaAsset.metaHandle] } }
        : {}),
      fileName: mediaAsset.fileName,
      format: headerType,
      mediaAssetId: mediaAsset.id,
      mediaUrl: mediaAsset.publicUrl,
      mimeType: mediaAsset.mimeType,
      publicUrl: mediaAsset.publicUrl,
      sizeBytes: mediaAsset.sizeBytes,
      metaHandle: mediaAsset.metaHandle,
      type: "HEADER",
    });
  }

  if (headerType === "LOCATION") {
    components.push({
      format: "LOCATION",
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

  const filledButtons = buttons
    .map((button) => buildMetaTemplateButton(button))
    .filter(Boolean);

  if (filledButtons.length > 0) {
    components.push({
      buttons: filledButtons,
      type: "BUTTONS",
    });
  }

  return {
    components,
    templateType: "STANDARD",
  };
}

function HeaderPreview({
  headerText,
  headerType,
  mediaAsset,
  sampleValues,
}: {
  headerText: string;
  headerType: HeaderType;
  mediaAsset: TemplateMediaAsset | null;
  sampleValues: Record<string, string>;
}) {
  if (headerType === "NONE") return null;

  if (headerType === "TEXT") {
    return headerText.trim() ? (
      <p className="mb-2 text-sm font-bold text-[#081B3A]">
        {renderPreview(headerText, sampleValues, { component: "HEADER" })}
      </p>
    ) : null;
  }

  if (headerType === "IMAGE" && mediaAsset?.publicUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={mediaAsset.fileName}
        className="mb-3 aspect-[1.92/1] w-full rounded-lg object-cover"
        src={mediaAsset.publicUrl}
      />
    );
  }

  if (headerType === "VIDEO" && mediaAsset?.publicUrl) {
    return (
      <video
        className="mb-3 aspect-[1.92/1] w-full rounded-lg bg-black object-cover"
        controls
        src={mediaAsset.publicUrl}
      />
    );
  }

  const Icon =
    headerType === "IMAGE"
      ? Image
      : headerType === "VIDEO"
        ? Video
        : headerType === "LOCATION"
          ? MapPin
          : FileText;

  return (
    <div className="mb-3 grid aspect-[1.92/1] place-items-center rounded-lg bg-[#E7F8EF] text-[#128C7E]">
      <div className="text-center">
        <Icon className="mx-auto h-8 w-8" />
        <p className="mt-2 text-xs font-semibold">
          {mediaAsset?.fileName ?? `${headerType} header`}
        </p>
      </div>
    </div>
  );
}

function ButtonPreview({ button }: { button: TemplateButtonDraft }) {
  const Icon =
    button.type === "URL"
      ? LinkIcon
      : button.type === "PHONE_NUMBER" || button.type === "VOICE_CALL"
        ? Phone
        : button.type === "COPY_CODE"
          ? Copy
          : MessageSquareText;

  return (
    <div className="mt-2 flex items-center justify-center gap-2 border-t border-[#DCEFE4] pt-2 text-sm font-semibold text-[#128C7E]">
      <Icon className="h-4 w-4" />
      <span className="truncate">{button.text || BUTTON_TYPE_LABELS[button.type]}</span>
    </div>
  );
}

export default function TemplateForm() {
  const router = useRouter();
  const [templateType, setTemplateType] = useState<TemplateBuilderType>("");
  const [category, setCategory] = useState<TemplateCategory | "">("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerMediaAsset, setHeaderMediaAsset] =
    useState<TemplateMediaAsset | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const variableMetadata = useMemo(
    () =>
      buildVariableMetadata({
        body,
        buttons,
        headerText: headerType === "TEXT" ? headerText : "",
        sampleValues,
      }),
    [body, buttons, headerText, headerType, sampleValues],
  );
  const buttonPreview = useMemo(
    () => splitButtonsForWhatsAppPreview(buttons),
    [buttons],
  );
  const selectedTemplateType = templateTypeOptions.find(
    (option) => option.value === templateType,
  );
  const isDefaultTemplate = templateType === "STANDARD";
  const canEditCommonConfiguration = Boolean(selectedTemplateType?.enabled);
  const hasValidCategory = Boolean(
    selectedTemplateType &&
      (selectedTemplateType.categoryMode === "AUTO" || category),
  );
  const hasValidCommonConfiguration = Boolean(
    selectedTemplateType?.enabled &&
      hasValidCategory &&
      name.trim() &&
      language,
  );
  const canConfigureDefaultTemplate = Boolean(
    isDefaultTemplate && category && name.trim() && language,
  );
  const canContinueToDedicatedBuilder = Boolean(
    selectedTemplateType?.route && hasValidCommonConfiguration,
  );

  function sampleInputKey(variable: TemplateVariable) {
    return variable.component === "BUTTON"
      ? `BUTTON_${variable.buttonIndex ?? 0}_${variable.key}`
      : `${variable.component}_${variable.key}`;
  }

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

  function addButton() {
    if (buttons.length >= MAX_TEMPLATE_BUTTONS) return;
    setButtons((current) => [...current, newButton()]);
  }

  function updateButton(buttonId: string, patch: Partial<TemplateButton>) {
    setButtons((current) =>
      current.map((button) =>
        button.id === buttonId ? { ...button, ...patch } : button,
      ),
    );
  }

  function removeButton(buttonId: string) {
    setButtons((current) => current.filter((button) => button.id !== buttonId));
  }

  function uploadHeaderMedia(file: File) {
    if (!isMediaHeaderType(headerType)) return;

    setUploadError("");
    setIsUploadingMedia(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mediaType", headerType);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/templates/media-assets");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      setIsUploadingMedia(false);

      try {
        const data = JSON.parse(request.responseText) as {
          asset?: TemplateMediaAsset;
          message?: string;
        };

        if (request.status < 200 || request.status >= 300 || !data.asset) {
          setUploadError(data.message ?? "Unable to upload template media.");
          return;
        }

        setHeaderMediaAsset(data.asset);
        setUploadProgress(100);
      } catch {
        setUploadError("Unable to read media upload response.");
      }
    };
    request.onerror = () => {
      setIsUploadingMedia(false);
      setUploadError("Media upload failed. Please try again.");
    };
    request.send(formData);
  }

  function handleTemplateTypeChange(nextType: TemplateBuilderType) {
    const nextConfig = templateTypeOptions.find(
      (option) => option.value === nextType,
    );

    setTemplateType(nextType);
    setCategory(nextConfig?.autoCategoryValue ?? "");
    setError("");
  }

  function openDedicatedBuilder() {
    if (
      !selectedTemplateType?.enabled ||
      !selectedTemplateType.route ||
      !canContinueToDedicatedBuilder
    ) {
      return;
    }

    const params = new URLSearchParams({
      category,
      language,
      name: cleanTemplateName(name).slice(0, 80),
    });

    router.push(`${selectedTemplateType.route}?${params.toString()}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isDefaultTemplate) {
      setError("Select Default template type to use this builder.");
      return;
    }

    if (!category) {
      setError("Template category is required.");
      return;
    }

    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    if (!body.trim()) {
      setError("Message body is required.");
      return;
    }

    if (headerType === "TEXT" && !headerText.trim()) {
      setError("Text header needs header text.");
      return;
    }

    if (isMediaHeaderType(headerType)) {
      if (!headerMediaAsset) {
        setError(`${headerType.toLowerCase()} header needs an uploaded media asset.`);
        return;
      }

      if (!headerMediaAsset.metaHandle) {
        setError(
          "This media uploaded locally but Meta did not return a review handle. Check META_APP_ID and WhatsApp access token, then upload again.",
        );
        return;
      }
    }

    const buttonIssues = validateTemplateButtons({
      buttons,
      templateCategory: category,
      templateType: "STANDARD",
    }).filter((issue) => issue.severity === "ERROR");

    if (buttonIssues.length > 0) {
      setError(buttonIssues[0]?.message ?? "Button configuration is invalid.");
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
          category,
          components: buildComponents({
            body,
            buttons,
            footer,
            mediaAsset: headerMediaAsset,
            headerText,
            headerType,
            sampleValues,
            variables: variableMetadata.variables,
          }),
          language,
          name,
          templateType: "STANDARD",
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
      setError("Unable to create template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={
        canConfigureDefaultTemplate
          ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
          : "grid gap-6"
      }
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Template Configuration
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              {selectedTemplateType?.label
                ? `${selectedTemplateType.label} template`
                : "Choose template type"}
            </h2>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Template Type</span>
              <select
                className={fieldClass}
                onChange={(event) =>
                  handleTemplateTypeChange(
                    event.target.value as TemplateBuilderType,
                  )
                }
                required
                value={templateType}
              >
                <option value="">Select template type</option>
                {templateTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                    {item.enabled ? "" : " - Coming soon"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Template Category</span>

              {!selectedTemplateType ? (
                <select className={fieldClass} disabled value="">
                  <option value="">Choose type first</option>
                </select>
              ) : selectedTemplateType.categoryMode === "SELECT" ? (
                <select
                  className={fieldClass}
                  onChange={(event) =>
                    setCategory(event.target.value as TemplateCategory | "")
                  }
                  required
                  value={category}
                >
                  <option value="">Select category</option>
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={`${fieldClass} bg-[#F8FCFA]`}
                  readOnly
                  value={
                    selectedTemplateType.enabled
                      ? selectedTemplateType.autoCategoryLabel ?? "Auto-selected"
                      : "Coming soon"
                  }
                />
              )}

              {selectedTemplateType?.categoryMode === "AUTO" &&
              selectedTemplateType.enabled ? (
                <p className={helperTextClass}>
                  Auto-selected for {selectedTemplateType.label} templates.
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={fieldClass}
                disabled={!canEditCommonConfiguration || !hasValidCategory}
                maxLength={80}
                onChange={(event) =>
                  setName(cleanTemplateName(event.target.value).slice(0, 80))
                }
                placeholder="payment_reminder"
                required={canEditCommonConfiguration}
                value={name}
              />
              <p className={helperTextClass}>
                {!selectedTemplateType
                  ? "Select a template type first."
                  : !selectedTemplateType.enabled
                    ? "This template type is not enabled yet."
                    : !hasValidCategory
                      ? "Select a template category first."
                      : "Lowercase letters, numbers, and underscores only."}
              </p>
            </label>

            <label className="block">
              <span className={labelClass}>Language</span>
              <select
                className={fieldClass}
                disabled={!canEditCommonConfiguration}
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
          </div>

          {selectedTemplateType && !isDefaultTemplate ? (
            <div className="border-t border-[#BFE9D0] bg-[#F8FCFA] p-5">
              <div className="rounded-xl border border-[#BFE9D0] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#081B3A]">
                      {selectedTemplateType.enabled
                        ? `${selectedTemplateType.label} uses a dedicated builder`
                        : `${selectedTemplateType.label} is coming soon`}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      {selectedTemplateType.description}
                    </p>
                  </div>

                  {!selectedTemplateType.enabled ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                      Coming soon
                    </span>
                  ) : null}
                </div>

                {selectedTemplateType.enabled && selectedTemplateType.route ? (
                  <button
                    className={`${actionButtonClass()} mt-4`}
                    disabled={!canContinueToDedicatedBuilder}
                    onClick={openDedicatedBuilder}
                    type="button"
                  >
                    Continue to {selectedTemplateType.label} Builder
                  </button>
                ) : selectedTemplateType.enabled ? (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    This template type is enabled but its dedicated builder route
                    is not configured yet.
                  </p>
                ) : (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    This template type is not enabled yet. Use Default,
                    Authentication, or Carousel for now.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {isDefaultTemplate && !canConfigureDefaultTemplate ? (
            <div className="border-t border-[#BFE9D0] bg-[#F8FCFA] p-5">
              <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-white p-5 text-sm text-[#526173]">
                Choose a category and enter the template name. After that, the
                header, body, variables, buttons, preview, and save options will
                open below.
              </div>
            </div>
          ) : null}
        </section>

        {canConfigureDefaultTemplate ? (
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Template Content
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Header, body, footer and buttons
            </h2>
          </div>

          <div className="space-y-6 p-5">
            <div>
              <span className={labelClass}>Header</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {headerTypes.map((item) => {
                  const Icon = item.icon;
                  const active = headerType === item.value;

                  return (
                    <button
                      className={[
                        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold transition",
                        active
                          ? "border-[#128C7E] bg-[#E7F8EF] text-[#075E54]"
                          : "border-[#BFE9D0] bg-white text-[#526173] hover:bg-[#F8FCFA]",
                      ].join(" ")}
                      key={item.value}
                      onClick={() => {
                        setHeaderType(item.value);
                        setUploadError("");
                        if (
                          !isMediaHeaderType(item.value) ||
                          headerMediaAsset?.mediaType !== item.value
                        ) {
                          setHeaderMediaAsset(null);
                          setUploadProgress(0);
                        }
                      }}
                      type="button"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {headerType === "TEXT" ? (
                <input
                  className={`${fieldClass} mt-3`}
                  maxLength={60}
                  onChange={(event) => setHeaderText(event.target.value)}
                  placeholder="Invoice reminder"
                  value={headerText}
                />
              ) : null}

              {isMediaHeaderType(headerType) ? (
                <div className="mt-3 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div>
                      <p className="text-sm font-bold text-[#081B3A]">
                        Upload {headerType.toLowerCase()} sample
                      </p>
                      <p className={helperTextClass}>
                        Use a public reusable asset. Local file paths and temporary
                        tunnel URLs are blocked.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-bold text-[#128C7E] hover:bg-[#E7F8EF]">
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {isUploadingMedia ? "Uploading..." : "Choose file"}
                      <input
                        accept={
                          headerType === "IMAGE"
                            ? "image/jpeg,image/png"
                            : headerType === "VIDEO"
                              ? "video/mp4,video/3gpp"
                              : ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf"
                        }
                        className="sr-only"
                        disabled={isUploadingMedia}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) uploadHeaderMedia(file);
                        }}
                        type="file"
                      />
                    </label>
                  </div>

                  {isUploadingMedia ? (
                    <div className="mt-4">
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-[#128C7E] transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#526173]">
                        {uploadProgress}% uploaded
                      </p>
                    </div>
                  ) : null}

                  {headerMediaAsset ? (
                    <div className="mt-4 rounded-lg border border-[#BFE9D0] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#081B3A]">
                            {headerMediaAsset.fileName}
                          </p>
                          <p className="mt-1 text-xs font-medium text-[#526173]">
                            {headerMediaAsset.mimeType} |{" "}
                            {formatBytes(headerMediaAsset.sizeBytes)}
                          </p>
                        </div>
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
                            headerMediaAsset.metaHandle
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700",
                          ].join(" ")}
                        >
                          {headerMediaAsset.metaHandle ? (
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          ) : (
                            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {headerMediaAsset.metaHandle
                            ? "Meta sample ready"
                            : "Meta handle missing"}
                        </span>
                      </div>

                      {headerType === "IMAGE" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={headerMediaAsset.fileName}
                          className="mt-3 aspect-[1.92/1] w-full rounded-lg object-cover"
                          src={headerMediaAsset.publicUrl}
                        />
                      ) : null}

                      {headerType === "VIDEO" ? (
                        <video
                          className="mt-3 aspect-[1.92/1] w-full rounded-lg bg-black object-cover"
                          controls
                          src={headerMediaAsset.publicUrl}
                        />
                      ) : null}

                      <button
                        className="mt-3 text-sm font-bold text-rose-600 hover:text-rose-700"
                        onClick={() => {
                          setHeaderMediaAsset(null);
                          setUploadProgress(0);
                        }}
                        type="button"
                      >
                        Remove media
                      </button>
                    </div>
                  ) : null}

                  {uploadError ? (
                    <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                      {uploadError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {headerType === "LOCATION" ? (
                <div className="mt-3 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm text-[#526173]">
                  Location headers are submitted as Meta location template
                  headers. The actual map location is supplied when sending the
                  approved template.
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className={labelClass}>Message Body</span>
              <textarea
                className={`${fieldClass} mt-2 min-h-44 resize-y leading-6`}
                maxLength={1024}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Hi {{1}}, your invoice {{2}} is due on {{3}}."
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
                placeholder="Reply STOP to opt out"
                value={footer}
              />
              <p className={helperTextClass}>Optional. Keep it short and neutral.</p>
            </label>

            <div>
              <span className={labelClass}>Variables</span>
              {variableMetadata.variables.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm text-[#526173]">
                  Add placeholders like {"{{1}}"} or {"{{customer_name}}"} in
                  the header, body, or URL buttons to collect sample values.
                </div>
              ) : (
                <div className="mt-2 grid gap-3">
                  {variableMetadata.variables.map((variable) => {
                    const key = sampleInputKey(variable);
                    return (
                      <label
                        className="grid gap-2 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3 md:grid-cols-[150px_minmax(0,1fr)] md:items-center"
                        key={`${variable.component}-${variable.buttonIndex ?? "x"}-${variable.key}`}
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
                          placeholder={
                            variable.key === "1"
                              ? "Satyam Jha"
                              : variable.key === "2"
                                ? "INV-2026-001"
                                : `Sample for ${variable.key}`
                          }
                          value={sampleValues[key] ?? sampleValues[variable.key] ?? ""}
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {variableMetadata.issues.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                  {variableMetadata.issues[0]?.message}
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className={labelClass}>Buttons</span>
                  <p className={helperTextClass}>
                    Optional. Add up to {MAX_TEMPLATE_BUTTONS} actions. WhatsApp
                    collapses actions after the first 3.
                  </p>
                </div>
                <button
                  className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-bold text-[#128C7E] hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={buttons.length >= MAX_TEMPLATE_BUTTONS}
                  onClick={addButton}
                  type="button"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add button
                </button>
              </div>

              {buttons.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm text-[#526173]">
                  No buttons added. This is fine for reminders, confirmations, and
                  simple utility updates.
                </div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {buttons.map((button, index) => (
                    <div
                      className="rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3"
                      key={button.id}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#081B3A]">
                          Button {index + 1}
                        </p>
                        <button
                          aria-label={`Remove button ${index + 1}`}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-rose-600 hover:bg-rose-50"
                          onClick={() => removeButton(button.id)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
                        <select
                          className={fieldClass}
                          onChange={(event) =>
                            updateButton(button.id, {
                              type: event.target.value as TemplateButtonType,
                            })
                          }
                          value={button.type}
                        >
                          {buttonTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className={fieldClass}
                          maxLength={25}
                          onChange={(event) =>
                            updateButton(button.id, { text: event.target.value })
                          }
                          placeholder={
                            button.type === "COPY_CODE"
                              ? "Copy code"
                              : button.type === "PAYMENT"
                                ? "Pay now"
                                : button.type === "CATALOG"
                                  ? "View catalog"
                                  : "Button text"
                          }
                          value={button.text}
                        />
                      </div>

                      {button.type === "URL" ? (
                        <input
                          className={`${fieldClass} mt-3`}
                          onChange={(event) =>
                            updateButton(button.id, { url: event.target.value })
                          }
                          placeholder="https://metawhat.in/pay"
                          value={button.url}
                        />
                      ) : null}

                      {button.type === "PHONE_NUMBER" ? (
                        <input
                          className={`${fieldClass} mt-3`}
                          onChange={(event) =>
                            updateButton(button.id, {
                              phoneNumber: event.target.value,
                            })
                          }
                          placeholder="+918810386013"
                          value={button.phoneNumber}
                        />
                      ) : null}

                      {button.type === "VOICE_CALL" ? (
                        <input
                          className={`${fieldClass} mt-3`}
                          onChange={(event) =>
                            updateButton(button.id, {
                              phoneNumber: event.target.value,
                            })
                          }
                          placeholder="+918810386013"
                          value={button.phoneNumber}
                        />
                      ) : null}

                      {button.type === "COPY_CODE" ? (
                        <input
                          className={`${fieldClass} mt-3`}
                          maxLength={15}
                          onChange={(event) =>
                            updateButton(button.id, {
                              copyCode: event.target.value,
                            })
                          }
                          placeholder="WELCOME10"
                          value={button.copyCode}
                        />
                      ) : null}

                      {button.type === "FLOW" ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input
                            className={fieldClass}
                            onChange={(event) =>
                              updateButton(button.id, {
                                flowId: event.target.value,
                              })
                            }
                            placeholder="Published Flow ID"
                            value={button.flowId}
                          />
                          <input
                            className={fieldClass}
                            onChange={(event) =>
                              updateButton(button.id, {
                                navigateScreen: event.target.value,
                              })
                            }
                            placeholder="Start screen (optional)"
                            value={button.navigateScreen}
                          />
                        </div>
                      ) : null}

                      {button.type === "PAYMENT" || button.type === "CATALOG" ? (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                          {button.type === "PAYMENT"
                            ? "Payment buttons are stored for payment templates and blocked on normal Default templates."
                            : "Catalog buttons are stored for catalog templates and blocked on normal Default templates."}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error ? (
              <p
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>
        </section>
        ) : null}
      </div>

      {canConfigureDefaultTemplate ? (
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white shadow-[0_18px_48px_rgba(8,27,58,0.08)]">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Live WhatsApp Preview
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Customer view
            </h2>
          </div>

          <div className="bg-[#ECE5DD] bg-[radial-gradient(circle_at_14px_14px,rgba(8,27,58,0.08)_1px,transparent_1.5px)] bg-[length:34px_34px] p-4">
            <div className="mx-auto mb-3 w-fit rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-[#526173] shadow-sm">
              Today
            </div>

            <div className="ml-auto max-w-[300px] rounded-lg bg-[#DCF8C6] p-3 text-sm text-[#081B3A] shadow-sm">
              <HeaderPreview
                headerText={headerText}
                headerType={headerType}
                mediaAsset={headerMediaAsset}
                sampleValues={sampleValues}
              />

              <p className="whitespace-pre-wrap break-words leading-6">
                {renderPreview(body, sampleValues, { component: "BODY" }) ||
                  "Your template message will appear here."}
              </p>

              {footer.trim() ? (
                <p className="mt-3 border-t border-[#CFEABD] pt-2 text-xs text-[#526173]">
                  {footer}
                </p>
              ) : null}

              {buttonPreview.visible.map((button, index) => (
                <ButtonPreview
                  button={button}
                  key={button.id ?? `${button.type}-${button.text}-${index}`}
                />
              ))}

              {buttonPreview.hidden.length > 0 ? (
                <div className="mt-2 border-t border-[#DCEFE4] pt-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#128C7E]">
                    <ChevronDown className="h-4 w-4" />
                    <span>See all options</span>
                  </div>
                  <div className="mt-2 rounded-lg bg-white/60 p-2">
                    {buttonPreview.hidden.map((button, index) => (
                      <div
                        className="flex items-center justify-between gap-2 py-1 text-xs font-semibold text-[#526173]"
                        key={button.id ?? `${button.type}-${button.text}-${index}`}
                      >
                        <span className="truncate">
                          {button.text || BUTTON_TYPE_LABELS[button.type]}
                        </span>
                        <span className="shrink-0 text-[#128C7E]">
                          {BUTTON_TYPE_LABELS[button.type]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-2 flex justify-end gap-1 text-[11px] text-[#526173]">
                <span>10:12 PM</span>
                <span className="text-[#128C7E]">sent</span>
              </div>
            </div>
          </div>
        </section>

        <button
          className={`${actionButtonClass()} mt-5 w-full rounded-xl py-4 text-base`}
          disabled={isSubmitting}
          type="submit"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? "Saving draft..." : "Save Draft"}
        </button>
      </aside>
      ) : null}
    </form>
  );
}
