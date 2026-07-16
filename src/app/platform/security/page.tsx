import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

function dateLabel(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function severityClass(severity: string) {
  if (["CRITICAL", "HIGH"].includes(severity)) {
    return "bg-red-50 text-red-700";
  }

  if (severity === "MEDIUM") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

export default async function PlatformSecurityPage() {
  await requirePlatformPermission("PLATFORM_SECURITY_VIEW");

  const [
    recentSecurityEvents,
    unresolvedSecurityEvents,
    highSeverityEvents,
    pendingApprovals,
    pendingDomainChallenges,
    failedDomainChallenges,
    pendingOffboardingRuns,
    pendingClientTransfers,
  ] = await Promise.all([
    prisma.securityEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.securityEvent.count({
      where: { resolvedAt: null },
    }),
    prisma.securityEvent.count({
      where: {
        resolvedAt: null,
        severity: { in: ["CRITICAL", "HIGH"] },
      },
    }),
    prisma.platformApprovalRequest.count({
      where: { status: "PENDING" },
    }),
    prisma.partnerDomainOwnershipChallenge.count({
      where: { status: "PENDING" },
    }),
    prisma.partnerDomainOwnershipChallenge.count({
      where: { status: "FAILED" },
    }),
    prisma.partnerOffboardingRun.count({
      where: { status: "PENDING_APPROVAL" },
    }),
    prisma.partnerClientTransferRequest.count({
      where: { status: "PENDING_APPROVAL" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Security
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Platform security center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Monitor unresolved security events, approval queues, domain
              verification challenges, and enterprise hardening guardrails.
            </p>
          </div>

          <Link
            href="/dashboard/system/health"
            className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          >
            Open system health
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">High risk open</p>
          <p className="mt-2 text-3xl font-black text-red-700">
            {highSeverityEvents}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">All unresolved</p>
          <p className="mt-2 text-3xl font-black text-amber-700">
            {unresolvedSecurityEvents}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Approvals pending</p>
          <p className="mt-2 text-3xl font-black text-blue-700">
            {pendingApprovals}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Domain checks</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {pendingDomainChallenges + failedDomainChallenges}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Approval safety</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Two-person approvals protect destructive partner offboarding, client
            transfers, and other high-risk actions.
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-600">Offboarding</dt>
              <dd className="font-black text-slate-950">
                {pendingOffboardingRuns}
              </dd>
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-600">Client transfers</dt>
              <dd className="font-black text-slate-950">
                {pendingClientTransfers}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Domain ownership</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Custom-domain verification prevents accidental or malicious domain
            takeover during partner and white-label changes.
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-600">Pending</dt>
              <dd className="font-black text-amber-700">
                {pendingDomainChallenges}
              </dd>
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-600">Failed</dt>
              <dd className="font-black text-red-700">{failedDomainChallenges}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Next admin action</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Review high-risk events first, then process pending approvals and
            failed domain challenges.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/platform/audit"
              className="rounded-xl bg-slate-950 px-4 py-2 text-center text-sm font-bold text-white"
            >
              View audit trail
            </Link>
            <Link
              href="/platform/domains"
              className="rounded-xl border border-emerald-200 px-4 py-2 text-center text-sm font-bold text-emerald-700"
            >
              Review domains
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">
            Recent security events
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest security events captured by middleware, API guards, CSP, and
            production checks.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Event</th>
                <th className="px-5 py-4">Severity</th>
                <th className="px-5 py-4">Path</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSecurityEvents.map((event) => (
                <tr key={event.id} className="align-top">
                  <td className="px-5 py-5">
                    <p className="font-black text-slate-950">{event.type}</p>
                    <p className="mt-1 max-w-md text-sm text-slate-600">
                      {event.summary}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${severityClass(
                        event.severity,
                      )}`}
                    >
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-slate-600">
                    {event.method ? `${event.method} ` : ""}
                    {event.path ?? "-"}
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        event.resolvedAt
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {event.resolvedAt ? "Resolved" : "Open"}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-slate-600">
                    {dateLabel(event.createdAt)}
                  </td>
                </tr>
              ))}

              {recentSecurityEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No security events found.
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
