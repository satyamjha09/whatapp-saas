import { requireAdmin } from "@/server/auth/authorization";
import { getCampaignThroughputDashboard } from "@/server/services/campaign-throughput-guard.service";
import { ThroughputPolicyActions } from "./throughput-actions";

function modeClass(mode: string) {
  if (mode === "NORMAL") return "bg-green-50 text-green-700";
  if (mode === "SLOW") return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

function severityClass(severity: string) {
  if (severity === "CRITICAL") return "bg-red-50 text-red-700";
  if (severity === "WARNING") return "bg-yellow-50 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

export default async function CampaignThroughputPage() {
  const context = await requireAdmin();
  const dashboard = await getCampaignThroughputDashboard({
    companyId: context.membership.companyId,
  });

  const slowCount = dashboard.policies.filter((item) => item.mode === "SLOW").length;
  const pausedCount = dashboard.policies.filter((item) => item.mode === "PAUSED").length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Campaigns</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Campaign Throughput
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Control send speed, adaptive slowdown, and rate-limit protection for WhatsApp bulk campaigns.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Policies</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {dashboard.policies.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Slow</p>
          <p className="mt-2 text-2xl font-bold text-yellow-700">{slowCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Paused</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{pausedCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Events</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {dashboard.events.length}
          </p>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {dashboard.policies.map((policy) => (
          <article
            key={policy.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-gray-500">
                  {policy.campaignId}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${modeClass(
                      policy.mode,
                    )}`}
                  >
                    {policy.mode}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {policy.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  {policy.maxPerMinute}/minute / {policy.maxPerHour}/hour /{" "}
                  {policy.minDelayMs}ms minimum delay
                </p>
                {policy.rateLimitCooldownUntil ? (
                  <p className="mt-2 text-sm text-yellow-700">
                    Cooldown until {policy.rateLimitCooldownUntil.toLocaleString()}
                  </p>
                ) : null}
                {policy.updatedByUser ? (
                  <p className="mt-2 text-xs text-gray-500">
                    Last updated by{" "}
                    {policy.updatedByUser.name ?? policy.updatedByUser.email}
                  </p>
                ) : null}
              </div>
              <ThroughputPolicyActions
                campaignId={policy.campaignId}
                currentMode={policy.mode}
              />
            </div>
          </article>
        ))}

        {dashboard.policies.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-sm text-gray-500">
            No throughput policies yet. Launch a campaign to create one.
          </div>
        ) : null}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Throughput Events
          </h2>
        </div>
        <div className="divide-y">
          {dashboard.events.map((event) => (
            <div key={event.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClass(
                    event.severity,
                  )}`}
                >
                  {event.severity}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {event.type}
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {event.campaignId}
                </span>
              </div>
              <p className="mt-3 font-semibold text-gray-900">{event.title}</p>
              <p className="mt-1 text-sm text-gray-600">{event.message}</p>
              {event.errorMessage ? (
                <pre className="mt-3 overflow-auto rounded-xl bg-gray-950 p-3 text-xs text-gray-100">
                  {event.errorMessage}
                </pre>
              ) : null}
              <p className="mt-2 text-xs text-gray-500">
                {event.createdAt.toLocaleString()}
              </p>
            </div>
          ))}

          {dashboard.events.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No throughput events yet.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
