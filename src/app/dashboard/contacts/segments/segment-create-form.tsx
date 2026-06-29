"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const fields = [
  "MARKETING_CONSENT",
  "UTILITY_CONSENT",
  "SOURCE",
  "NAME",
  "EMAIL",
  "PHONE",
  "TAG",
  "CREATED_AT",
  "LAST_MESSAGE_AT",
  "LEAD_SCORE",
];

const FIELD_LABELS: Record<string, string> = {
  MARKETING_CONSENT: "Marketing Consent",
  UTILITY_CONSENT: "Utility Consent",
  SOURCE: "Source",
  NAME: "Name",
  EMAIL: "Email",
  PHONE: "Phone",
  TAG: "Tag",
  CREATED_AT: "Created At",
  LAST_MESSAGE_AT: "Last Message At",
  LEAD_SCORE: "Lead Score",
};

const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: "is equal to",
  NOT_EQUALS: "is not equal to",
  CONTAINS: "contains",
  NOT_CONTAINS: "does not contain",
  IN: "is in list",
  EXISTS: "exists",
  BEFORE: "is before",
  AFTER: "is after",
  BETWEEN: "is between",
  GREATER_THAN: "is greater than",
  LESS_THAN: "is less than",
};

export function SegmentCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [matchMode, setMatchMode] = useState("ALL");
  const [field, setField] = useState("MARKETING_CONSENT");
  const [operator, setOperator] = useState("EQUALS");
  const [value, setValue] = useState("GRANTED");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const getOperatorsForField = (f: string) => {
    if (f === "LEAD_SCORE") {
      return ["EQUALS", "GREATER_THAN", "LESS_THAN", "BETWEEN"];
    }
    return [
      "EQUALS",
      "NOT_EQUALS",
      "CONTAINS",
      "NOT_CONTAINS",
      "IN",
      "EXISTS",
      "BEFORE",
      "AFTER",
    ];
  };

  const handleFieldChange = (newField: string) => {
    setField(newField);
    const allowed = getOperatorsForField(newField);
    if (!allowed.includes(operator)) {
      setOperator(allowed[0]);
    }
    if (newField === "LEAD_SCORE") {
      setValue("75");
    } else {
      setValue("GRANTED");
    }
  };

  async function create() {
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/contact-segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          matchMode,
          rules: [
            {
              field,
              operator,
              value: operator === "BETWEEN" ? null : value,
              values:
                operator === "BETWEEN"
                  ? [Number(minValue), Number(maxValue)]
                  : operator === "IN"
                    ? value.split(",").map((item) => item.trim())
                    : null,
            },
          ],
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to create segment.");
        return;
      }

      setMessage("Segment created.");
      setName("");
      setMinValue("");
      setMaxValue("");
      router.refresh();
    } catch {
      setError("Unable to create segment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Create Segment</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-6">
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Segment Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Granted website leads"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Match</span>
          <select
            value={matchMode}
            onChange={(event) => setMatchMode(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="ALL">ALL</option>
            <option value="ANY">ANY</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Field</span>
          <select
            value={field}
            onChange={(event) => handleFieldChange(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          >
            {fields.map((item) => (
              <option key={item} value={item}>{FIELD_LABELS[item] ?? item}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Operator</span>
          <select
            value={operator}
            onChange={(event) => setOperator(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          >
            {getOperatorsForField(field).map((item) => (
              <option key={item} value={item}>{OPERATOR_LABELS[item] ?? item}</option>
            ))}
          </select>
        </label>

        {field === "LEAD_SCORE" && operator === "BETWEEN" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Min Score</span>
              <input
                type="number"
                value={minValue}
                onChange={(event) => setMinValue(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="50"
                min="0"
                max="1000"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Max Score</span>
              <input
                type="number"
                value={maxValue}
                onChange={(event) => setMaxValue(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="100"
                min="0"
                max="1000"
              />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Value</span>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder={field === "LEAD_SCORE" ? "75" : "GRANTED"}
              type={field === "LEAD_SCORE" ? "number" : "text"}
            />
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={create}
        disabled={isSaving || !name}
        className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSaving ? "Creating..." : "Create Segment"}
      </button>
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
