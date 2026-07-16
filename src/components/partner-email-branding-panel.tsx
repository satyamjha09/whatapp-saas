"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EmailBrandingValue = {
  fromName?: string | null;
  fromAddress?: string | null;
  replyTo?: string | null;
  sendingDomain?: string | null;
  status?: string;
  spfVerified?: boolean;
  dkimVerified?: boolean;
  dmarcVerified?: boolean;
  spfHost?: string | null;
  spfValue?: string | null;
  dkimHost?: string | null;
  dkimValue?: string | null;
  dmarcHost?: string | null;
  dmarcValue?: string | null;
  verifiedAt?: string | Date | null;
  lastCheckedAt?: string | Date | null;
  failureReason?: string | null;
  footerText?: string | null;
  logoUrl?: string | null;
};

type Analytics = {
  sent30d: number;
  failed: number;
  queued: number;
  notificationSent: number;
  billingSent: number;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "Email branding action failed.");
  }

  return payload as { emailBranding?: EmailBrandingValue };
}

function inputClass() {
  return "mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
}

function labelClass() {
  return "text-xs font-black uppercase tracking-[0.14em] text-slate-500";
}

function statusClass(status?: string) {
  if (status === "VERIFIED") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING_DNS") return "bg-amber-100 text-amber-700";
  if (status === "FAILED" || status === "DISABLED") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Not checked";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function codeBox(label: string, value?: string | null) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <code className="mt-1 block rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-black text-slate-800">
        {value || "Save sender domain to generate"}
      </code>
    </div>
  );
}

function checkMark(value?: boolean) {
  return value ? "Verified" : "Missing";
}

export function PartnerEmailBrandingPanel({
  endpoint,
  initialEmailBranding,
  partnerCompanyId,
  analytics,
}: {
  endpoint: string;
  initialEmailBranding: EmailBrandingValue;
  partnerCompanyId: string;
  analytics?: Analytics | null;
}) {
  const router = useRouter();
  const [emailBranding, setEmailBranding] = useState(initialEmailBranding);
  const [form, setForm] = useState({
    fromName: initialEmailBranding.fromName ?? "",
    fromAddress: initialEmailBranding.fromAddress ?? "",
    replyTo: initialEmailBranding.replyTo ?? "",
    sendingDomain: initialEmailBranding.sendingDomain ?? "",
    footerText: initialEmailBranding.footerText ?? "",
    logoUrl: initialEmailBranding.logoUrl ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft() {
    setLoadingAction("save");
    setError(null);
    setMessage(null);

    try {
      const payload = await postJson(endpoint, {
        partnerCompanyId,
        ...form,
      });
      if (payload.emailBranding) setEmailBranding(payload.emailBranding);
      setMessage("Email branding saved. Add DNS records before sending as this domain.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save email branding.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function runAction(action: "check_dns" | "verify" | "disable") {
    setLoadingAction(action);
    setError(null);
    setMessage(null);

    try {
      const payload = await postJson(endpoint, {
        partnerCompanyId,
        action,
      });
      if (payload.emailBranding) setEmailBranding(payload.emailBranding);
      setMessage(`Email branding ${action.replace("_", " ")} completed.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email branding action failed.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              White-label email
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Sender identity
            </h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              emailBranding.status,
            )}`}
          >
            {emailBranding.status ?? "DRAFT"}
          </span>
        </div>

        {emailBranding.failureReason ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            {emailBranding.failureReason}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClass()}>From name</span>
            <input
              className={inputClass()}
              value={form.fromName}
              onChange={(event) => update("fromName", event.target.value)}
              placeholder="Partner Support"
            />
          </label>
          <label>
            <span className={labelClass()}>From email</span>
            <input
              className={inputClass()}
              value={form.fromAddress}
              onChange={(event) => update("fromAddress", event.target.value)}
              placeholder="hello@partner.com"
            />
          </label>
          <label>
            <span className={labelClass()}>Reply-to email</span>
            <input
              className={inputClass()}
              value={form.replyTo}
              onChange={(event) => update("replyTo", event.target.value)}
              placeholder="support@partner.com"
            />
          </label>
          <label>
            <span className={labelClass()}>Sending domain</span>
            <input
              className={inputClass()}
              value={form.sendingDomain}
              onChange={(event) => update("sendingDomain", event.target.value)}
              placeholder="partner.com"
            />
          </label>
          <label className="md:col-span-2">
            <span className={labelClass()}>Logo URL</span>
            <input
              className={inputClass()}
              value={form.logoUrl}
              onChange={(event) => update("logoUrl", event.target.value)}
              placeholder="https://cdn.partner.com/email-logo.png"
            />
          </label>
          <label className="md:col-span-2">
            <span className={labelClass()}>Email footer</span>
            <textarea
              className={`${inputClass()} min-h-24 resize-none`}
              value={form.footerText}
              onChange={(event) => update("footerText", event.target.value)}
              placeholder="You are receiving this email because you use our WhatsApp workspace."
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loadingAction === "save"}
            onClick={saveDraft}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {loadingAction === "save" ? "Saving..." : "Save sender"}
          </button>
          <button
            type="button"
            disabled={loadingAction === "check_dns"}
            onClick={() => runAction("check_dns")}
            className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          >
            {loadingAction === "check_dns" ? "Checking..." : "Check DNS"}
          </button>
          <button
            type="button"
            disabled={loadingAction === "disable"}
            onClick={() => runAction("disable")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Disable
          </button>
        </div>

        {message ? (
          <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            DNS records
          </p>
          <div className="mt-4 space-y-4">
            {codeBox("SPF host", emailBranding.spfHost)}
            {codeBox("SPF value", emailBranding.spfValue)}
            {codeBox("DKIM host", emailBranding.dkimHost)}
            {codeBox("DKIM value", emailBranding.dkimValue)}
            {codeBox("DMARC host", emailBranding.dmarcHost)}
            {codeBox("DMARC value", emailBranding.dmarcValue)}
          </div>
          <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-600">
            <div>SPF: {checkMark(emailBranding.spfVerified)}</div>
            <div>DKIM: {checkMark(emailBranding.dkimVerified)}</div>
            <div>DMARC: {checkMark(emailBranding.dmarcVerified)}</div>
            <div>Last checked: {formatDate(emailBranding.lastCheckedAt)}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Delivery analytics
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-2xl font-black text-slate-950">
                {analytics?.sent30d ?? 0}
              </p>
              <p className="text-xs font-semibold text-slate-500">Sent 30d</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-2xl font-black text-slate-950">
                {analytics?.failed ?? 0}
              </p>
              <p className="text-xs font-semibold text-slate-500">Failed</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-2xl font-black text-slate-950">
                {analytics?.queued ?? 0}
              </p>
              <p className="text-xs font-semibold text-slate-500">Queued</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Notification and billing email deliveries use the verified sender
            only after SPF, DKIM, and DMARC pass. Until then, MetaWhat SMTP is
            used with partner branding and reply-to.
          </p>
        </section>
      </aside>
    </div>
  );
}
