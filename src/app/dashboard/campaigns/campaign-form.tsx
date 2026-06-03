"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type CampaignFormProps = {
  contacts: Contact[];
  templates: Template[];
};

type CreateCampaignResponse = {
  message: string;
  errors?: {
    name?: string[];
    templateId?: string[];
    contactIds?: string[];
    variables?: string[];
  };
};

export default function CampaignForm({
  contacts,
  templates,
}: CampaignFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
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

  function toggleContact(contactId: string) {
    setSelectedContactIds((current) => {
      if (current.includes(contactId)) {
        return current.filter((id) => id !== contactId);
      }

      return [...current, contactId];
    });
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
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          templateId,
          contactIds: selectedContactIds,
          variables,
        }),
      });

      const data: CreateCampaignResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ??
          data.errors?.templateId?.[0] ??
          data.errors?.contactIds?.[0] ??
          data.errors?.variables?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setName("");
      setTemplateId("");
      setSelectedContactIds([]);
      setVariables([]);
      setSuccess(data.message);

      router.refresh();
    } catch {
      setError("Unable to create campaign. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Create Campaign</h2>

      <p className="mt-2 text-sm text-gray-600">
        Create a draft campaign using one template and multiple contacts.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="campaignName"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Campaign name
          </label>

          <input
            id="campaignName"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="June Order Updates"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="template"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Template
          </label>

          <select
            id="template"
            value={templateId}
            onChange={(event) => handleTemplateChange(event.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          >
            <option value="">Select template</option>

            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.language} - {template.status}
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate ? (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">
              Template Preview
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
              {selectedTemplate.body}
            </p>
          </div>
        ) : null}

        {selectedTemplate && selectedTemplate.variables.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              Campaign Variables
            </p>

            {selectedTemplate.variables.map((variable, index) => (
              <div key={variable}>
                <label
                  htmlFor={`campaign-variable-${index}`}
                  className="mb-2 block text-sm text-gray-600"
                >
                  Value for {variable}
                </label>

                <input
                  id={`campaign-variable-${index}`}
                  type="text"
                  value={variables[index] ?? ""}
                  onChange={(event) => updateVariable(index, event.target.value)}
                  placeholder={
                    index === 0
                      ? "John Doe"
                      : index === 1
                        ? "123456"
                        : `Value ${index + 1}`
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
                />
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <p className="mb-2 block text-sm font-medium text-gray-700">
            Contacts
          </p>

          {contacts.length === 0 ? (
            <p className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
              Create contacts before creating a campaign.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
              {contacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedContactIds.includes(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                    className="h-4 w-4"
                  />

                  <span className="text-sm text-gray-700">
                    {contact.name ?? "Unnamed Contact"} - +{contact.countryCode}
                    {contact.phoneNumber}
                  </span>
                </label>
              ))}
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Selected contacts: {selectedContactIds.length}
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            isSubmitting || contacts.length === 0 || templates.length === 0
          }
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Draft Campaign"}
        </button>
      </form>
    </div>
  );
}
