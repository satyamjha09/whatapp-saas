import Link from "next/link";
import { DEVELOPER_WEBHOOK_EVENTS } from "@/server/config/developer-webhook-events";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";

const endpoints = [
  ["GET", "/api/partner/v1/clients", "partner:clients:read"],
  ["POST", "/api/partner/v1/clients", "partner:clients:create"],
  ["GET", "/api/partner/v1/clients/{clientId}", "partner:clients:read"],
  ["PATCH", "/api/partner/v1/clients/{clientId}", "partner:clients:update"],
  ["POST", "/api/partner/v1/clients/{clientId}/suspend", "partner:clients:suspend"],
  ["POST", "/api/partner/v1/clients/{clientId}/reactivate", "partner:clients:suspend"],
  ["GET", "/api/partner/v1/clients/{clientId}/usage", "partner:usage:read"],
  ["GET", "/api/partner/v1/subscriptions", "partner:subscriptions:read"],
  ["GET", "/api/partner/v1/invoices", "partner:invoices:read"],
  ["GET", "/api/partner/v1/commissions", "partner:commissions:read"],
  ["GET", "/api/partner/v1/payouts", "partner:payouts:read"],
] as const;

const partnerWebhookEvents = DEVELOPER_WEBHOOK_EVENTS.filter((event) =>
  event.id.startsWith("partner."),
);

function methodClass(method: string) {
  if (method === "GET") return "bg-blue-50 text-blue-700";
  if (method === "POST") return "bg-emerald-50 text-emerald-700";
  return "bg-amber-50 text-amber-700";
}

export default async function PartnerApiDocsPage() {
  await requireCompanyAdmin();

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
          Partner API
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
          Build partner integrations safely
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
          Use scoped API keys from this workspace to provision clients, read
          subscriptions, inspect usage, and receive partner lifecycle webhooks.
          The partner company is always derived from the API key.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard/developer/api-keys"
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white"
          >
            Manage API keys
          </Link>
          <Link
            href="/dashboard/developer/webhooks"
            className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-black text-emerald-700"
          >
            Manage webhooks
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-sm">
        <h2 className="text-xl font-black text-[#081B3A]">Endpoints</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-[0.14em] text-[#526173]">
                <th className="py-3 pr-4">Method</th>
                <th className="py-3 pr-4">Path</th>
                <th className="py-3 pr-4">Required scope</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(([method, path, scope]) => (
                <tr key={`${method}:${path}`} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${methodClass(
                        method,
                      )}`}
                    >
                      {method}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-[#081B3A]">
                    {path}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-[#526173]">
                    {scope}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-sm">
          <h2 className="text-xl font-black text-[#081B3A]">Authentication</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-emerald-100">
{`curl https://metawhat.in/api/partner/v1/clients \\
  -H "Authorization: Bearer mw_live_xxx"`}
          </pre>
          <p className="mt-4 text-sm leading-6 text-[#526173]">
            API keys support IP allowlists, daily usage limits, per-key rate
            limits, scopes, request logs, and revocation through the existing
            Developer API Keys page.
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-sm">
          <h2 className="text-xl font-black text-[#081B3A]">
            Partner webhook events
          </h2>
          <div className="mt-4 grid gap-2">
            {partnerWebhookEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3"
              >
                <p className="font-mono text-xs font-black text-emerald-800">
                  {event.id}
                </p>
                <p className="mt-1 text-xs text-[#526173]">{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
