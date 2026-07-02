"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  JsonTextarea,
  SelectInput,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function TallyLookupNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <SelectInput
        draft={draft}
        field="lookupType"
        label="Lookup type"
        options={[
          "LEDGER_BALANCE",
          "INVOICE_STATUS",
          "STOCK_ITEM",
          "CUSTOMER_DUES",
          "CUSTOMER_LEDGER",
          "SALES_ORDER_STATUS",
        ]}
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="customerIdentifierSource"
        label="Customer identifier source"
        placeholder='{"sourceType":"CONTACT_FIELD","sourceValue":"phoneNumber"}'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="invoiceNumberSource"
        label="Invoice number source"
        placeholder='{"sourceType":"SESSION_CONTEXT","sourceValue":"variables.invoiceNo"}'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="stockItemSource"
        label="Stock item source"
        placeholder='{"sourceType":"STATIC","sourceValue":"Item name"}'
        setDraft={setDraft}
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="saveResultAs"
        label="Save result as"
        placeholder="tallyResult"
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="mockResult"
        label="Mock result for Live Test"
        placeholder='{"found":true,"balance":"12500.00","currency":"INR"}'
        setDraft={setDraft}
      />
    </div>
  );
}
