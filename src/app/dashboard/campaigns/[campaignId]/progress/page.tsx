import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  CampaignLaunchOrchestratorError,
  getCampaignLaunchProgress,
} from "@/server/services/campaign-launch-orchestrator.service";

type CampaignProgressPageProps = {
  params: Promise<{ campaignId: string }>;
};

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    style: "currency",
  }).format(paise / 100);
}

function percent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export default async function CampaignProgressPage({
  params,
}: CampaignProgressPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { campaignId } = await params;
  let progress: Awaited<ReturnType<typeof getCampaignLaunchProgress>>;

  try {
    progress = await getCampaignLaunchProgress({
      campaignId,
      companyId: context.membership.companyId,
    });
  } catch (error) {
    if (error instanceof CampaignLaunchOrchestratorError) notFound();
    throw error;
  }

  const run = progress.launchRun;
  const completion = run
    ? Math.min(
        100,
        Math.round(
          ((run.queuedRecipients + run.failedRecipients + run.skippedRecipients) /
            Math.max(run.totalRecipients, 1)) *
            100,
        ),
      )
    : 0;
  const stats = run
    ? [
        { label: "Total", value: run.totalRecipients },
        { label: "Queued", value: run.queuedRecipients },
        { label: "Sent", value: run.sentRecipients },
        { label: "Delivered", value: run.deliveredRecipients },
        { label: "Read", value: run.readRecipients },
        { label: "Replied", value: run.repliedRecipients },
        { label: "Failed", value: run.failedRecipients },
        { label: "Skipped", value: run.skippedRecipients },
      ]
    : [];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/dashboard/campaigns/${progress.campaign.id}`}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              &larr; Back to campaign
            </Link>
            <h1 className="mt-5 text-3xl font-bold text-gray-900">
              {progress.campaign.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Broadcast campaign progress and safe sending status.
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
            {run?.status ?? progress.campaign.status}
          </span>
        </div>

        {!run ? (
          <section className="rounded-2xl border bg-white p-8 text-sm text-gray-600 shadow-sm">
            No campaign launch run has been created yet.
          </section>
        ) : (
          <>
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">Progress</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {completion}%
                  </p>
                </div>
                <div className="text-right text-sm text-gray-600">
                  <p>Estimated: {money(run.estimatedCostPaise)}</p>
                  <p>Actual charged: {money(run.actualCostPaise)}</p>
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#128C7E]"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-5">
              {[
                ["Sent", progress.rates.sentRate],
                ["Delivered", progress.rates.deliveredRate],
                ["Read", progress.rates.readRate],
                ["Reply", progress.rates.replyRate],
                ["Failed", progress.rates.failedRate],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-gray-500">{label} rate</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {percent(Number(value))}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="border-b bg-gray-50 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent failures
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Recipient</th>
                      <th className="px-6 py-3">Contact</th>
                      <th className="px-6 py-3">Reason</th>
                      <th className="px-6 py-3">Failed at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {progress.recentFailures.map((failure) => (
                      <tr key={failure.recipientId}>
                        <td className="px-6 py-4">{failure.phoneNumber}</td>
                        <td className="px-6 py-4">{failure.contactId ?? "-"}</td>
                        <td className="px-6 py-4 text-rose-700">
                          {failure.errorMessage ?? "-"}
                        </td>
                        <td className="px-6 py-4">
                          {failure.failedAt
                            ? failure.failedAt.toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                    {progress.recentFailures.length === 0 ? (
                      <tr>
                        <td
                          className="px-6 py-8 text-center text-gray-500"
                          colSpan={4}
                        >
                          No recent failures.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
