"use client";

import {
  CheckCircle2,
  FileUp,
  LoaderCircle,
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
      | "media",
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

type MessageType = (typeof MESSAGE_TYPES)[number];
type MediaType = (typeof MEDIA_TYPES)[number];

type SelectedMedia = {
  name: string;
  url?: string;
  file?: File;
  createdAt: string;
};

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
  const [mediaType, setMediaType] = useState<MediaType>("Image");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [messageId, setMessageId] = useState("");
  const [isSending, setIsSending] = useState(false);

  const selectedTemplate = templates.find(
    (template) => template.id === templateId,
  );
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

    if (!["Template", "Media"].includes(messageType)) {
      setSuccess(
        `${messageType} message draft is ready. Backend sending is currently connected for template messages.`,
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

        {!["Template", "Media"].includes(messageType) ? (
          <div className="rounded-xl border border-[#D8E6F3] bg-[#F0F8FF] p-4 text-sm leading-6 text-[#526173]">
            {messageType} message draft uses this layout. Backend sending is
            currently connected for template messages.
          </div>
        ) : null}

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
            : ["Template", "Media"].includes(messageType)
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
