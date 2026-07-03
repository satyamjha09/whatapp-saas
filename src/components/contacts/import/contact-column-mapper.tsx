"use client";

import { fieldClass, labelClass } from "@/app/dashboard/dashboard-ui";
import type { ImportColumnMappingState } from "./types";

const FIELDS: Array<{
  key: keyof ImportColumnMappingState;
  label: string;
  required?: boolean;
}> = [
  { key: "phoneNumber", label: "Phone number", required: true },
  { key: "countryCode", label: "Country code" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "companyName", label: "Company name" },
  { key: "tags", label: "Tags" },
  { key: "city", label: "City" },
  { key: "source", label: "Source" },
];

export function ContactColumnMapper({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: ImportColumnMappingState;
  onChange: (mapping: ImportColumnMappingState) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <div key={field.key}>
          <label className={labelClass} htmlFor={`mapping-${field.key}`}>
            {field.label}
            {field.required ? <span className="text-rose-600"> *</span> : null}
          </label>

          <select
            id={`mapping-${field.key}`}
            className={fieldClass}
            value={mapping[field.key]}
            onChange={(event) =>
              onChange({
                ...mapping,
                [field.key]: event.target.value,
              })
            }
          >
            <option value="">Not mapped</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
