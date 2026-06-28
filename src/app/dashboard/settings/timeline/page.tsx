import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import { getTimelineBackfillSummary } from "@/server/services/timeline-backfill.service";
import { TimelineBackfillButton } from "./timeline-backfill-button";

export default async function TimelineSettingsPage() {
  const context = await requireAdmin();
  const summary = await getTimelineBackfillSummary({
    companyId: context.membership.companyId,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Workspace Settings</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Timeline Backfill
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Refresh CRM timeline campaign events for attributed replies, conversions, and follow-up tasks.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Source Records</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary.sourceRecords}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Timeline Activity</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary.activityCount}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Deduped Rows</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary.dedupedActivities}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Dedupe Column</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary.dedupeReady ? "Ready" : "Missing"}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Backfill Campaign Timeline Events
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Safe to run repeatedly. Existing campaign timeline activity is refreshed by dedupe key.
            </p>
          </div>
          <Link
            href="/dashboard/system/health"
            className="text-sm font-medium text-gray-900 underline"
          >
            Open system health
          </Link>
        </div>

        <div className="mt-5">
          <TimelineBackfillButton />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Backfill Sources
          </h2>
        </div>
        <div className="divide-y text-sm">
          <div className="flex justify-between gap-4 px-6 py-4">
            <span>Attributed replies</span>
            <span className="font-mono">{summary.sources.attributedReplies}</span>
          </div>
          <div className="flex justify-between gap-4 px-6 py-4">
            <span>Conversions with contacts</span>
            <span className="font-mono">
              {summary.sources.conversionsWithContacts}
            </span>
          </div>
          <div className="flex justify-between gap-4 px-6 py-4">
            <span>Follow-up tasks with contacts</span>
            <span className="font-mono">
              {summary.sources.followUpsWithContacts}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
