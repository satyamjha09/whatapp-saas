"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

type Contact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
};

type Template = {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAUSED";
  body: string;
  variables: string[];
};

type SendMessageFormProps = {
  contacts: Contact[];
  templates: Template[];
};

type SendTemplateMessageResponse = {
  message: string;
  data?: {
    id: string;
    body: string;
    status: string;
  };
  errors?: {
    contactId?: string[];
    templateId?: string[];
    variables?: string[];
  };
};

export default function SendMessageForm({
  contacts,
  templates,
}: SendMessageFormProps) {
  const router = useRouter();

  const [contactId, setContactId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTemplate = useMemo(() => {
    return templates.find((template) => template.id === templateId) ?? null;
  }, [templateId, templates]);

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId);

    const template = templates.find((item) => item.id === nextTemplateId);

    if (!template) {
      setVariables([]);
      return;
    }

    setVariables(template.variables.map(() => ""));
  }

  function updateVariable(index: number, value: string) {
    setVariables((currentVariables) =>
      currentVariables.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/messages/send-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId,
          templateId,
          variables,
        }),
      });

      const data: SendTemplateMessageResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.contactId?.[0] ??
          data.errors?.templateId?.[0] ??
          data.errors?.variables?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setSuccess(data.message);
      router.refresh();
    } catch {
      setError("Unable to queue message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel>
      <PanelTitle
        title="Send template message"
        description="Select a contact and template. This will queue the message for sending."
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="contact" className={labelClass}>
            Contact
          </label>

          <select
            id="contact"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Select contact</option>

            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name ?? "Unnamed Contact"} - +{contact.countryCode}
                {contact.phoneNumber}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="template" className={labelClass}>
            Template
          </label>

          <select
            id="template"
            value={templateId}
            onChange={(event) => handleTemplateChange(event.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Select template</option>

            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.language} - {template.status}
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate && (
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/45 p-4">
            <p className="text-sm font-medium text-zinc-300">
              Template Preview
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
              {selectedTemplate.body}
            </p>
          </div>
        )}

        {selectedTemplate && selectedTemplate.variables.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-zinc-300">
              Template Variables
            </p>

            {selectedTemplate.variables.map((variable, index) => (
              <div key={variable}>
                <label
                  htmlFor={`variable-${index}`}
                  className="mb-2 block text-sm text-zinc-500"
                >
                  Value for {variable}
                </label>

                <input
                  id={`variable-${index}`}
                  type="text"
                  value={variables[index] ?? ""}
                  onChange={(event) => updateVariable(index, event.target.value)}
                  placeholder={
                    index === 0
                      ? "Satyam"
                      : index === 1
                        ? "ORD123"
                        : `Value ${index + 1}`
                  }
                  required
                  className={fieldClass}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting || contacts.length === 0 || templates.length === 0
          }
          className={actionButtonClass()}
        >
          {isSubmitting ? "Queueing..." : "Queue Message"}
        </button>
      </form>
    </Panel>
  );
}
