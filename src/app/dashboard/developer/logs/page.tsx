import Link from "next/link";
import { redirect } from "next/navigation";
import type { DeveloperApiRequestLogStatus } from "@/generated/prisma/enums";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getDeveloperApiRequestLogs } from "@/server/services/developer-api-request-log.service";

const STATUSES: DeveloperApiRequestLogStatus[] = [
  "SUCCESS",
  "FAILED",
  "BLOCKED",
  "RATE_LIMITED",
];

type DeveloperApiLogsPageProps = {
  searchParams: Promise<{
    page?: string;
    status?: DeveloperApiRequestLogStatus;
    apiKeyId?: string;
  }>;
};

function buildLogsHref(input: {
  page?: number;
  status?: string;
  apiKeyId?: string;
}) {
  const params = new URLSearchParams();

  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.status) params.set("status", input.status);
  if (input.apiKeyId) params.set("apiKeyId", input.apiKeyId);

  const query = params.toString();
  return query ? `/dashboard/developer/logs?${query}` : "/dashboard/developer/logs";
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusBadgeClass(status: DeveloperApiRequestLogStatus) {
  if (status === "SUCCESS") return "bg-emerald-50 text-emerald-700";
  if (status === "RATE_LIMITED") return "bg-blue-50 text-[#0052CC]";
  if (status === "BLOCKED") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export default async function DeveloperApiLogsPage({
  searchParams,
}: DeveloperApiLogsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const status = STATUSES.includes(params.status as DeveloperApiRequestLogStatus)
    ? params.status
    : undefined;
  const page = Number.parseInt(params.page ?? "1", 10);
  const logs = await getDeveloperApiRequestLogs({
    companyId: context.membership.companyId,
    page: Number.isFinite(page) ? page : 1,
    status,
    apiKeyId: params.apiKeyId,
  });

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#0052CC]">
              Developer Console
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#081B3A]">
              API request logs
            </h1>
            <p className="mt-2 text-sm text-[#526173]">
              Inspect public API calls by status and API key.
            </p>
          </div>

          <Link
            href="/dashboard/developer"
            className="rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#0052CC] shadow-sm"
          >
            Back to analytics
          </Link>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Log Retention
          </h2>
          <p className="mt-1 text-sm text-blue-800">
            API request logs are retained according to your current billing
            plan. Upgrade to Business for longer developer diagnostics
            retention.
          </p>
        </div>

        <section className="rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildLogsHref({ apiKeyId: params.apiKeyId })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                !status
                  ? "bg-[#0052CC] text-white"
                  : "bg-[#F0F8FF] text-[#526173]"
              }`}
            >
              All
            </Link>

            {STATUSES.map((item) => (
              <Link
                key={item}
                href={buildLogsHref({
                  status: item,
                  apiKeyId: params.apiKeyId,
                })}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  status === item
                    ? "bg-[#0052CC] text-white"
                    : "bg-[#F0F8FF] text-[#526173]"
                }`}
              >
                {item.replace("_", " ")}
              </Link>
            ))}

            {params.apiKeyId && (
              <Link
                href="/dashboard/developer/logs"
                className="rounded-full bg-[#F8C830]/20 px-3 py-1 text-xs font-semibold text-[#081B3A]"
              >
                Clear API key filter
              </Link>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#D8E6F3] bg-white shadow-sm">
          {logs.logs.length === 0 ? (
            <div className="p-6 text-sm text-[#526173]">
              No API request logs found.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FBFF] text-xs uppercase text-[#526173]">
                  <tr>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Key</th>
                    <th className="px-6 py-3">Request</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Required Scope</th>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E6F3]">
                  {logs.logs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-[#526173]">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        {log.apiKey ? (
                          <div>
                            <p className="font-semibold text-[#081B3A]">
                              {log.apiKey.name}
                            </p>
                            <p className="mt-1 font-mono text-xs text-[#526173]">
                              {log.apiKey.keyPrefix}...{log.apiKey.keyLast4}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[#526173]">Deleted key</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#081B3A]">
                          {log.method}
                        </p>
                        <p className="mt-1 max-w-sm truncate font-mono text-xs text-[#526173]">
                          {log.path}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(log.status)}`}
                        >
                          {log.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#526173]">
                        {log.requiredScope ? (
                          <span className="rounded-full bg-[#F0F8FF] px-2 py-1 text-xs font-semibold text-[#0052CC]">
                            {log.requiredScope.replace("_", " ")}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#526173]">
                        {log.statusCode ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-[#526173]">
                        {log.errorMessage ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex items-center justify-between">
          <p className="text-sm text-[#526173]">
            Page {logs.page} of {logs.pageCount}
          </p>
          <div className="flex gap-2">
            <Link
              href={buildLogsHref({
                page: Math.max(logs.page - 1, 1),
                status,
                apiKeyId: params.apiKeyId,
              })}
              aria-disabled={logs.page <= 1}
              className={`rounded-xl border border-[#D8E6F3] px-4 py-2 text-sm font-semibold ${
                logs.page <= 1
                  ? "pointer-events-none bg-gray-50 text-gray-400"
                  : "bg-white text-[#0052CC]"
              }`}
            >
              Previous
            </Link>
            <Link
              href={buildLogsHref({
                page: Math.min(logs.page + 1, logs.pageCount),
                status,
                apiKeyId: params.apiKeyId,
              })}
              aria-disabled={logs.page >= logs.pageCount}
              className={`rounded-xl border border-[#D8E6F3] px-4 py-2 text-sm font-semibold ${
                logs.page >= logs.pageCount
                  ? "pointer-events-none bg-gray-50 text-gray-400"
                  : "bg-white text-[#0052CC]"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
