"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BrandingValue = {
  appName?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  markUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  supportName?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  loginHeading?: string | null;
  loginDescription?: string | null;
  hideMetaWhatBranding?: boolean;
  status?: string;
  rejectionReason?: string | null;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "Branding action failed.");
  }

  return payload;
}

function inputClass() {
  return "mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
}

function labelClass() {
  return "text-xs font-black uppercase tracking-[0.14em] text-slate-500";
}

export function PartnerBrandingForm({
  endpoint,
  initialBranding,
  partnerCompanyId,
  showReviewActions = false,
}: {
  endpoint: string;
  initialBranding: BrandingValue;
  partnerCompanyId: string;
  showReviewActions?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    appName: initialBranding.appName ?? "",
    companyName: initialBranding.companyName ?? "",
    logoUrl: initialBranding.logoUrl ?? "",
    logoDarkUrl: initialBranding.logoDarkUrl ?? "",
    markUrl: initialBranding.markUrl ?? "",
    faviconUrl: initialBranding.faviconUrl ?? "",
    primaryColor: initialBranding.primaryColor ?? "#128C7E",
    secondaryColor: initialBranding.secondaryColor ?? "#25D366",
    accentColor: initialBranding.accentColor ?? "#4F46E5",
    backgroundColor: initialBranding.backgroundColor ?? "#E7F8EF",
    textColor: initialBranding.textColor ?? "#081B3A",
    supportName: initialBranding.supportName ?? "",
    supportEmail: initialBranding.supportEmail ?? "",
    supportPhone: initialBranding.supportPhone ?? "",
    loginHeading: initialBranding.loginHeading ?? "",
    loginDescription: initialBranding.loginDescription ?? "",
    hideMetaWhatBranding: Boolean(initialBranding.hideMetaWhatBranding),
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await postJson(endpoint, {
        partnerCompanyId,
        ...form,
      });
      setMessage("Branding draft saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save branding.");
    } finally {
      setLoading(false);
    }
  }

  async function transition(action: "submit" | "approve" | "reject" | "disable") {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await postJson(endpoint, {
        action,
        partnerCompanyId,
        rejectionReason:
          action === "reject" ? "Rejected from branding review." : undefined,
      });
      setMessage(`Branding ${action.replace("_", " ")} action completed.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Branding action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Brand settings
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              White-label identity
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {initialBranding.status ?? "DRAFT"}
          </span>
        </div>

        {initialBranding.rejectionReason ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {initialBranding.rejectionReason}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClass()}>App name</span>
            <input
              className={inputClass()}
              value={form.appName}
              onChange={(event) => update("appName", event.target.value)}
              placeholder="Partner app name"
            />
          </label>
          <label>
            <span className={labelClass()}>Company name</span>
            <input
              className={inputClass()}
              value={form.companyName}
              onChange={(event) => update("companyName", event.target.value)}
              placeholder="Legal or public company name"
            />
          </label>
          <label>
            <span className={labelClass()}>Logo URL</span>
            <input
              className={inputClass()}
              value={form.logoUrl}
              onChange={(event) => update("logoUrl", event.target.value)}
              placeholder="https://cdn.example.com/logo.png"
            />
          </label>
          <label>
            <span className={labelClass()}>Mark URL</span>
            <input
              className={inputClass()}
              value={form.markUrl}
              onChange={(event) => update("markUrl", event.target.value)}
              placeholder="https://cdn.example.com/mark.png"
            />
          </label>
          <label>
            <span className={labelClass()}>Primary color</span>
            <input
              className={inputClass()}
              value={form.primaryColor}
              onChange={(event) => update("primaryColor", event.target.value)}
              placeholder="#128C7E"
            />
          </label>
          <label>
            <span className={labelClass()}>Secondary color</span>
            <input
              className={inputClass()}
              value={form.secondaryColor}
              onChange={(event) => update("secondaryColor", event.target.value)}
              placeholder="#25D366"
            />
          </label>
          <label>
            <span className={labelClass()}>Accent color</span>
            <input
              className={inputClass()}
              value={form.accentColor}
              onChange={(event) => update("accentColor", event.target.value)}
              placeholder="#4F46E5"
            />
          </label>
          <label>
            <span className={labelClass()}>Background color</span>
            <input
              className={inputClass()}
              value={form.backgroundColor}
              onChange={(event) => update("backgroundColor", event.target.value)}
              placeholder="#E7F8EF"
            />
          </label>
          <label>
            <span className={labelClass()}>Support name</span>
            <input
              className={inputClass()}
              value={form.supportName}
              onChange={(event) => update("supportName", event.target.value)}
              placeholder="Partner Support"
            />
          </label>
          <label>
            <span className={labelClass()}>Support email</span>
            <input
              className={inputClass()}
              value={form.supportEmail}
              onChange={(event) => update("supportEmail", event.target.value)}
              placeholder="support@example.com"
            />
          </label>
          <label className="md:col-span-2">
            <span className={labelClass()}>Login heading</span>
            <input
              className={inputClass()}
              value={form.loginHeading}
              onChange={(event) => update("loginHeading", event.target.value)}
              placeholder="Run WhatsApp growth from one workspace"
            />
          </label>
          <label className="md:col-span-2">
            <span className={labelClass()}>Login description</span>
            <textarea
              className={`${inputClass()} min-h-24 resize-none`}
              value={form.loginDescription}
              onChange={(event) => update("loginDescription", event.target.value)}
              placeholder="Short description for partner-branded auth screens."
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 md:col-span-2">
            <input
              type="checkbox"
              checked={form.hideMetaWhatBranding}
              onChange={(event) =>
                update("hideMetaWhatBranding", event.target.checked)
              }
            />
            <span className="text-sm font-semibold text-slate-700">
              Hide MetaWhat co-branding after approval
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={saveDraft}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => transition("submit")}
            className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          >
            Submit for review
          </button>
          {showReviewActions ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => transition("approve")}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => transition("reject")}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => transition("disable")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Disable
              </button>
            </>
          ) : null}
        </div>
        {message ? (
          <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}
      </section>

      <aside className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
          Live preview
        </p>
        <div
          className="mt-4 rounded-3xl border p-5 shadow-inner"
          style={{
            background: form.backgroundColor || "#E7F8EF",
            color: form.textColor || "#081B3A",
            borderColor: form.primaryColor || "#128C7E",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white">
              {form.markUrl || form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.markUrl || form.logoUrl}
                  alt=""
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <span className="text-lg font-black">
                  {(form.appName || "M").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-lg font-black">{form.appName || "Partner App"}</p>
              <p className="text-sm opacity-70">
                {form.companyName || "Partner company"}
              </p>
            </div>
          </div>
          <h3 className="mt-8 text-2xl font-black">
            {form.loginHeading || "Run WhatsApp growth from one workspace"}
          </h3>
          <p className="mt-3 text-sm leading-6 opacity-75">
            {form.loginDescription ||
              "Connect WhatsApp, create templates, import contacts, send campaigns, and measure every reply."}
          </p>
          <button
            type="button"
            className="mt-6 rounded-xl px-4 py-2 text-sm font-black text-white"
            style={{ background: form.primaryColor || "#128C7E" }}
          >
            Continue
          </button>
          {!form.hideMetaWhatBranding ? (
            <p className="mt-5 text-xs font-semibold opacity-60">
              Powered by MetaWhat
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
