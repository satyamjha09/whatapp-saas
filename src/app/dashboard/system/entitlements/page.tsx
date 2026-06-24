import { requireAdmin } from "@/server/auth/authorization";
import {
  getFeatureEntitlementHealth,
  listCompanyEntitlementOverrides,
  listPlanEntitlements,
} from "@/server/services/feature-entitlement.service";

export default async function FeatureEntitlementsPage() {
  const context = await requireAdmin();
  const [health, planEntitlements, overrides] = await Promise.all([
    getFeatureEntitlementHealth(),
    listPlanEntitlements(),
    listCompanyEntitlementOverrides({ companyId: context.membership.companyId }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">System</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Feature Entitlements</h1>
        <p className="mt-2 text-sm text-gray-600">
          Plan feature matrix, company overrides, and subscription gates.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Plan Rows", health.planEntitlements],
          ["Expected Rows", health.expectedPlanEntitlements],
          ["Active Overrides", health.activeOverrides],
          ["Blocked / 24h", health.blocked24h],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Plan Matrix</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Feature</th><th className="px-5 py-3">Enabled</th><th className="px-5 py-3">Limit</th></tr>
            </thead>
            <tbody className="divide-y">
              {planEntitlements.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">{item.billingPlan}</td>
                  <td className="px-5 py-4">{item.featureKey}</td>
                  <td className="px-5 py-4">{item.enabled ? "Yes" : "No"}</td>
                  <td className="px-5 py-4">{item.limitValue ?? "Unlimited"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Company Overrides</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-5 py-3">Feature</th><th className="px-5 py-3">Enabled</th><th className="px-5 py-3">Limit</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Created By</th></tr>
            </thead>
            <tbody className="divide-y">
              {overrides.map((override) => (
                <tr key={override.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">{override.featureKey}</td>
                  <td className="px-5 py-4">{override.enabledOverride === null ? "-" : override.enabledOverride ? "Yes" : "No"}</td>
                  <td className="px-5 py-4">{override.limitOverride ?? "-"}</td>
                  <td className="px-5 py-4">{override.reason ?? "-"}</td>
                  <td className="px-5 py-4">{override.expiresAt?.toLocaleString() ?? "-"}</td>
                  <td className="px-5 py-4">{override.createdBy?.email ?? "-"}</td>
                </tr>
              ))}
              {overrides.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No company overrides.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
