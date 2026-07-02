"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import type { TemplateVariableMapping } from "@/components/automation-builder/types";

const sourceTypes: Array<{
  value: TemplateVariableMapping["sourceType"];
  label: string;
}> = [
  { label: "Contact field", value: "CONTACT_FIELD" },
  { label: "Static value", value: "STATIC" },
  { label: "Session context", value: "SESSION_CONTEXT" },
  { label: "Previous node output", value: "PREVIOUS_NODE_OUTPUT" },
  { label: "Custom attribute", value: "CUSTOM_ATTRIBUTE" },
];

const sourceHints = [
  "contact.name",
  "contact.phoneNumber",
  "contact.countryCode",
  "contact.email",
  "contact.companyName",
  "contact.tags",
  "contact.customAttributes.tallyLedger",
  "session.context.last_reply",
  "nodes.node_id.output.value",
  "customAttributes.source",
];

function updateMapping(
  mappings: TemplateVariableMapping[],
  index: number,
  patch: Partial<TemplateVariableMapping>,
) {
  return mappings.map((mapping, mappingIndex) =>
    mappingIndex === index
      ? {
          ...mapping,
          ...patch,
        }
      : mapping,
  );
}

export default function TemplateVariableMappingEditor({
  component,
  mappings,
  onChange,
  title,
}: {
  component: TemplateVariableMapping["component"];
  mappings: TemplateVariableMapping[];
  onChange: (mappings: TemplateVariableMapping[]) => void;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-[#BFE9D0] bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#081B3A]">{title}</p>
          <p className="mt-1 text-xs text-[#526173]">
            Map each template variable to data available during automation.
          </p>
        </div>
        <button
          className="inline-flex items-center rounded-lg bg-[#E7F8EF] px-2.5 py-2 text-xs font-bold text-[#128C7E]"
          onClick={() =>
            onChange([
              ...mappings,
              {
                component,
                index: mappings.length + 1,
                sourceType: "STATIC",
                sourceValue: "",
                variableName: `${mappings.length + 1}`,
              },
            ])
          }
          type="button"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {mappings.length === 0 ? (
        <p className="rounded-lg bg-[#F8FCFA] p-3 text-xs text-[#526173]">
          This template section has no variables.
        </p>
      ) : (
        <div className="space-y-3">
          {mappings.map((mapping, index) => (
            <div
              className="rounded-lg border border-[#E7F8EF] bg-[#F8FCFA] p-3"
              key={`${mapping.component}-${mapping.variableName}-${mapping.index}-${index}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#081B3A]">
                    {mapping.component} variable {`{{${mapping.variableName}}}`}
                  </p>
                  <p className="mt-1 text-xs text-[#526173]">
                    Index {mapping.index || index + 1}
                  </p>
                </div>
                <button
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                  onClick={() =>
                    onChange(
                      mappings.filter(
                        (_mapping, mappingIndex) => mappingIndex !== index,
                      ),
                    )
                  }
                  title="Remove mapping"
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid gap-3">
                <label className="block">
                  <span className={labelClass}>Source type</span>
                  <select
                    className={fieldClass}
                    onChange={(event) =>
                      onChange(
                        updateMapping(mappings, index, {
                          sourceType: event.target
                            .value as TemplateVariableMapping["sourceType"],
                        }),
                      )
                    }
                    value={mapping.sourceType}
                  >
                    {sourceTypes.map((sourceType) => (
                      <option key={sourceType.value} value={sourceType.value}>
                        {sourceType.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelClass}>Source value</span>
                  <input
                    className={fieldClass}
                    list="automation-template-source-hints"
                    onChange={(event) =>
                      onChange(
                        updateMapping(mappings, index, {
                          sourceValue: event.target.value,
                        }),
                      )
                    }
                    placeholder={
                      mapping.sourceType === "STATIC"
                        ? "Static text"
                        : "contact.name"
                    }
                    value={mapping.sourceValue}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Fallback value</span>
                  <input
                    className={fieldClass}
                    onChange={(event) =>
                      onChange(
                        updateMapping(mappings, index, {
                          fallbackValue: event.target.value,
                        }),
                      )
                    }
                    placeholder="Used when dynamic data is empty"
                    value={mapping.fallbackValue ?? ""}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <datalist id="automation-template-source-hints">
        {sourceHints.map((hint) => (
          <option key={hint} value={hint} />
        ))}
      </datalist>
    </div>
  );
}
