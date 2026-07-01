import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import { getCampaignActivityFeed } from "@/server/services/campaign-activity-feed.service";

type PageProps = {
  searchParams?: Promise<{
    campaignId?: string;
  }>;
};

function severityClass(severity: string) {
  if (severity === "CRITICAL") return "bg-red-50 text-red-700";
  if (severity === "WARNING") return "bg-yellow-50 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

function kindClass(kind: string) {
  if (kind === "FAILURE") return "bg-red-50 text-red-700";
  if (kind === "REPORT" || kind === "CONVERSION") return "bg-green-50 text-green-700";
  if (kind === "CONTROL" || kind === "REPLY") return "bg-emerald-50 text-emerald-700";
  return "bg-gray-100 text-gray-700";
}

export default async function CampaignActivityPage({ searchParams }: PageProps) {
  const context = await requireAdmin();
  const params = await searchParams;
  const campaignId = params?.campaignId?.trim() || null;
  const feed = await getCampaignActivityFeed({
    campaignId,
    companyId: context.membership.companyId,
    take: 150,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Campaigns</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Campaign Activity Feed
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            One feed for launch, control, throughput, failure, report, reply, conversion, follow-up, and message events.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/campaigns/reports"
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-800"
          >
            Reports
          </Link>
          <Link
            href="/dashboard/campaigns/replies"
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-800"
          >
            Replies
          </Link>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-5 shadow-sm">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-gray-700">Campaign ID</span>
          <input
            name="campaignId"
            defaultValue={campaignId ?? ""}
            placeholder="Filter by campaign"
            className="w-80 max-w-full rounded-lg border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
        {campaignId ? (
          <Link
            href="/dashboard/campaigns/activity"
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-800"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Activity
          </h2>
        </div>
        <div className="divide-y">
          {feed.items.map((item) => (
            <article key={item.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${kindClass(
                    item.kind,
                  )}`}
                >
                  {item.kind}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClass(
                    item.severity,
                  )}`}
                >
                  {item.severity}
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {item.campaignId}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-3">
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">
                  {item.createdAt.toLocaleString()}
                </p>
              </div>
              {item.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                  {item.description}
                </p>
              ) : null}
            </article>
          ))}

          {feed.items.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No campaign activity yet.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
