"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

type WhatsAppSettings = {
  accountId: string | null;
  status: string;
  wabaId: string;
  hasAccessToken: boolean;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
};

type WhatsAppSettingsFormProps = {
  settings: WhatsAppSettings;
  canManage: boolean;
};

type SettingsResponse = {
  message: string;
  errors?: {
    wabaId?: string[];
    phoneNumberId?: string[];
    displayPhoneNumber?: string[];
    accessToken?: string[];
  };
};

type TestConnectionResponse = {
  message: string;
  connection?: {
    connected: boolean;
    displayPhoneNumber: string;
    verifiedName: string;
    qualityRating: string;
  };
};

const fieldClass =
  "w-full rounded-xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm text-[#102040] outline-none transition placeholder:text-[#526173]/60 focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10 disabled:cursor-not-allowed disabled:bg-[#E7F8EF] disabled:text-[#526173]";

export default function WhatsAppSettingsForm({
  settings,
  canManage,
}: WhatsAppSettingsFormProps) {
  const router = useRouter();
  const [wabaId, setWabaId] = useState(settings.wabaId);
  const [phoneNumberId, setPhoneNumberId] = useState(settings.phoneNumberId);
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(
    settings.displayPhoneNumber,
  );
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setTestResult("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/whatsapp/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wabaId,
          phoneNumberId,
          displayPhoneNumber,
          accessToken: accessToken.trim() ? accessToken.trim() : undefined,
        }),
      });
      const data: SettingsResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.wabaId?.[0] ??
          data.errors?.phoneNumberId?.[0] ??
          data.errors?.displayPhoneNumber?.[0] ??
          data.errors?.accessToken?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setAccessToken("");
      setSuccess("WhatsApp settings saved securely.");
      router.refresh();
    } catch {
      setError("Unable to save WhatsApp settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    setError("");
    setSuccess("");
    setTestResult("");
    setIsTesting(true);

    try {
      const response = await fetch("/api/whatsapp/settings/test", {
        method: "POST",
      });
      const data: TestConnectionResponse = await response.json();

      if (!response.ok || !data.connection) {
        setError(data.message);
        return;
      }

      setTestResult(
        `${data.connection.verifiedName || "WhatsApp number"} connected - ${data.connection.displayPhoneNumber} - quality ${data.connection.qualityRating}`,
      );
      router.refresh();
    } catch {
      setError("Unable to test WhatsApp connection. Please try again.");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <form onSubmit={saveSettings} className="space-y-5">
      <div className="rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#128C7E]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#081B3A]">
              Token: {settings.hasAccessToken ? "Saved securely" : "Not configured"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#526173]">
              The token is encrypted in the database. Its saved value is never
              sent to the browser, logs, or audit metadata.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="wabaId" className="mb-2 block text-sm font-medium text-[#102040]">
            WABA ID
          </label>
          <input
            id="wabaId"
            value={wabaId}
            onChange={(event) => setWabaId(event.target.value)}
            disabled={!canManage}
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="phoneNumberId" className="mb-2 block text-sm font-medium text-[#102040]">
            Phone Number ID
          </label>
          <input
            id="phoneNumberId"
            value={phoneNumberId}
            onChange={(event) => setPhoneNumberId(event.target.value)}
            disabled={!canManage}
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="displayPhoneNumber" className="mb-2 block text-sm font-medium text-[#102040]">
            Display Phone Number
          </label>
          <input
            id="displayPhoneNumber"
            value={displayPhoneNumber}
            onChange={(event) => setDisplayPhoneNumber(event.target.value)}
            disabled={!canManage}
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="accessToken" className="mb-2 block text-sm font-medium text-[#102040]">
            Replace Access Token
          </label>
          <input
            id="accessToken"
            type="password"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            disabled={!canManage}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              settings.hasAccessToken
                ? "Leave blank to keep existing token"
                : "Paste token once"
            }
            className={fieldClass}
          />
          <p className="mt-2 text-xs text-[#526173]">
            Enter a value only when adding or replacing the token. This field
            clears immediately after a successful save.
          </p>
        </div>
      </div>

      {!canManage ? (
        <p className="rounded-xl border border-[#F8C830]/40 bg-[#F8C830]/15 p-3 text-sm text-[#102040]">
          Only owners and admins can update or test WhatsApp settings.
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
      {testResult ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-sm text-[#15803d]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {testResult}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!canManage || isSaving || isTesting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save settings"}
        </button>
        <button
          type="button"
          onClick={testConnection}
          disabled={
            !canManage ||
            !settings.hasAccessToken ||
            isSaving ||
            isTesting
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#BFE9D0] bg-white px-4 py-2.5 text-sm font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isTesting ? "animate-spin" : ""}`} />
          {isTesting ? "Testing..." : "Test connection"}
        </button>
      </div>
    </form>
  );
}
