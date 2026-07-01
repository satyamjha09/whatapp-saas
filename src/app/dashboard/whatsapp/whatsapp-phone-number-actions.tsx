"use client";

import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type PhoneStatusResponse = {
  message?: string;
  status?: {
    displayPhoneNumber: string;
    verifiedName: string | null;
    qualityRating: string | null;
    canSendMessage: string | null;
  };
};

function metaPhoneProfileUrl({
  displayPhoneNumber,
  wabaId,
}: {
  displayPhoneNumber: string;
  wabaId: string;
}) {
  const url = new URL(
    "https://business.facebook.com/latest/whatsapp_manager/phone_numbers",
  );
  if (wabaId) url.searchParams.set("waba_id", wabaId);
  if (displayPhoneNumber) {
    url.searchParams.set("phone_number", displayPhoneNumber.replace(/\D/g, ""));
  }

  return url.toString();
}

function metaPaymentUrl(wabaId: string) {
  const url = new URL(
    "https://business.facebook.com/billing_hub/payment_methods",
  );
  if (wabaId) url.searchParams.set("asset_id", wabaId);

  return url.toString();
}

const linkClass =
  "inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] hover:bg-[#E7F8EF]";

export default function WhatsAppPhoneNumberActions({
  canManage,
  displayPhoneNumber,
  phoneNumberId,
  wabaId,
}: {
  canManage: boolean;
  displayPhoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function checkStatus() {
    setError("");
    setSuccess("");
    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/whatsapp/phone-numbers/${phoneNumberId}/status`,
        {
          method: "POST",
        },
      );
      const data = (await response.json()) as PhoneStatusResponse;

      if (!response.ok || !data.status) {
        setError(data.message ?? "Unable to check phone status.");
        return;
      }

      setSuccess(
        `${data.status.verifiedName || "WhatsApp number"} refreshed - quality ${data.status.qualityRating || "UNKNOWN"}`,
      );
      router.refresh();
    } catch {
      setError("Unable to check phone status.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={checkStatus}
          disabled={!canManage || !phoneNumberId || isChecking}
          className={linkClass}
        >
          {isChecking ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isChecking ? "Checking..." : "Check number status"}
        </button>
        <a
          href={metaPhoneProfileUrl({ displayPhoneNumber, wabaId })}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Phone Profile
        </a>
        <a
          href={metaPaymentUrl(wabaId)}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Payment Setup
        </a>
        <a
          href="https://business.facebook.com/settings/security"
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Business Verification
        </a>
      </div>

      {!canManage ? (
        <p className="mt-3 rounded-xl border border-[#F8C830]/40 bg-[#F8C830]/15 p-3 text-sm text-[#102040]">
          Only owners and admins can refresh Meta phone status.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-3 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-sm text-[#15803d]">
          {success}
        </p>
      ) : null}
    </div>
  );
}
