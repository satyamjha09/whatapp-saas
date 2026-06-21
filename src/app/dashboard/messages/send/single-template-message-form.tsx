"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

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
      "phoneNumber" | "countryCode" | "name" | "templateId" | "bodyParameters",
      string[]
    >
  >;
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [messageId, setMessageId] = useState("");
  const [isSending, setIsSending] = useState(false);

  const selectedTemplate = templates.find(
    (template) => template.id === templateId,
  );
  const preview = useMemo(() => {
    if (!selectedTemplate) return "";

    return selectedTemplate.body.replace(/{{(\d+)}}/g, (token, index: string) => {
      return bodyParameters[Number(index) - 1] || token;
    });
  }, [bodyParameters, selectedTemplate]);

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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setMessageId("");
    setIsSending(true);

    try {
      const response = await fetch("/api/messages/single-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode,
          phoneNumber,
          name: name.trim() || undefined,
          templateId,
          bodyParameters,
        }),
      });
      const data = (await response.json()) as SendResponse;

      if (!response.ok) {
        const firstError =
          data.errors?.countryCode?.[0] ??
          data.errors?.phoneNumber?.[0] ??
          data.errors?.name?.[0] ??
          data.errors?.templateId?.[0] ??
          data.errors?.bodyParameters?.[0] ??
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

      <form onSubmit={sendMessage} className="mt-6 space-y-5">
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

        {selectedTemplate?.variables.map((variable, index) => (
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

        {selectedTemplate ? (
          <div className="rounded-xl bg-[#F0F8FF] p-4 ring-1 ring-[#D8E6F3]">
            <p className="text-sm font-bold text-[#081B3A]">Template preview</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#526173]">
              {preview || "No body preview available."}
            </p>
            {selectedTemplate.variables.length === 0 ? (
              <p className={helperTextClass}>This template has no parameters.</p>
            ) : null}
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
          {isSending ? "Queueing..." : "Send Message"}
        </button>
      </form>
    </Panel>
  );
}
