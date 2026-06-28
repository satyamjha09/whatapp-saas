import { requireAdmin } from "@/server/auth/authorization";
import { getCampaignLaunchDashboard } from "@/server/services/campaign-launch-orchestrator.service";
import { ConfirmLaunchButton } from "./launch-actions";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

export default async function CampaignLaunchPage() {
  const context = await requireAdmin();
  const dashboard = await getCampaignLaunchDashboard({
    companyId: context.membership.companyId,
  });

  const reservedAmount = dashboard.reservations
    .filter((item) => item.status === "RESERVED")
    .reduce((sum, item) => sum + item.amountPaise, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Campaigns</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Campaign Launch Orchestrator
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Connects segments, variable mapping, dry run, wallet reservation, queueing, and campaign control.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Launch Runs</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {dashboard.launchRuns.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Running</p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {dashboard.launchRuns.filter((run) => run.status === "RUNNING").length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Queuing</p>
          <p className="mt-2 text-2xl font-bold text-yellow-700">
            {dashboard.launchRuns.filter((run) => run.status === "QUEUING").length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Reserved</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(reservedAmount)}
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Launch Runs</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Recipients</th>
                <th className="px-5 py-3">Cost</th>
                <th className="px-5 py-3">Messages</th>
                <th className="px-5 py-3">Created By</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboard.launchRuns.map((run) => (
                <tr key={run.id}>
                  <td className="px-5 py-4 font-mono text-xs">{run.campaignId}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{run.templateName}</p>
                    <p className="text-xs text-gray-500">{run.templateLanguage || "-"}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold">{run.status}</td>
                  <td className="px-5 py-4">
                    {run.validRecipients}/{run.totalRecipients}
                  </td>
                  <td className="px-5 py-4">{money(run.estimatedCostPaise)}</td>
                  <td className="px-5 py-4">
                    {run.queuedMessageCount}/{run.createdMessageCount}
                  </td>
                  <td className="px-5 py-4">{run.createdByUser?.email ?? "-"}</td>
                  <td className="px-5 py-4">
                    <ConfirmLaunchButton
                      launchRunId={run.id}
                      disabled={
                        !["DRY_RUN_CREATED", "DRY_RUN_CONFIRMED", "WALLET_RESERVED"].includes(run.status)
                      }
                    />
                  </td>
                </tr>
              ))}
              {dashboard.launchRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500">
                    No launch runs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
