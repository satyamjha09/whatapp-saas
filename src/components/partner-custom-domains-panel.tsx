"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type DomainRecord = {
  id: string;
  domain: string;
  normalizedHost: string;
  verificationTxtName: string;
  verificationTxtValue: string;
  status: string;
  sslStatus: string;
  healthStatus: string;
  rejectionReason?: string | null;
  lastError?: string | null;
  dnsVerifiedAt?: string | Date | null;
  lastDnsCheckAt?: string | Date | null;
  lastSslCheckAt?: string | Date | null;
  lastHostResolvedAt?: string | Date | null;
  lastHealthCheckAt?: string | Date | null;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "Domain action failed.");
  }

  return payload as { domain?: DomainRecord };
}

function statusClass(status: string) {
  if (status === "APPROVED" || status === "DNS_VERIFIED") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "PENDING_APPROVAL" || status === "PENDING_DNS") {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "REJECTED" || status === "DISABLED") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

function healthClass(status: string) {
  if (status === "HEALTHY" || status === "ISSUED") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "PENDING" || status === "UNKNOWN") {
    return "bg-slate-100 text-slate-600";
  }
  return "bg-rose-100 text-rose-700";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Not checked";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function codeBox(value: string) {
  return (
    <code className="block rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-black text-slate-800">
      {value}
    </code>
  );
}

export function PartnerCustomDomainsPanel({
  endpoint,
  initialDomains,
  partnerCompanyId,
  showReviewActions = false,
}: {
  endpoint: string;
  initialDomains: DomainRecord[];
  partnerCompanyId?: string;
  showReviewActions?: boolean;
}) {
  const router = useRouter();
  const [domains, setDomains] = useState(initialDomains);
  const [domainInput, setDomainInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const approvedCount = useMemo(
    () => domains.filter((domain) => domain.status === "APPROVED").length,
    [domains],
  );

  function replaceDomain(next?: DomainRecord) {
    if (!next) return;
    setDomains((current) => {
      const exists = current.some((domain) => domain.id === next.id);
      return exists
        ? current.map((domain) => (domain.id === next.id ? next : domain))
        : [next, ...current];
    });
  }

  async function createDomain() {
    setLoadingAction("create");
    setError(null);
    setMessage(null);

    try {
      const payload = await postJson(endpoint, {
        partnerCompanyId,
        domain: domainInput,
      });
      replaceDomain(payload.domain);
      setDomainInput("");
      setMessage("Domain request created. Add the DNS records below next.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create domain.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function runAction(
    domainId: string,
    action:
      | "verify_dns"
      | "submit"
      | "approve"
      | "reject"
      | "disable"
      | "check_health",
  ) {
    setLoadingAction(`${domainId}:${action}`);
    setError(null);
    setMessage(null);

    try {
      const payload = await postJson(endpoint, {
        partnerCompanyId,
        domainId,
        action,
        rejectionReason:
          action === "reject" ? "Rejected by platform domain review." : undefined,
      });
      replaceDomain(payload.domain);
      setMessage(`Domain ${action.replace("_", " ")} action completed.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Domain action failed.");
    } finally {
      setLoadingAction(null);
    }
  }

  function actionButton(
    domainId: string,
    action:
      | "verify_dns"
      | "submit"
      | "approve"
      | "reject"
      | "disable"
      | "check_health",
    label: string,
    className = "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
  ) {
    const key = `${domainId}:${action}`;
    return (
      <button
        type="button"
        disabled={loadingAction === key}
        onClick={() => runAction(domainId, action)}
        className={`rounded-xl px-3 py-2 text-xs font-black disabled:opacity-60 ${className}`}
      >
        {loadingAction === key ? "Working..." : label}
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Custom domains
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Request a white-label domain
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Add a partner-owned domain, verify ownership with a TXT record,
              point traffic to MetaWhat, then submit it for platform approval.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            {approvedCount} approved
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <input
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder="portal.partnerdomain.com"
            className="min-h-12 flex-1 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
          <button
            type="button"
            disabled={loadingAction === "create"}
            onClick={createDomain}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {loadingAction === "create" ? "Adding..." : "Add domain"}
          </button>
        </div>

        {message ? (
          <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}
      </section>

      <div className="space-y-4">
        {domains.map((domain) => (
          <article
            key={domain.id}
            className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  {domain.normalizedHost}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                      domain.status,
                    )}`}
                  >
                    {domain.status}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${healthClass(
                      domain.healthStatus,
                    )}`}
                  >
                    Health {domain.healthStatus}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${healthClass(
                      domain.sslStatus,
                    )}`}
                  >
                    SSL {domain.sslStatus}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {actionButton(domain.id, "verify_dns", "Verify DNS")}
                {actionButton(domain.id, "check_health", "Check health")}
                {actionButton(domain.id, "submit", "Submit")}
                {showReviewActions ? (
                  <>
                    {actionButton(
                      domain.id,
                      "approve",
                      "Approve",
                      "bg-slate-950 text-white hover:bg-slate-800",
                    )}
                    {actionButton(
                      domain.id,
                      "reject",
                      "Reject",
                      "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
                    )}
                  </>
                ) : null}
                {actionButton(
                  domain.id,
                  "disable",
                  "Disable",
                  "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              </div>
            </div>

            {domain.rejectionReason ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {domain.rejectionReason}
              </div>
            ) : null}

            {domain.lastError ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                {domain.lastError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  DNS verification TXT
                </p>
                <div className="mt-3 space-y-2">
                  {codeBox(domain.verificationTxtName)}
                  {codeBox(domain.verificationTxtValue)}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Host routing
                </p>
                <div className="mt-3 space-y-2">
                  {codeBox(`${domain.normalizedHost} CNAME metawhat.in`)}
                  <p className="text-xs leading-5 text-slate-500">
                    Keep this DNS-only if your DNS provider has proxy mode until
                    platform approval and SSL health are green.
                  </p>
                </div>
              </section>
            </div>

            <dl className="mt-5 grid gap-3 text-xs text-slate-500 md:grid-cols-4">
              <div>
                <dt className="font-black uppercase tracking-[0.12em]">
                  DNS checked
                </dt>
                <dd className="mt-1 font-semibold">
                  {formatDate(domain.lastDnsCheckAt)}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-[0.12em]">
                  Host resolved
                </dt>
                <dd className="mt-1 font-semibold">
                  {formatDate(domain.lastHostResolvedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-[0.12em]">
                  SSL checked
                </dt>
                <dd className="mt-1 font-semibold">
                  {formatDate(domain.lastSslCheckAt)}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-[0.12em]">
                  Health checked
                </dt>
                <dd className="mt-1 font-semibold">
                  {formatDate(domain.lastHealthCheckAt)}
                </dd>
              </div>
            </dl>
          </article>
        ))}

        {domains.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-black text-slate-950">
              No custom domains yet.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Add the first partner domain to start DNS verification and
              approval.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
