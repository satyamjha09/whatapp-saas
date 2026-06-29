"use client";

import {
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  FileUp,
  GripVertical,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import WhatsAppMessagePreview from "../whatsapp-message-preview";

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  body: string;
  variables: string[];
};

type Contact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
};

type SendResponse = {
  message?: string;
  result?: { messageId: string; contactId: string };
  errors?: Partial<
    Record<
      | "phoneNumber"
      | "countryCode"
      | "name"
      | "templateId"
      | "bodyParameters"
      | "messageType"
      | "media"
      | "location"
      | "interactive",
      string[]
    >
  >;
};

const MESSAGE_TYPES = [
  "Template",
  "Text",
  "Media",
  "Interactive",
  "Payment",
  "Catalog",
  "Location",
] as const;

const MEDIA_TYPES = ["Image", "Document", "Video", "Audio"] as const;
const INTERACTION_TYPES = [
  "List Button",
  "Reply Button",
  "CTA Button",
  "Call Permission Request",
  "Location Request",
  "Address Request",
  "Flow",
] as const;

type MessageType = (typeof MESSAGE_TYPES)[number];
type MediaType = (typeof MEDIA_TYPES)[number];
type InteractionType = (typeof INTERACTION_TYPES)[number];

type SelectedMedia = {
  name: string;
  url?: string;
  file?: File;
  createdAt: string;
};

type InteractiveSection = {
  id: string;
  title: string;
  rows: { id: string; title: string; description: string }[];
};

function formatDateTimeInput(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseCoordinate(value: string) {
  const coordinate = Number(value.trim());

  return Number.isFinite(coordinate) ? coordinate : null;
}

export default function SingleTemplateMessageForm({
  contacts,
  templates,
}: {
  contacts: Contact[];
  templates: Template[];
}) {
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [bodyParameters, setBodyParameters] = useState<string[]>(
    templates[0]?.variables.map(() => "") ?? [],
  );
  const [messageType, setMessageType] = useState<MessageType>("Template");
  const [textBody, setTextBody] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("Image");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [interactionType, setInteractionType] =
    useState<InteractionType>("List Button");
  const [interactiveListButtonText, setInteractiveListButtonText] =
    useState("");
  const [interactiveHeader, setInteractiveHeader] = useState("");
  const [interactiveBody, setInteractiveBody] = useState("");
  const [interactiveFooter, setInteractiveFooter] = useState("");
  const [interactiveButtons, setInteractiveButtons] = useState([""]);
  const [interactiveCtaText, setInteractiveCtaText] = useState("");
  const [interactiveCtaUrl, setInteractiveCtaUrl] = useState("");
  const [interactiveFlowId, setInteractiveFlowId] = useState("");
  const [interactiveFlowAction, setInteractiveFlowAction] = useState("");
  const [interactiveFlowScreen, setInteractiveFlowScreen] = useState("");
  const [interactiveSections, setInteractiveSections] = useState<
    InteractiveSection[]
  >([
    {
      id: "section-1",
      title: "",
      rows: [{ id: "row-1", title: "", description: "" }],
    },
  ]);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLatitude, setLocationLatitude] = useState("");
  const [locationLongitude, setLocationLongitude] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [minimumScheduleAt, setMinimumScheduleAt] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [messageId, setMessageId] = useState("");
  const [isSending, setIsSending] = useState(false);

  const selectedTemplate = templates.find(
    (template) => template.id === templateId,
  );

  function getMinimumScheduleAt() {
    return formatDateTimeInput(new Date(Date.now() + 60_000));
  }

  const parsedLatitude = parseCoordinate(locationLatitude);
  const parsedLongitude = parseCoordinate(locationLongitude);
  const hasValidLocationCoordinates =
    parsedLatitude !== null &&
    parsedLongitude !== null &&
    parsedLatitude >= -90 &&
    parsedLatitude <= 90 &&
    parsedLongitude >= -180 &&
    parsedLongitude <= 180;
  const googleMapsUrl = hasValidLocationCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${parsedLatitude},${parsedLongitude}`
    : "";
  const googleMapsEmbedUrl = hasValidLocationCoordinates
    ? `https://maps.google.com/maps?q=${parsedLatitude},${parsedLongitude}&z=15&output=embed`
    : "";

  function getLocationValidationError() {
    if (messageType !== "Location") return "";

    if (!locationName.trim()) return "Location name is required.";
    if (!locationAddress.trim()) return "Location address is required.";
    if (!locationLatitude.trim()) return "Latitude is required.";
    if (!locationLongitude.trim()) return "Longitude is required.";
    if (parsedLatitude === null || parsedLatitude < -90 || parsedLatitude > 90) {
      return "Latitude must be a number between -90 and 90.";
    }
    if (
      parsedLongitude === null ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      return "Longitude must be a number between -180 and 180.";
    }

    return "";
  }

  function getInteractiveValidationError() {
    if (messageType !== "Interactive") return "";

    if (interactionType === "List Button") {
      if (!interactiveListButtonText.trim()) return "List button text is required.";
      if (!interactiveBody.trim()) return "Interactive body is required.";
      const hasRow = interactiveSections.some((section) =>
        section.rows.some((row) => row.title.trim()),
      );
      if (!hasRow) return "Add at least one row title.";
    }

    if (interactionType === "Reply Button") {
      if (!interactiveBody.trim()) return "Interactive body is required.";
      if (!interactiveButtons.some((button) => button.trim())) {
        return "Add at least one reply button.";
      }
    }

    if (interactionType === "CTA Button") {
      if (!interactiveBody.trim()) return "Interactive body is required.";
      if (!interactiveCtaText.trim()) return "CTA button text is required.";
      try {
        new URL(interactiveCtaUrl);
      } catch {
        return "CTA button URL must be valid.";
      }
    }

    if (
      ["Call Permission Request", "Location Request", "Address Request"].includes(
        interactionType,
      ) &&
      !interactiveBody.trim()
    ) {
      return "Interactive body is required.";
    }

    if (interactionType === "Flow") {
      if (!interactiveFlowId.trim()) return "Select a flow.";
      if (!interactiveHeader.trim()) return "Flow header is required.";
      if (!interactiveBody.trim()) return "Flow body is required.";
      if (!interactiveCtaText.trim()) return "Flow CTA text is required.";
      if (!interactiveFlowAction.trim()) return "Flow action is required.";
      if (!interactiveFlowScreen.trim()) return "Flow screen is required.";
    }

    return "";
  }

  function addInteractiveSection() {
    setInteractiveSections((current) => [
      ...current,
      {
        id: `section-${current.length + 1}`,
        title: "",
        rows: [{ id: `section-${current.length + 1}-row-1`, title: "", description: "" }],
      },
    ]);
  }

  function updateInteractiveSection(
    sectionId: string,
    value: Partial<InteractiveSection>,
  ) {
    setInteractiveSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, ...value } : section,
      ),
    );
  }

  function updateInteractiveRow(
    sectionId: string,
    rowId: string,
    value: Partial<InteractiveSection["rows"][number]>,
  ) {
    setInteractiveSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              rows: section.rows.map((row) =>
                row.id === rowId ? { ...row, ...value } : row,
              ),
            }
          : section,
      ),
    );
  }

  function addInteractiveRow(sectionId: string) {
    setInteractiveSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              rows: [
                ...section.rows,
                {
                  id: `${section.id}-row-${section.rows.length + 1}`,
                  title: "",
                  description: "",
                },
              ],
            }
          : section,
      ),
    );
  }

  function chooseContact(nextContactId: string) {
    setContactId(nextContactId);
    const contact = contacts.find((item) => item.id === nextContactId);

    if (!contact) {
      setName("");
      setCountryCode("91");
      setPhoneNumber("");
      return;
    }

    setName(contact.name ?? "");
    setCountryCode(contact.countryCode);
    setPhoneNumber(contact.phoneNumber);
  }

  function chooseTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    setBodyParameters(template?.variables.map(() => "") ?? []);
  }

  function updateParameter(index: number, value: string) {
    setBodyParameters((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  function chooseMediaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedMedia({
      name: file.name,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      file,
      createdAt: new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    });
    setExternalUrl("");
    setIsUploadOpen(false);
    event.target.value = "";
  }

  function useExternalUrl() {
    const trimmedUrl = externalUrl.trim();

    if (!trimmedUrl) return;

    setSelectedMedia({
      name: trimmedUrl.split("/").pop() || `${mediaType.toLowerCase()} file`,
      url: trimmedUrl,
      createdAt: new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    });
    setIsUploadOpen(false);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setMessageId("");

    if (messageType === "Location") {
      const locationError = getLocationValidationError();

      if (locationError) {
        setError(locationError);
        return;
      }
    }

    if (messageType === "Interactive") {
      const interactiveError = getInteractiveValidationError();

      if (interactiveError) {
        setError(interactiveError);
        return;
      }
    }

    if (messageType === "Text" && !textBody.trim()) {
      setError("Text message body is required.");
      return;
    }

    if (isScheduled) {
      if (!scheduledAt) {
        setError("Choose a schedule date and time before scheduling.");
        return;
      }

      const scheduledDate = new Date(scheduledAt);

      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        setError("Schedule time must be in the future.");
        return;
      }

      setSuccess(
        `Schedule form is ready for ${scheduledDate.toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}. Backend scheduler storage/worker is the next step.`,
      );
      return;
    }

    if (["Payment", "Catalog"].includes(messageType)) {
      setSuccess(
        `${messageType} message draft is ready. Backend sending for this type needs its Meta payload next.`,
      );
      return;
    }

    if (messageType === "Media") {
      if (!selectedMedia?.file && !selectedMedia?.url) {
        setError("Upload a media file or use a public media URL before sending.");
        return;
      }
    }

    setIsSending(true);

    try {
      const response =
        messageType === "Media" && selectedMedia?.file
          ? await fetch("/api/messages/single-template", {
              method: "POST",
              body: (() => {
                const formData = new FormData();
                formData.append("messageType", messageType);
                formData.append("countryCode", countryCode);
                formData.append("phoneNumber", phoneNumber);
                if (name.trim()) formData.append("name", name.trim());
                formData.append("mediaType", mediaType.toUpperCase());
                formData.append("mediaName", selectedMedia.name);
                if (mediaCaption.trim()) {
                  formData.append("mediaCaption", mediaCaption.trim());
                }
                formData.append("mediaFile", selectedMedia.file);
                return formData;
              })(),
            })
          : await fetch("/api/messages/single-template", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                messageType === "Media"
                  ? {
                      messageType,
                      countryCode,
                      phoneNumber,
                      name: name.trim() || undefined,
                      media: {
                        type: mediaType.toUpperCase(),
                        url: selectedMedia!.url,
                        name: selectedMedia!.name,
                        caption: mediaCaption.trim() || undefined,
                      },
                    }
                  : messageType === "Location"
                    ? {
                        messageType,
                        countryCode,
                        phoneNumber,
                        name: name.trim() || undefined,
                        location: {
                          name: locationName.trim(),
                          address: locationAddress.trim(),
                          latitude: parsedLatitude,
                          longitude: parsedLongitude,
                        },
                      }
                  : messageType === "Interactive"
                      ? {
                          messageType,
                          countryCode,
                          phoneNumber,
                          name: name.trim() || undefined,
                          interactive: {
                            type: interactionType,
                            header: interactiveHeader.trim() || undefined,
                            body: interactiveBody.trim(),
                            footer: interactiveFooter.trim() || undefined,
                            primaryButton:
                              interactionType === "List Button"
                                ? interactiveListButtonText.trim()
                                : interactionType === "CTA Button" ||
                                    interactionType === "Flow"
                                  ? interactiveCtaText.trim()
                                  : undefined,
                            buttons:
                              interactionType === "Reply Button"
                                ? interactiveButtons
                                    .map((button) => button.trim())
                                    .filter(Boolean)
                                : undefined,
                            ctaUrl:
                              interactionType === "CTA Button"
                                ? interactiveCtaUrl.trim()
                                : undefined,
                            flowId:
                              interactionType === "Flow"
                                ? interactiveFlowId.trim()
                                : undefined,
                            flowAction:
                              interactionType === "Flow"
                                ? interactiveFlowAction.trim()
                                : undefined,
                            flowScreen:
                              interactionType === "Flow"
                                ? interactiveFlowScreen.trim()
                                : undefined,
                            sections:
                              interactionType === "List Button"
                                ? interactiveSections
                                    .map((section) => ({
                                      title: section.title.trim(),
                                      rows: section.rows
                                        .map((row) => ({
                                          title: row.title.trim(),
                                          description:
                                            row.description.trim() || undefined,
                                        }))
                                        .filter((row) => row.title),
                                    }))
                                    .filter((section) => section.rows.length > 0)
                                : undefined,
                          },
                        }
                      : messageType === "Text"
                        ? {
                            messageType,
                            countryCode,
                            phoneNumber,
                            name: name.trim() || undefined,
                            text: {
                              body: textBody.trim(),
                            },
                          }
                  : {
                      messageType,
                      countryCode,
                      phoneNumber,
                      name: name.trim() || undefined,
                      templateId,
                      bodyParameters,
                    },
              ),
            });
      const data = (await response.json()) as SendResponse;

      if (!response.ok) {
        const firstError =
          data.errors?.countryCode?.[0] ??
          data.errors?.phoneNumber?.[0] ??
          data.errors?.name?.[0] ??
          data.errors?.templateId?.[0] ??
          data.errors?.bodyParameters?.[0] ??
          data.errors?.media?.[0] ??
          data.errors?.location?.[0] ??
          data.errors?.interactive?.[0] ??
          data.errors?.messageType?.[0] ??
          data.message ??
          "Unable to queue message.";
        setError(firstError);
        return;
      }

      setSuccess(data.message ?? "Message queued successfully.");
      setMessageId(data.result?.messageId ?? "");
      setContactId("");
      setPhoneNumber("");
      setName("");
      setBodyParameters(selectedTemplate?.variables.map(() => "") ?? []);
      setSelectedMedia(null);
      setMediaCaption("");
      setIsScheduled(false);
      setScheduledAt("");
      router.refresh();
    } catch {
      setError("Unable to queue message.");
    } finally {
      setIsSending(false);
    }
  }

  if (templates.length === 0) {
    return (
      <Panel>
        <PanelTitle
          title="No approved templates"
          description="Sync templates from Meta before sending a template message."
        />
        <Link
          href="/dashboard/templates"
          className={`${actionButtonClass()} mt-5`}
        >
          Open Templates
        </Link>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelTitle
        title="Send Single Template Message"
        description="Choose an existing contact or enter a new WhatsApp recipient."
      />

      <form onSubmit={sendMessage} className="mt-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_438px]">
          <div className="space-y-5">
        {contacts.length ? (
          <div>
            <label htmlFor="contactId" className={labelClass}>
              Existing contact
            </label>
            <select
              id="contactId"
              value={contactId}
              onChange={(event) => chooseContact(event.target.value)}
              className={fieldClass}
            >
              <option value="">Enter a new contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name || "Unnamed contact"} · +{contact.countryCode}
                  {contact.phoneNumber}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <div>
            <label htmlFor="countryCode" className={labelClass}>
              Country code
            </label>
            <input
              id="countryCode"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              inputMode="numeric"
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="phoneNumber" className={labelClass}>
              Phone number
            </label>
            <input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="8178444398"
              required
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="name" className={labelClass}>
            Contact name
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional"
            className={fieldClass}
          />
        </div>

        <div>
          <p className={labelClass}>Message Type:</p>
          <div className="grid overflow-hidden rounded-xl bg-[#F3F4F6] p-1 sm:grid-cols-4 xl:grid-cols-7">
            {MESSAGE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMessageType(type)}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  messageType === type
                    ? "bg-white text-[#081B3A] shadow-sm"
                    : "text-[#526173] hover:text-[#081B3A]",
                ].join(" ")}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {messageType === "Template" ? (
          <div>
          <label htmlFor="templateId" className={labelClass}>
            Approved template
          </label>
          <select
            id="templateId"
            value={templateId}
            onChange={(event) => chooseTemplate(event.target.value)}
            required
            className={fieldClass}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {template.language} · {template.category}
              </option>
            ))}
          </select>
        </div>
        ) : null}

        {messageType === "Template" && selectedTemplate?.variables.map((variable, index) => (
          <div key={`${selectedTemplate.id}-${variable}`}>
            <label htmlFor={`parameter-${index}`} className={labelClass}>
              Parameter {variable}
            </label>
            <input
              id={`parameter-${index}`}
              value={bodyParameters[index] ?? ""}
              onChange={(event) => updateParameter(index, event.target.value)}
              required
              className={fieldClass}
            />
          </div>
        ))}

        {messageType === "Template" && selectedTemplate?.variables.length === 0 ? (
          <p className={helperTextClass}>This template has no parameters.</p>
        ) : null}

        {messageType === "Text" ? (
          <div>
            <label htmlFor="textBody" className={labelClass}>
              <span className="text-rose-500">*</span> Body
            </label>
            <textarea
              id="textBody"
              value={textBody}
              onChange={(event) => setTextBody(event.target.value.slice(0, 4096))}
              rows={5}
              placeholder="Enter text message"
              required={messageType === "Text"}
              className={fieldClass}
            />
            <p className="mt-1 text-right text-xs text-[#526173]">
              {textBody.length} / 4096
            </p>
          </div>
        ) : null}

        {messageType === "Media" ? (
          <div className="space-y-5">
            <div>
              <p className={labelClass}>Media Type:</p>
              <div className="grid overflow-hidden rounded-xl bg-[#F3F4F6] p-1 sm:grid-cols-4">
                {MEDIA_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setMediaType(type);
                      setSelectedMedia(null);
                    }}
                    className={[
                      "rounded-lg px-3 py-2 text-sm font-medium transition",
                      mediaType === type
                        ? "bg-white text-[#081B3A] shadow-sm"
                        : "text-[#526173] hover:text-[#081B3A]",
                    ].join(" ")}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={labelClass}>
                <span className="text-rose-500">*</span> Upload {mediaType}
              </p>

              {selectedMedia ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#D8E6F3] bg-white p-4">
                  <div className="flex min-w-0 items-center gap-4">
                    {mediaType === "Image" && selectedMedia.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedMedia.url}
                        alt={selectedMedia.name}
                        className="h-14 w-20 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid h-14 w-20 place-items-center rounded-lg bg-[#F0F8FF] text-[#0052CC]">
                        <FileUp className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#081B3A]">
                        {selectedMedia.name}
                      </p>
                      <p className="mt-1 text-sm text-[#526173]">
                        {selectedMedia.createdAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(true)}
                      className="rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] transition hover:bg-[#F0F8FF]"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMedia(null)}
                      className="inline-flex items-center rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#0052CC]/35 bg-[#F0F8FF] px-4 py-5 text-sm font-semibold text-[#0052CC] transition hover:border-[#0052CC]"
                >
                  <FileUp className="h-5 w-5" />
                  Upload or select file
                </button>
              )}
            </div>

            <div>
              <label htmlFor="mediaCaption" className={labelClass}>
                Caption
              </label>
              <textarea
                id="mediaCaption"
                value={mediaCaption}
                onChange={(event) => setMediaCaption(event.target.value)}
                maxLength={1024}
                rows={4}
                placeholder="Enter caption up to 1024"
                className={fieldClass}
              />
              <p className="mt-2 text-right text-xs text-[#526173]">
                {mediaCaption.length} / 1024
              </p>
            </div>
          </div>
        ) : null}

        {messageType === "Interactive" ? (
          <div className="space-y-5">
            <div>
              <p className={labelClass}>Interaction Type:</p>
              <div className="grid overflow-hidden rounded-xl bg-[#F3F4F6] p-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {INTERACTION_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInteractionType(type)}
                    className={[
                      "truncate rounded-lg px-3 py-2 text-sm font-medium transition",
                      interactionType === type
                        ? "bg-white text-[#081B3A] shadow-sm"
                        : "text-[#526173] hover:text-[#081B3A]",
                    ].join(" ")}
                    title={type}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {interactionType === "List Button" ? (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label htmlFor="interactiveListButtonText" className={labelClass}>
                      <span className="text-rose-500">*</span> List Button Text
                    </label>
                    <input
                      id="interactiveListButtonText"
                      value={interactiveListButtonText}
                      onChange={(event) =>
                        setInteractiveListButtonText(event.target.value.slice(0, 20))
                      }
                      placeholder="Enter value"
                      className={fieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-[#526173]">
                      {interactiveListButtonText.length} / 20
                    </p>
                  </div>

                  <div>
                    <label htmlFor="interactiveBody" className={labelClass}>
                      <span className="text-rose-500">*</span> Body
                    </label>
                    <textarea
                      id="interactiveBody"
                      value={interactiveBody}
                      onChange={(event) =>
                        setInteractiveBody(event.target.value.slice(0, 1024))
                      }
                      rows={4}
                      placeholder="Enter text Body"
                      className={fieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-[#526173]">
                      {interactiveBody.length} / 1024
                    </p>
                  </div>

                  <div>
                    <label htmlFor="interactiveHeader" className={labelClass}>
                      Title (Optional)
                    </label>
                    <textarea
                      id="interactiveHeader"
                      value={interactiveHeader}
                      onChange={(event) =>
                        setInteractiveHeader(event.target.value.slice(0, 60))
                      }
                      rows={2}
                      placeholder="Enter text Title"
                      className={fieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-[#526173]">
                      {interactiveHeader.length} / 60
                    </p>
                  </div>

                  <div>
                    <label htmlFor="interactiveFooter" className={labelClass}>
                      Footer (Optional)
                    </label>
                    <textarea
                      id="interactiveFooter"
                      value={interactiveFooter}
                      onChange={(event) =>
                        setInteractiveFooter(event.target.value.slice(0, 60))
                      }
                      rows={2}
                      placeholder="Enter text Footer"
                      className={fieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-[#526173]">
                      {interactiveFooter.length} / 60
                    </p>
                  </div>
                </div>

                {interactiveSections.map((section, sectionIndex) => (
                  <div
                    key={section.id}
                    className="overflow-hidden rounded-xl border border-[#D8E6F3] bg-white"
                  >
                    <div className="flex items-center gap-3 border-b border-[#D8E6F3] px-4 py-3">
                      <ChevronDown className="h-4 w-4 text-[#526173]" />
                      <p className="font-semibold text-[#081B3A]">
                        Section {sectionIndex + 1}
                      </p>
                    </div>
                    <div className="space-y-5 p-5">
                      <div>
                        <label className={labelClass}>Section Title</label>
                        <input
                          value={section.title}
                          onChange={(event) =>
                            updateInteractiveSection(section.id, {
                              title: event.target.value.slice(0, 24),
                            })
                          }
                          placeholder="Enter section title"
                          className={fieldClass}
                        />
                        <p className="mt-1 text-right text-xs text-[#526173]">
                          {section.title.length} / 24
                        </p>
                      </div>

                      {section.rows.map((row) => (
                        <div
                          key={row.id}
                          className="grid gap-4 rounded-xl border border-[#E5E7EB] p-4 sm:grid-cols-[24px_minmax(0,1fr)_minmax(0,1.5fr)]"
                        >
                          <GripVertical className="mt-8 h-5 w-5 text-[#8A94A6]" />
                          <div>
                            <label className={labelClass}>
                              <span className="text-rose-500">*</span> Row Title
                            </label>
                            <input
                              value={row.title}
                              onChange={(event) =>
                                updateInteractiveRow(section.id, row.id, {
                                  title: event.target.value.slice(0, 24),
                                })
                              }
                              placeholder="Enter title"
                              className={fieldClass}
                            />
                            <p className="mt-1 text-right text-xs text-[#526173]">
                              {row.title.length} / 24
                            </p>
                          </div>
                          <div>
                            <label className={labelClass}>Description</label>
                            <textarea
                              value={row.description}
                              onChange={(event) =>
                                updateInteractiveRow(section.id, row.id, {
                                  description: event.target.value.slice(0, 72),
                                })
                              }
                              rows={2}
                              placeholder="Enter description"
                              className={fieldClass}
                            />
                            <p className="mt-1 text-right text-xs text-[#526173]">
                              {row.description.length} / 72
                            </p>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addInteractiveRow(section.id)}
                        className="inline-flex items-center rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] transition hover:bg-[#F0F8FF]"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Row
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addInteractiveSection}
                  className="inline-flex items-center rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] transition hover:bg-[#F0F8FF]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </button>
              </div>
            ) : null}

            {interactionType === "Reply Button" ? (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label htmlFor="replyBody" className={labelClass}>
                      <span className="text-rose-500">*</span> Body
                    </label>
                    <textarea
                      id="replyBody"
                      value={interactiveBody}
                      onChange={(event) =>
                        setInteractiveBody(event.target.value.slice(0, 1024))
                      }
                      rows={4}
                      placeholder="Enter Body"
                      className={fieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-[#526173]">
                      {interactiveBody.length} / 1024
                    </p>
                  </div>
                  <div>
                    <label htmlFor="replyFooter" className={labelClass}>
                      Footer (Optional)
                    </label>
                    <textarea
                      id="replyFooter"
                      value={interactiveFooter}
                      onChange={(event) =>
                        setInteractiveFooter(event.target.value.slice(0, 60))
                      }
                      rows={2}
                      placeholder="Enter Footer"
                      className={fieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-[#526173]">
                      {interactiveFooter.length} / 60
                    </p>
                  </div>
                </div>

                {interactiveButtons.map((button, index) => (
                  <div key={`reply-button-${index}`} className="max-w-sm">
                    <label className={labelClass}>
                      <span className="text-rose-500">*</span> Button {index + 1}
                    </label>
                    <input
                      value={button}
                      onChange={(event) =>
                        setInteractiveButtons((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? event.target.value.slice(0, 20)
                              : item,
                          ),
                        )
                      }
                      placeholder={`Button ${index + 1}`}
                      className={fieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-[#526173]">
                      {button.length} / 20
                    </p>
                  </div>
                ))}

                {interactiveButtons.length < 3 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setInteractiveButtons((current) => [...current, ""])
                    }
                    className="inline-flex items-center rounded-xl border border-dashed border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] transition hover:bg-[#F0F8FF]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Button
                  </button>
                ) : null}
              </div>
            ) : null}

            {interactionType === "CTA Button" || interactionType === "Flow" ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {interactionType === "Flow" ? (
                  <div>
                    <label htmlFor="interactiveFlowId" className={labelClass}>
                      <span className="text-rose-500">*</span> Select Flow
                    </label>
                    <select
                      id="interactiveFlowId"
                      value={interactiveFlowId}
                      onChange={(event) => setInteractiveFlowId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Select a Flow</option>
                      <option value="lead_capture">Lead Capture Flow</option>
                      <option value="support_request">Support Request Flow</option>
                    </select>
                  </div>
                ) : null}

                <div>
                  <label htmlFor="interactiveCtaHeader" className={labelClass}>
                    {interactionType === "Flow" ? (
                      <span className="text-rose-500">*</span>
                    ) : null}{" "}
                    Header {interactionType === "CTA Button" ? "(Optional)" : ""}
                  </label>
                  <textarea
                    id="interactiveCtaHeader"
                    value={interactiveHeader}
                    onChange={(event) =>
                      setInteractiveHeader(event.target.value.slice(0, 60))
                    }
                    rows={2}
                    placeholder="Enter Header"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-right text-xs text-[#526173]">
                    {interactiveHeader.length} / 60
                  </p>
                </div>

                <div>
                  <label htmlFor="interactiveCtaBody" className={labelClass}>
                    <span className="text-rose-500">*</span> Body
                  </label>
                  <textarea
                    id="interactiveCtaBody"
                    value={interactiveBody}
                    onChange={(event) =>
                      setInteractiveBody(event.target.value.slice(0, 1024))
                    }
                    rows={4}
                    placeholder="Enter Body"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-right text-xs text-[#526173]">
                    {interactiveBody.length} / 1024
                  </p>
                </div>

                <div>
                  <label htmlFor="interactiveCtaFooter" className={labelClass}>
                    Footer {interactionType === "CTA Button" ? "(Optional)" : ""}
                  </label>
                  <textarea
                    id="interactiveCtaFooter"
                    value={interactiveFooter}
                    onChange={(event) =>
                      setInteractiveFooter(event.target.value.slice(0, 60))
                    }
                    rows={2}
                    placeholder="Enter Footer"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-right text-xs text-[#526173]">
                    {interactiveFooter.length} / 60
                  </p>
                </div>

                <div>
                  <label htmlFor="interactiveCtaText" className={labelClass}>
                    <span className="text-rose-500">*</span>{" "}
                    {interactionType === "Flow" ? "CTA Text" : "Button Text"}
                  </label>
                  <input
                    id="interactiveCtaText"
                    value={interactiveCtaText}
                    onChange={(event) =>
                      setInteractiveCtaText(event.target.value.slice(0, 20))
                    }
                    placeholder={
                      interactionType === "Flow" ? "Enter CTA text" : "Enter value"
                    }
                    className={fieldClass}
                  />
                  <p className="mt-1 text-right text-xs text-[#526173]">
                    {interactiveCtaText.length} / 20
                  </p>
                </div>

                {interactionType === "CTA Button" ? (
                  <div>
                    <label htmlFor="interactiveCtaUrl" className={labelClass}>
                      <span className="text-rose-500">*</span> Button URL
                    </label>
                    <input
                      id="interactiveCtaUrl"
                      value={interactiveCtaUrl}
                      onChange={(event) => setInteractiveCtaUrl(event.target.value)}
                      placeholder="https://example.com"
                      className={fieldClass}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="interactiveFlowAction" className={labelClass}>
                        <span className="text-rose-500">*</span> Action
                      </label>
                      <select
                        id="interactiveFlowAction"
                        value={interactiveFlowAction}
                        onChange={(event) =>
                          setInteractiveFlowAction(event.target.value)
                        }
                        className={fieldClass}
                      >
                        <option value="">Select action</option>
                        <option value="navigate">Navigate</option>
                        <option value="data_exchange">Data exchange</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="interactiveFlowScreen" className={labelClass}>
                        <span className="text-rose-500">*</span> Screen
                      </label>
                      <input
                        id="interactiveFlowScreen"
                        value={interactiveFlowScreen}
                        onChange={(event) =>
                          setInteractiveFlowScreen(event.target.value)
                        }
                        placeholder="Enter screen"
                        className={fieldClass}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {[
              "Call Permission Request",
              "Location Request",
              "Address Request",
            ].includes(interactionType) ? (
              <div>
                <label htmlFor="requestBody" className={labelClass}>
                  {interactionType === "Call Permission Request" ? null : (
                    <span className="text-rose-500">*</span>
                  )}{" "}
                  Body
                </label>
                <textarea
                  id="requestBody"
                  value={interactiveBody}
                  onChange={(event) =>
                    setInteractiveBody(event.target.value.slice(0, 1024))
                  }
                  rows={5}
                  placeholder="Enter text message up to 1024"
                  className={fieldClass}
                />
                <p className="mt-1 text-right text-xs text-[#526173]">
                  {interactiveBody.length} / 1024
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {messageType === "Location" ? (
          <div className="space-y-5">
            <div>
              <label htmlFor="locationName" className={labelClass}>
                <span className="text-rose-500">*</span> Name
              </label>
              <input
                id="locationName"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="Enter Name..."
                required={messageType === "Location"}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="locationAddress" className={labelClass}>
                <span className="text-rose-500">*</span> Address
              </label>
              <input
                id="locationAddress"
                value={locationAddress}
                onChange={(event) => setLocationAddress(event.target.value)}
                placeholder="Enter Address..."
                required={messageType === "Location"}
                className={fieldClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="locationLatitude" className={labelClass}>
                  <span className="text-rose-500">*</span> Latitude
                </label>
                <input
                  id="locationLatitude"
                  value={locationLatitude}
                  onChange={(event) => setLocationLatitude(event.target.value)}
                  inputMode="decimal"
                  placeholder="Enter Latitude..."
                  required={messageType === "Location"}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="locationLongitude" className={labelClass}>
                  <span className="text-rose-500">*</span> Longitude
                </label>
                <input
                  id="locationLongitude"
                  value={locationLongitude}
                  onChange={(event) => setLocationLongitude(event.target.value)}
                  inputMode="decimal"
                  placeholder="Enter Longitude..."
                  required={messageType === "Location"}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#D8E6F3] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E6F3] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#081B3A]">
                  <MapPin className="h-4 w-4 text-[#0052CC]" />
                  Google Maps location
                </div>
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#0052CC] hover:underline"
                  >
                    Open map
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>

              {googleMapsEmbedUrl ? (
                <iframe
                  title="Google Maps location preview"
                  src={googleMapsEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-64 w-full border-0"
                />
              ) : (
                <div className="flex h-64 items-center justify-center bg-[#F0F8FF] px-6 text-center text-sm leading-6 text-[#526173]">
                  Enter latitude and longitude to preview this place on Google
                  Maps.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {!["Template", "Media", "Location"].includes(messageType) ? (
          <div className="rounded-xl border border-[#D8E6F3] bg-[#F0F8FF] p-4 text-sm leading-6 text-[#526173]">
            {messageType} message draft uses this layout. Backend sending is
            currently connected for template and media messages.
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#D8E6F3] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0F8FF] text-[#0052CC]">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Schedule message
                </p>
                <p className="mt-1 text-xs leading-5 text-[#526173]">
                  Pick a future date and time to send this message later.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const nextMinimumScheduleAt = getMinimumScheduleAt();

                setMinimumScheduleAt(nextMinimumScheduleAt);
                setIsScheduled((current) => !current);
                setScheduledAt((current) => current || nextMinimumScheduleAt);
              }}
              className={[
                "relative h-8 w-16 rounded-full p-1 transition",
                isScheduled ? "bg-[#0052CC]" : "bg-gray-300",
              ].join(" ")}
              aria-pressed={isScheduled}
            >
              <span
                className={[
                  "block h-6 w-6 rounded-full bg-white shadow transition",
                  isScheduled ? "translate-x-8" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          {isScheduled ? (
            <div className="mt-4">
              <label htmlFor="scheduledAt" className={labelClass}>
                Send date and time
              </label>
              <input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                min={minimumScheduleAt || undefined}
                onChange={(event) => setScheduledAt(event.target.value)}
                required={isScheduled}
                className={fieldClass}
              />
              <p className={helperTextClass}>
                Scheduled single-message backend storage and worker will be
                connected in the next step.
              </p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-sm text-[#15803d]">
            <CheckCircle2 className="h-4 w-4" />
            <span>{success}</span>
            {messageId ? (
              <Link
                href={`/dashboard/messages/${messageId}`}
                className="font-semibold underline underline-offset-2"
              >
                View message
              </Link>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSending}
          className={actionButtonClass()}
        >
          {isSending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isSending
            ? "Queueing..."
            : isScheduled
              ? "Schedule Message"
            : ["Template", "Text", "Media", "Interactive", "Location"].includes(
                  messageType,
                )
              ? "Send Message"
              : "Save Draft"}
        </button>
          </div>

          <WhatsAppMessagePreview
            recipientLabel={
              phoneNumber ? `To +${countryCode}${phoneNumber}` : "No recipient"
            }
            template={messageType === "Template" ? selectedTemplate ?? null : null}
            variables={bodyParameters}
            bodyOverride={
              messageType === "Media"
                ? mediaCaption
                : messageType === "Text"
                  ? textBody
                : messageType === "Interactive"
                  ? ""
                : messageType === "Location"
                  ? ""
                : messageType === "Template"
                  ? undefined
                  : `${messageType} preview`
            }
            media={
              messageType === "Media" && selectedMedia
                ? {
                    type: mediaType.toUpperCase() as
                      | "IMAGE"
                      | "DOCUMENT"
                      | "VIDEO"
                      | "AUDIO",
                    name: selectedMedia.name,
                    url: selectedMedia.url,
                  }
                : null
            }
            interactive={
              messageType === "Interactive"
                ? {
                    type: interactionType,
                    header: interactiveHeader.trim(),
                    body: interactiveBody.trim(),
                    footer: interactiveFooter.trim(),
                    primaryButton:
                      interactionType === "List Button"
                        ? interactiveListButtonText.trim()
                        : interactionType === "CTA Button" ||
                            interactionType === "Flow"
                          ? interactiveCtaText.trim()
                          : undefined,
                    buttons:
                      interactionType === "Reply Button"
                        ? interactiveButtons
                            .map((button) => button.trim())
                            .filter(Boolean)
                        : undefined,
                    sections:
                      interactionType === "List Button"
                        ? interactiveSections
                            .map((section) => ({
                              title: section.title.trim(),
                              rows: section.rows
                                .map((row) => ({
                                  title: row.title.trim(),
                                  description: row.description.trim(),
                                }))
                                .filter((row) => row.title),
                            }))
                            .filter((section) => section.rows.length > 0)
                        : undefined,
                    ctaUrl:
                      interactionType === "CTA Button"
                        ? interactiveCtaUrl.trim()
                        : undefined,
                  }
                : null
            }
            location={
              messageType === "Location" &&
              hasValidLocationCoordinates &&
              googleMapsUrl
                ? {
                    name: locationName.trim() || "Location name",
                    address: locationAddress.trim() || "Location address",
                    latitude: parsedLatitude,
                    longitude: parsedLongitude,
                    url: googleMapsUrl,
                  }
                : null
            }
          />
        </div>
      </form>

      {isUploadOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-bold text-[#081B3A]">
              Upload or select file to use
            </h3>
            <button
              type="button"
              onClick={() => setIsUploadOpen(false)}
              className="rounded-full p-2 text-[#526173] transition hover:bg-[#F0F8FF] hover:text-[#081B3A]"
              aria-label="Close upload dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.92fr)]">
            <div>
              <label htmlFor="externalMediaUrl" className={labelClass}>
                Get file from external URL
              </label>
              <input
                id="externalMediaUrl"
                value={externalUrl}
                onChange={(event) => setExternalUrl(event.target.value)}
                placeholder="Enter URL"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={useExternalUrl}
                disabled={!externalUrl.trim()}
                className={`${actionButtonClass()} mt-3 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Use URL
              </button>

              <div className="my-10 flex items-center gap-5">
                <span className="h-px flex-1 bg-[#D8E6F3]" />
                <span className="text-lg font-bold text-[#081B3A]">OR</span>
                <span className="h-px flex-1 bg-[#D8E6F3]" />
              </div>

              <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#0052CC]/45 bg-white px-6 text-center transition hover:bg-[#F0F8FF]">
                <input
                  type="file"
                  className="sr-only"
                  accept={
                    mediaType === "Image"
                      ? "image/*"
                      : mediaType === "Video"
                        ? "video/*"
                        : mediaType === "Audio"
                          ? "audio/*"
                          : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  }
                  onChange={chooseMediaFile}
                />
                <FileUp className="h-12 w-12 text-[#0052CC]" />
                <span className="mt-7 text-lg font-medium text-[#081B3A]">
                  Click or drag files here to upload
                </span>
                <span className="mt-5 text-sm leading-6 text-[#526173]">
                  Maximum file size limits:
                  <br />
                  Images: 5 MB | Documents & PDFs: 100 MB | Video & Audio: 16 MB
                </span>
              </label>
            </div>

            <div>
              <p className={labelClass}>Select from already uploaded files</p>
              <div className="flex gap-2">
                <input
                  placeholder="Search by name"
                  className="min-w-0 flex-1 rounded-xl border border-[#D8E6F3] bg-white px-4 py-3 text-sm text-[#102040] outline-none transition placeholder:text-[#526173]/60 focus:border-[#0052CC]/40 focus:ring-4 focus:ring-[#0052CC]/10"
                />
                <button
                  type="button"
                  className="grid h-12 w-14 place-items-center rounded-xl bg-[#0052CC] text-white"
                  aria-label="Search uploaded files"
                >
                  <Search className="h-5 w-5" />
                </button>
                <select
                  value={mediaType}
                  onChange={(event) => setMediaType(event.target.value as MediaType)}
                  className="rounded-xl border border-[#D8E6F3] bg-white px-3 py-3 text-sm text-[#526173] outline-none"
                >
                  {MEDIA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex h-12 items-center gap-3 rounded-xl border border-[#D8E6F3] bg-white px-4 text-sm text-[#526173]">
                <span className="flex-1">Start date</span>
                <span>-</span>
                <span className="flex-1">End date</span>
              </div>

              {selectedMedia ? (
                <div className="mt-5 border-y border-[#D8E6F3] py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      {mediaType === "Image" && selectedMedia.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedMedia.url}
                          alt={selectedMedia.name}
                          className="h-14 w-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="grid h-14 w-20 place-items-center rounded-lg bg-[#F0F8FF] text-[#0052CC]">
                          <FileUp className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#081B3A]">
                          {selectedMedia.name}
                        </p>
                        <p className="mt-1 text-sm text-[#526173]">
                          {selectedMedia.createdAt}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(false)}
                      className="rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] transition hover:bg-[#F0F8FF]"
                    >
                      Select
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex min-h-64 items-center justify-center rounded-xl border border-dashed border-[#D8E6F3] bg-[#F0F8FF] p-6 text-center text-sm text-[#526173]">
                  No uploaded files yet. Upload a file or paste an external URL
                  to preview it.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
