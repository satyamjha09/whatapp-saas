"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const USE_CASES = [
  "LEAD_CAPTURE",
  "APPOINTMENT_BOOKING",
  "FEEDBACK_SURVEY",
  "PAYMENT_COLLECTION",
  "CUSTOMER_SUPPORT",
  "KYC",
  "ORDER_ENQUIRY",
  "CUSTOM",
];

export default function WhatsAppFlowForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [useCase, setUseCase] = useState("LEAD_CAPTURE");
  const [metaFlowId, setMetaFlowId] = useState("");
  const [defaultCta, setDefaultCta] = useState("Start form");
  const [defaultScreen, setDefaultScreen] = useState("");
  const [status, setStatus] = useState("PUBLISHED");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/whatsapp-flows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          defaultCta,
          defaultScreen: defaultScreen || null,
          description: description || null,
          metaFlowId,
          name,
          status,
          useCase,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to save WhatsApp Flow");
      }

      router.push(`/dashboard/whatsapp/flows/${data.flow.id}`);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save WhatsApp Flow",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="flowName" className="mb-2 block text-sm font-semibold text-[#081B3A]">
          Flow name
        </label>
        <input
          id="flowName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="w-full rounded-lg border border-[#BFE9D0] px-3 py-2 text-sm"
          placeholder="Lead Capture Form"
        />
      </div>

      <div>
        <label htmlFor="flowDescription" className="mb-2 block text-sm font-semibold text-[#081B3A]">
          Description
        </label>
        <textarea
          id="flowDescription"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-24 w-full rounded-lg border border-[#BFE9D0] px-3 py-2 text-sm"
          placeholder="Collect customer name, city, and requirement."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="metaFlowId" className="mb-2 block text-sm font-semibold text-[#081B3A]">
            Meta Flow ID
          </label>
          <input
            id="metaFlowId"
            value={metaFlowId}
            onChange={(event) => setMetaFlowId(event.target.value)}
            required
            className="w-full rounded-lg border border-[#BFE9D0] px-3 py-2 text-sm"
            placeholder="123456789012345"
          />
        </div>

        <div>
          <label htmlFor="useCase" className="mb-2 block text-sm font-semibold text-[#081B3A]">
            Use case
          </label>
          <select
            id="useCase"
            value={useCase}
            onChange={(event) => setUseCase(event.target.value)}
            className="w-full rounded-lg border border-[#BFE9D0] px-3 py-2 text-sm"
          >
            {USE_CASES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="defaultCta" className="mb-2 block text-sm font-semibold text-[#081B3A]">
            CTA button
          </label>
          <input
            id="defaultCta"
            value={defaultCta}
            onChange={(event) => setDefaultCta(event.target.value)}
            required
            className="w-full rounded-lg border border-[#BFE9D0] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="defaultScreen" className="mb-2 block text-sm font-semibold text-[#081B3A]">
            Start screen
          </label>
          <input
            id="defaultScreen"
            value={defaultScreen}
            onChange={(event) => setDefaultScreen(event.target.value)}
            className="w-full rounded-lg border border-[#BFE9D0] px-3 py-2 text-sm"
            placeholder="LEAD_FORM"
          />
        </div>

        <div>
          <label htmlFor="flowStatus" className="mb-2 block text-sm font-semibold text-[#081B3A]">
            Status
          </label>
          <select
            id="flowStatus"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-lg border border-[#BFE9D0] px-3 py-2 text-sm"
          >
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="DISABLED">Disabled</option>
            <option value="DEPRECATED">Deprecated</option>
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-lg bg-[#128C7E] px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
      >
        {isSaving ? "Saving..." : "Save Flow"}
      </button>
    </form>
  );
}
