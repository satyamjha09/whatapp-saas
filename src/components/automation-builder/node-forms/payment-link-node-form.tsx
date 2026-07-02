"use client";

import type { NodeFormProps } from "@/components/automation-builder/types";
import {
  BoundTextInput,
  JsonTextarea,
  SelectInput,
} from "@/components/automation-builder/node-forms/advanced-node-form-helpers";

export default function PaymentLinkNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  return (
    <div className="space-y-4">
      <SelectInput
        draft={draft}
        field="provider"
        label="Provider"
        options={["CASHFREE"]}
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="amountSource"
        label="Amount source"
        placeholder='{"sourceType":"STATIC","sourceValue":"1000"}'
        setDraft={setDraft}
      />
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="purpose"
        label="Purpose"
        placeholder="Payment request"
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="customerNameSource"
        label="Customer name source"
        placeholder='{"sourceType":"CONTACT_FIELD","sourceValue":"name"}'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="customerPhoneSource"
        label="Customer phone source"
        placeholder='{"sourceType":"CONTACT_FIELD","sourceValue":"phoneNumber"}'
        setDraft={setDraft}
      />
      <JsonTextarea
        draft={draft}
        field="customerEmailSource"
        label="Customer email source"
        placeholder='{"sourceType":"CONTACT_FIELD","sourceValue":"email"}'
        setDraft={setDraft}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="expiryMinutes"
          label="Expiry minutes"
          setDraft={setDraft}
          type="number"
        />
        <BoundTextInput
          draft={draft}
          errors={errors}
          field="savePaymentLinkAs"
          label="Save link as"
          setDraft={setDraft}
        />
      </div>
      <BoundTextInput
        draft={draft}
        errors={errors}
        field="mockPaymentLink"
        label="Mock payment link"
        placeholder="https://payments.test/tallykonnect/mock-payment-link"
        setDraft={setDraft}
        type="url"
      />
    </div>
  );
}
