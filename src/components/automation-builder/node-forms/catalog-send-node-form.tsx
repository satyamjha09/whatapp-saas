"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  SelectInput,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

function parseProductIds(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CatalogSendNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <SelectInput
        draft={draft}
        field="catalogSource"
        label="Catalog source"
        options={["WHATSAPP_CATALOG", "TALLY_STOCK", "MANUAL_PRODUCTS"]}
        setDraft={setDraft}
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="catalogId"
        label="Catalog ID"
        setDraft={setDraft}
      />
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#526173]">
          Product IDs
        </span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-[#D6EADF] bg-white px-3 py-2 text-sm outline-none focus:border-[#128C7E]"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              productIds: parseProductIds(event.target.value),
            }))
          }
          placeholder="product_1&#10;product_2"
          value={Array.isArray(draft.productIds) ? draft.productIds.join("\n") : ""}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="categoryFilter"
          label="Category filter"
          setDraft={setDraft}
        />
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="maxProducts"
          label="Max products"
          setDraft={setDraft}
          type="number"
        />
      </div>
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="fallbackText"
        label="Fallback text"
        placeholder="Here are the products we discussed."
        setDraft={setDraft}
      />
    </div>
  );
}
