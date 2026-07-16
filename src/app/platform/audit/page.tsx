import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function compactJson(value: unknown) {
  if (!value) return "No metadata";

  try {
    return JSON.stringify(value).slice(0, 220);
  } catch {
    return "Metadata unavailable";
  }
}

export default async function PlatformAuditPage() {
  await requirePlatformPermission("PLATFORM_AUDIT_VIEW");

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const [logs, totalLogs, logsThisWeek, actionGroups, entityGroups] =
    await Promise.all([
      prisma.platformAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.platformAuditLog.count(),
      prisma.platformAuditLog.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.platformAuditLog.groupBy({
        by: ["action"],
        _count: { _all: true },
        orderBy: { _count: { action: "desc" } },
        take: 8,
      }),
      prisma.platformAuditLog.groupBy({
        by: ["entityType"],
        _count: { _all: true },
        orderBy: { _count: { entityType: "desc" } },
        take: 8,
      }),
    ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
          Audit logs
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Platform audit trail
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review platform role changes, company control actions, partner pricing
          changes, approvals, and other high-risk admin events.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total events</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{totalLogs}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Last 7 days</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {logsThisWeek}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Recent page size</p>
          <p className="mt-2 text-3xl font-black text-blue-700">{logs.length}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Top actions</h2>
          <div className="mt-4 space-y-3">
            {actionGroups.map((group) => (
              <div
                key={group.action}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-bold text-slate-700">
                  {group.action}
                </span>
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                  {group._count._all}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Top entities</h2>
          <div className="mt-4 space-y-3">
            {entityGroups.map((group) => (
              <div
                key={group.entityType}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-bold text-slate-700">
                  {group.entityType}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                  {group._count._all}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">Recent events</h2>
          <p className="mt-1 text-sm text-slate-500">
            The latest platform audit entries across all internal operations.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Time</th>
                <th className="px-5 py-4">Actor</th>
                <th className="px-5 py-4">Action</th>
                <th className="px-5 py-4">Entity</th>
                <th className="px-5 py-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="px-5 py-5 text-slate-600">
                    {dateLabel(log.createdAt)}
                  </td>
                  <td className="px-5 py-5">
                    <p className="font-semibold text-slate-900">
                      {log.actorEmail ?? "System"}
                    </p>
                    {log.actorUserId ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {log.actorUserId}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-5">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-5">
                    <p className="font-semibold text-slate-900">{log.entityType}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {log.entityId ?? "No entity ID"}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    <code className="block max-w-xl rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                      {compactJson(log.metadata)}
                    </code>
                  </td>
                </tr>
              ))}

              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No platform audit logs found yet.
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
