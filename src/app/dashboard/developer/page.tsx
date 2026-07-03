import {
  CheckCircle2,
  ClipboardList,
  Code2,
  DatabaseZap,
  FileText,
  Gauge,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Split,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getDeveloperApiKeyAnalytics } from "@/server/services/developer-api-request-log.service";
import { getCompanyFeatureAccess } from "@/server/services/feature-gate.service";
import EditApiKeyButton from "./api-keys/edit-api-key-button";
import RevokeApiKeyButton from "./api-keys/revoke-api-key-button";
import RetentionCleanupButton from "./retention-cleanup-button";

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  status?: "Live" | "Roadmap";
};

const featureCards = [
  {
    icon: MessageSquareText,
    title: "WhatsApp Messaging API",
    description:
      "Send template messages, reminders, payment alerts, invoice updates, and customer notifications.",
    status: "Live",
  },
  {
    icon: DatabaseZap,
    title: "Tally Data Sync API",
    description:
      "Sync customers, ledgers, invoices, vouchers, stock items, and payment status from Tally.",
    status: "Roadmap",
  },
  {
    icon: FileText,
    title: "Invoice Automation",
    description:
      "Create workflows for invoice reminders, due payments, delivery updates, and confirmation messages.",
    status: "Roadmap",
  },
  {
    icon: Webhook,
    title: "Developer Webhooks",
    description:
      "Deliver signed real-time events to your systems with retry handling and outbox visibility.",
    status: "Live",
  },
  {
    icon: KeyRound,
    title: "Secure API Keys",
    description:
      "Manage API keys, rotate credentials, restrict access, and protect business data with scopes.",
    status: "Live",
  },
  {
    icon: Split,
    title: "Multi-Tenant Ready",
    description:
      "Build integrations for multiple businesses, branches, accountants, and finance teams.",
    status: "Live",
  },
];

const steps = [
  {
    title: "Create API Key",
    description: "Generate a scoped API key from your metawhat dashboard.",
  },
  {
    title: "Connect WhatsApp",
    description: "Connect Cloud API credentials and approved templates.",
  },
  {
    title: "Call the API",
    description: "Use REST endpoints to send messages or sync consent data.",
  },
  {
    title: "Track Everything",
    description: "Monitor logs, rate limits, failures, retries, and webhooks.",
  },
];

const endpointGroups: Array<{ title: string; endpoints: Endpoint[] }> = [
  {
    title: "Authentication",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/openapi.json",
        description: "Download the public OpenAPI schema.",
        status: "Live",
      },
      {
        method: "GET",
        path: "/api/developer/api-keys",
        description: "Manage dashboard API keys.",
        status: "Live",
      },
    ],
  },
  {
    title: "Messages",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/messages/send-template",
        description: "Send an approved WhatsApp template message.",
        status: "Live",
      },
      {
        method: "GET",
        path: "/api/public/messages/{message_id}",
        description: "Fetch public message status.",
        status: "Live",
      },
      {
        method: "GET",
        path: "/api/messages",
        description: "View workspace message history.",
        status: "Live",
      },
    ],
  },
  {
    title: "Contacts",
    endpoints: [
      {
        method: "GET",
        path: "/api/public/contacts",
        description: "List public contacts for integrations.",
        status: "Live",
      },
      {
        method: "POST",
        path: "/api/v1/contacts/consent",
        description: "Record customer consent safely.",
        status: "Live",
      },
      {
        method: "POST",
        path: "/api/contacts/import",
        description: "Import contacts into the workspace.",
        status: "Live",
      },
    ],
  },
  {
    title: "Invoices and Tally Sync",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/invoices",
        description: "Fetch synced invoices.",
        status: "Roadmap",
      },
      {
        method: "POST",
        path: "/api/v1/invoices/reminder",
        description: "Trigger invoice reminder workflow.",
        status: "Roadmap",
      },
      {
        method: "POST",
        path: "/api/v1/tally/sync",
        description: "Start a Tally data sync run.",
        status: "Roadmap",
      },
    ],
  },
  {
    title: "Webhooks",
    endpoints: [
      {
        method: "POST",
        path: "/api/developer/webhooks",
        description: "Create a signed webhook endpoint.",
        status: "Live",
      },
      {
        method: "GET",
        path: "/api/developer/webhooks/outbox",
        description: "Inspect webhook delivery attempts.",
        status: "Live",
      },
    ],
  },
];

const codeExamples = [
  {
    title: "Send WhatsApp Message",
    code: `const res = await fetch("https://api.metawhat.com/api/v1/messages/send-template", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    phone: "+919876543210",
    template: "payment_reminder",
    variables: {
      name: "Amit",
      amount: "INR 8,450",
      due_date: "25 June 2026"
    }
  })
});`,
  },
  {
    title: "Record Consent",
    code: `await fetch("https://api.metawhat.com/api/v1/contacts/consent", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    phone: "+919876543210",
    consent: "GRANTED",
    source: "checkout_form"
  })
});`,
  },
  {
    title: "Webhook Payload",
    code: `{
  "event": "message.delivered",
  "message_id": "msg_123456",
  "phone": "+919876543210",
  "status": "delivered",
  "timestamp": "2026-06-28T10:30:00Z"
}`,
  },
];

const securityCards = [
  { icon: LockKeyhole, title: "HTTPS Only" },
  { icon: RotateCcw, title: "API Key Rotation" },
  { icon: ShieldCheck, title: "Webhook Signatures" },
  { icon: ClipboardList, title: "Audit Logs" },
];

const rateLimits = [
  { plan: "Free", limit: "100 requests/day" },
  { plan: "Starter", limit: "5,000 requests/day" },
  { plan: "Growth", limit: "50,000 requests/day" },
  { plan: "Enterprise", limit: "Custom limits" },
];

const developerExperience = [
  "REST API",
  "JSON request/response",
  "Webhook events",
  "Error codes",
  "Retry handling",
  "API logs",
  "Sandbox testing",
  "Production keys",
];

function formatDateTime(date: Date | null) {
  if (!date) return "Never";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderExpiry(expiresAt: Date | null) {
  if (!expiresAt) {
    return <span className="text-xs text-[#64748B]">Never</span>;
  }

  if (expiresAt < new Date()) {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        Expired
      </span>
    );
  }

  return <span className="text-[#64748B]">{formatDateTime(expiresAt)}</span>;
}

function methodClass(method: Endpoint["method"]) {
  if (method === "POST") return "bg-green-50 text-green-700";
  if (method === "PATCH") return "bg-amber-50 text-amber-700";
  if (method === "DELETE") return "bg-red-50 text-red-700";
  return "bg-emerald-50 text-emerald-700";
}

function statusPill(status?: "Live" | "Roadmap") {
  if (status === "Roadmap") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-green-200 bg-green-50 text-green-700";
}

export default async function DeveloperPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const canManageApiKeys =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const [apiKeyAnalytics, featureAccess] = await Promise.all([
    getDeveloperApiKeyAnalytics(context.membership.companyId),
    getCompanyFeatureAccess(context.membership.companyId),
  ]);

  return (
    <main className="bg-white px-4 py-6 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] space-y-10">
        <section className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-gradient-to-br from-[#EFF6FF] via-white to-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-medium text-[#2563EB] shadow-sm">
                Developer API
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-[#0F172A] md:text-5xl">
                Build powerful Tally and WhatsApp workflows with one simple API
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#64748B]">
                Connect business systems, automate WhatsApp messages, manage
                contacts and consent, monitor API logs, and receive signed
                webhook events using the metawhat Developer API.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard/developer/docs"
                  className="rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(37,99,235,0.24)] transition hover:bg-[#1D4ED8]"
                >
                  View API Docs
                </Link>
                <Link
                  href="/dashboard/developer/api-keys"
                  className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#EFF6FF]"
                >
                  Get API Key
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <span className="font-mono text-xs text-slate-400">
                  POST /api/v1/messages/send-template
                </span>
              </div>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-slate-100">
                <code>{`const response = await fetch("https://api.metawhat.com/api/v1/messages/send-template", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    phone: "+91XXXXXXXXXX",
    template: "invoice_reminder",
    variables: {
      customer_name: "Rahul Sharma",
      invoice_no: "INV-1024",
      amount: "INR 12,500"
    }
  })
});`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusPill(
                      feature.status as "Live" | "Roadmap",
                    )}`}
                  >
                    {feature.status}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-bold text-[#0F172A]">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-[#E2E8F0] bg-[#F4FCF7] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#2563EB]">How it works</p>
              <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">
                From API key to automated workflows
              </h2>
            </div>
            <Link
              href="/dashboard/developer/logs"
              className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A]"
            >
              View logs
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-2xl bg-white p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2563EB] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-bold text-[#0F172A]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-sm font-medium text-[#2563EB]">Endpoint preview</p>
            <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">
              Clean REST endpoints for business automation
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {endpointGroups.map((group) => (
              <article
                key={group.title}
                className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
              >
                <div className="border-b border-[#E2E8F0] bg-[#EFF6FF] px-5 py-4">
                  <h3 className="font-bold text-[#0F172A]">{group.title}</h3>
                </div>
                <div className="divide-y divide-[#E2E8F0]">
                  {group.endpoints.map((endpoint) => (
                    <div
                      key={`${endpoint.method}-${endpoint.path}`}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[72px_1fr_auto]"
                    >
                      <span
                        className={`h-fit rounded-full px-2.5 py-1 text-center text-xs font-bold ${methodClass(
                          endpoint.method,
                        )}`}
                      >
                        {endpoint.method}
                      </span>
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#0F172A]">
                          {endpoint.path}
                        </p>
                        <p className="mt-1 text-sm text-[#64748B]">
                          {endpoint.description}
                        </p>
                      </div>
                      <span
                        className={`h-fit rounded-full border px-2 py-1 text-xs font-medium ${statusPill(
                          endpoint.status,
                        )}`}
                      >
                        {endpoint.status ?? "Live"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {codeExamples.map((example) => (
            <article
              key={example.title}
              className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-5 py-4">
                <Code2 className="h-4 w-4 text-[#2563EB]" />
                <h3 className="font-bold text-[#0F172A]">{example.title}</h3>
              </div>
              <pre className="min-h-80 overflow-x-auto bg-[#0B1220] p-5 text-xs leading-5 text-slate-100">
                <code>{example.code}</code>
              </pre>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A]">
                  Security built for business data
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">
                  metawhat APIs protect financial, customer, and
                  communication data with secure API keys, encrypted transport,
                  scoped access, webhook signatures, and detailed audit logs.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {securityCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.title}
                    className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F4FCF7] p-4"
                  >
                    <Icon className="h-5 w-5 text-[#2563EB]" />
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {card.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-[#2563EB]" />
              <h2 className="text-xl font-bold text-[#0F172A]">Rate limits</h2>
            </div>
            <div className="mt-5 divide-y divide-[#E2E8F0]">
              {rateLimits.map((item) => (
                <div
                  key={item.plan}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span className="font-semibold text-[#0F172A]">
                    {item.plan}
                  </span>
                  <span className="text-sm text-[#64748B]">{item.limit}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-2xl bg-[#EFF6FF] p-4 text-sm leading-6 text-[#64748B]">
              Rate limits protect platform stability and can be increased for
              verified business use cases.
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ServerCog className="h-5 w-5 text-[#2563EB]" />
            <h2 className="text-xl font-bold text-[#0F172A]">
              Developer experience
            </h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {developerExperience.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-[#F4FCF7] p-4 text-sm font-semibold text-[#0F172A]"
              >
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#E2E8F0] bg-gradient-to-br from-[#2563EB] to-[#0F172A] p-8 text-white shadow-[0_24px_70px_rgba(37,99,235,0.24)]">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold">
                Start building with metawhat API
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100">
                Automate your Tally and WhatsApp workflows with secure APIs
                built for modern businesses.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/developer/api-keys"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#2563EB]"
              >
                Get API Key
              </Link>
              <Link
                href="/dashboard/developer/docs"
                className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white"
              >
                Read Documentation
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#081B3A]">
                Developer Data Retention
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[#526173]">
                API request logs, webhook deliveries, and terminal outbox
                events are retained according to your current plan.
              </p>
            </div>
            {canManageApiKeys && <RetentionCleanupButton />}
          </div>
          <div className="mt-5 rounded-xl bg-[#E7F8EF] p-4">
            <p className="text-sm text-[#526173]">Retention Period</p>
            <p className="mt-1 text-2xl font-bold text-[#081B3A]">
              {featureAccess.plan.developerLogRetentionDays} days
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white shadow-sm">
          <div className="border-b border-[#BFE9D0] bg-[#E7F8EF] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#081B3A]">
                  Live API Key Analytics
                </h2>
                <p className="mt-1 text-sm text-[#526173]">
                  Per-key request totals from the last 24 hours.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#526173]">
                {apiKeyAnalytics.length} key(s)
              </span>
            </div>
          </div>

          {apiKeyAnalytics.length === 0 ? (
            <div className="p-6 text-sm text-[#526173]">
              No API keys created yet.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F4FCF7] text-xs uppercase text-[#526173]">
                  <tr>
                    <th className="px-6 py-3">Key</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Scopes</th>
                    <th className="px-6 py-3">Allowed IPs</th>
                    <th className="px-6 py-3">Expires</th>
                    <th className="px-6 py-3">Last Used</th>
                    <th className="px-6 py-3">Total 24h</th>
                    <th className="px-6 py-3">Success</th>
                    <th className="px-6 py-3">Failed</th>
                    <th className="px-6 py-3">Blocked</th>
                    <th className="px-6 py-3">Rate Limited</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#BFE9D0]">
                  {apiKeyAnalytics.map((item) => (
                    <tr key={item.apiKey.id}>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/developer/logs?apiKeyId=${item.apiKey.id}`}
                          className="font-semibold text-[#081B3A] hover:text-[#128C7E] hover:underline"
                        >
                          {item.apiKey.name}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-[#526173]">
                          {item.apiKey.keyPrefix}...{item.apiKey.keyLast4}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        {item.apiKey.revokedAt ||
                        item.apiKey.status === "REVOKED" ? (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            Revoked
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex max-w-sm flex-wrap gap-1">
                          {item.apiKey.scopes.length === 0 ? (
                            <span className="rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
                              No scopes
                            </span>
                          ) : (
                            item.apiKey.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                              >
                                {scope.replaceAll("_", " ")}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {item.apiKey.allowedIps.length === 0 ? (
                          <span className="text-xs text-[#526173]">
                            Any IP
                          </span>
                        ) : (
                          <div className="flex max-w-sm flex-wrap gap-1">
                            {item.apiKey.allowedIps.map((ip) => (
                              <span
                                key={ip}
                                className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                              >
                                {ip}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {renderExpiry(item.apiKey.expiresAt)}
                      </td>

                      <td className="px-6 py-4 text-[#526173]">
                        {formatDateTime(item.apiKey.lastUsedAt)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#081B3A]">
                        {item.total24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-emerald-700">
                        {item.success24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-red-700">
                        {item.failed24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-amber-700">
                        {item.blocked24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-[#128C7E]">
                        {item.rateLimited24h.toLocaleString("en-IN")}
                      </td>

                      <td className="px-6 py-4">
                        {canManageApiKeys ? (
                          <div className="flex flex-wrap gap-2">
                            {!(
                              item.apiKey.revokedAt ||
                              item.apiKey.status === "REVOKED"
                            ) && (
                              <EditApiKeyButton
                                apiKeyId={item.apiKey.id}
                                name={item.apiKey.name}
                                scopes={item.apiKey.scopes}
                                allowedIps={item.apiKey.allowedIps}
                                expiresAt={
                                  item.apiKey.expiresAt
                                    ? item.apiKey.expiresAt.toISOString()
                                    : null
                                }
                              />
                            )}
                            <RevokeApiKeyButton
                              apiKeyId={item.apiKey.id}
                              isRevoked={Boolean(
                                item.apiKey.revokedAt ||
                                  item.apiKey.status === "REVOKED",
                              )}
                            />
                          </div>
                        ) : (
                          <span className="text-[#526173]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
