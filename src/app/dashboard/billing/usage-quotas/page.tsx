import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { listCompanyUsageQuotas } from "@/server/services/usage-quota.service";

function formatFeatureKey(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default async function UsageQuotasPage() {
  const context = await requireAuthenticatedWorkspace();

  const quotas = await listCompanyUsageQuotas({
    companyId: context.membership.companyId,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Usage Quotas</h1>
        <p className="mt-2 text-sm text-gray-600">
          Current usage against plan limits.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {quotas.map((quota) => {
          const percentage =
            quota.limitValue === null || quota.limitValue === 0
              ? 0
              : Math.min((quota.usedCount / quota.limitValue) * 100, 100);

          return (
            <article
              key={quota.id}
              className="rounded-lg border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatFeatureKey(quota.featureKey)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {quota.periodType}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    quota.enabled
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {quota.enabled ? "Enabled" : "Blocked"}
                </span>
              </div>

              <p className="mt-5 text-3xl font-bold text-gray-900">
                {quota.usedCount}
                <span className="text-base font-medium text-gray-500">
                  {" "}
                  / {quota.limitValue ?? "Unlimited"}
                </span>
              </p>

              {quota.limitValue !== null && (
                <div className="mt-4 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-gray-900"
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              )}

              <p className="mt-3 text-xs text-gray-500">
                Remaining: {quota.remaining ?? "Unlimited"}
              </p>
            </article>
          );
        })}

        {quotas.length === 0 && (
          <section className="rounded-lg border bg-white p-6 shadow-sm md:col-span-3">
            <p className="text-sm text-gray-500">
              No usage counters yet. Run <code>npm run quotas:sync</code>.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
