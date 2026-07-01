"use client";

import { FormEvent, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

type VerificationStatus =
  | "NOT_STARTED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

type ProductionConfirmationsFormProps = {
  settings: {
    metaPaymentMethodAdded: boolean;
    metaBusinessVerificationStatus: string;
    productionChecklistNotes: string | null;
    productionChecklistUpdatedAt: Date | null;
  };
  canManage: boolean;
};

type SettingsResponse = {
  message: string;
  errors?: {
    metaPaymentMethodAdded?: string[];
    metaBusinessVerificationStatus?: string[];
    productionChecklistNotes?: string[];
  };
};

const fieldClass =
  "w-full rounded-xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm text-[#102040] outline-none transition focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10 disabled:cursor-not-allowed disabled:bg-[#E7F8EF] disabled:text-[#526173]";

export default function ProductionConfirmationsForm({
  settings,
  canManage,
}: ProductionConfirmationsFormProps) {
  const router = useRouter();
  const [metaPaymentMethodAdded, setMetaPaymentMethodAdded] = useState(
    settings.metaPaymentMethodAdded,
  );
  const [metaBusinessVerificationStatus, setMetaBusinessVerificationStatus] =
    useState<VerificationStatus>(
      settings.metaBusinessVerificationStatus as VerificationStatus,
    );
  const [productionChecklistNotes, setProductionChecklistNotes] = useState(
    settings.productionChecklistNotes ?? "",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/production-checklist/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaPaymentMethodAdded,
          metaBusinessVerificationStatus,
          productionChecklistNotes,
        }),
      });
      const data: SettingsResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.metaPaymentMethodAdded?.[0] ??
          data.errors?.metaBusinessVerificationStatus?.[0] ??
          data.errors?.productionChecklistNotes?.[0] ??
          data.message;
        setError(firstError);
        return;
      }

      setSuccess("Production confirmations updated.");
      router.refresh();
    } catch {
      setError("Unable to update production confirmations.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={saveSettings} className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
        <input
          type="checkbox"
          checked={metaPaymentMethodAdded}
          onChange={(event) => setMetaPaymentMethodAdded(event.target.checked)}
          disabled={!canManage}
          className="mt-1 h-4 w-4 accent-[#128C7E]"
        />
        <span>
          <span className="block text-sm font-bold text-[#081B3A]">
            Meta payment method added
          </span>
          <span className="mt-1 block text-xs leading-5 text-[#526173]">
            Confirm only after payment is active in Meta Business Manager.
          </span>
        </span>
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="businessVerification"
            className="mb-2 block text-sm font-medium text-[#102040]"
          >
            Meta Business Verification
          </label>
          <select
            id="businessVerification"
            value={metaBusinessVerificationStatus}
            onChange={(event) =>
              setMetaBusinessVerificationStatus(
                event.target.value as VerificationStatus,
              )
            }
            disabled={!canManage}
            className={fieldClass}
          >
            <option value="NOT_STARTED">Not started</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="productionNotes"
            className="mb-2 block text-sm font-medium text-[#102040]"
          >
            Production notes
          </label>
          <textarea
            id="productionNotes"
            value={productionChecklistNotes}
            onChange={(event) => setProductionChecklistNotes(event.target.value)}
            disabled={!canManage}
            rows={3}
            maxLength={1000}
            placeholder="Verification progress, payment details, or launch notes..."
            className={fieldClass}
          />
          <p className="mt-1 text-right text-[11px] text-[#526173]">
            {productionChecklistNotes.length}/1000
          </p>
        </div>
      </div>

      {!canManage ? (
        <p className="rounded-xl border border-[#F8C830]/35 bg-[#F8C830]/12 p-3 text-sm text-[#755b00]">
          Only owners and admins can update production confirmations.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-sm text-[#15803d]">
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-[#526173]">
          <ShieldCheck className="h-4 w-4 text-[#128C7E]" />
          Changes are recorded in the workspace audit log.
        </p>
        <button
          type="submit"
          disabled={!canManage || isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Confirmations"}
        </button>
      </div>
    </form>
  );
}
