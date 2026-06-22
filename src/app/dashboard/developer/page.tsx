import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getDeveloperApiKeyAnalytics } from "@/server/services/developer-api-request-log.service";
import EditApiKeyButton from "./api-keys/edit-api-key-button";
import RevokeApiKeyButton from "./api-keys/revoke-api-key-button";

function formatDateTime(date: Date | null) {
  if (!date) return "Never";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderExpiry(expiresAt: Date | null) {
  if (!expiresAt) {
    return <span className="text-xs text-[#526173]">Never</span>;
  }

  if (expiresAt < new Date()) {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        Expired
      </span>
    );
  }

  return <span className="text-[#526173]">{formatDateTime(expiresAt)}</span>;
}

export default async function DeveloperPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const canManageApiKeys =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const apiKeyAnalytics = await getDeveloperApiKeyAnalytics(
    context.membership.companyId,
  );

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#0052CC]">
              Developer Console
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#081B3A]">
              API key analytics
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#526173]">
              Track key usage, spot blocked requests, and revoke compromised
              keys before they can be used again.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/developer/logs"
              className="rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#0052CC] shadow-sm"
            >
              View logs
            </Link>
            <Link
              href="/dashboard/developer/api-keys"
              className="rounded-xl bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003F9E]"
            >
              Manage keys
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#D8E6F3] bg-white shadow-sm">
          <div className="border-b border-[#D8E6F3] bg-[#F0F8FF] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#081B3A]">
                  API Key Analytics
                </h2>
                <p className="mt-1 text-sm text-[#526173]">
                  Per-key request totals from the last 24 hours.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#526173]">
                {apiKeyAnalytics.length} key(s)
              </span>
            </div>
          </div>

          {apiKeyAnalytics.length === 0 ? (
            <div className="p-6 text-sm text-[#526173]">
              No API keys created yet.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FBFF] text-xs uppercase text-[#526173]">
                  <tr>
                    <th className="px-6 py-3">Key</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Scopes</th>
                    <th className="px-6 py-3">Allowed IPs</th>
                    <th className="px-6 py-3">Expires</th>
                    <th className="px-6 py-3">Last Used</th>
                    <th className="px-6 py-3">Total 24h</th>
                    <th className="px-6 py-3">Success</th>
                    <th className="px-6 py-3">Failed</th>
                    <th className="px-6 py-3">Blocked</th>
                    <th className="px-6 py-3">Rate Limited</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#D8E6F3]">
                  {apiKeyAnalytics.map((item) => (
                    <tr key={item.apiKey.id}>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/developer/logs?apiKeyId=${item.apiKey.id}`}
                          className="font-semibold text-[#081B3A] hover:text-[#0052CC] hover:underline"
                        >
                          {item.apiKey.name}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-[#526173]">
                          {item.apiKey.keyPrefix}...{item.apiKey.keyLast4}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        {item.apiKey.revokedAt ||
                        item.apiKey.status === "REVOKED" ? (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            Revoked
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex max-w-sm flex-wrap gap-1">
                          {item.apiKey.scopes.length === 0 ? (
                            <span className="rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
                              No scopes
                            </span>
                          ) : (
                            item.apiKey.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                              >
                                {scope.replaceAll("_", " ")}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {item.apiKey.allowedIps.length === 0 ? (
                          <span className="text-xs text-[#526173]">
                            Any IP
                          </span>
                        ) : (
                          <div className="flex max-w-sm flex-wrap gap-1">
                            {item.apiKey.allowedIps.map((ip) => (
                              <span
                                key={ip}
                                className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                              >
                                {ip}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {renderExpiry(item.apiKey.expiresAt)}
                      </td>

                      <td className="px-6 py-4 text-[#526173]">
                        {formatDateTime(item.apiKey.lastUsedAt)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#081B3A]">
                        {item.total24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-emerald-700">
                        {item.success24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-red-700">
                        {item.failed24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-amber-700">
                        {item.blocked24h.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-[#0052CC]">
                        {item.rateLimited24h.toLocaleString("en-IN")}
                      </td>

                      <td className="px-6 py-4">
                        {canManageApiKeys ? (
                          <div className="flex flex-wrap gap-2">
                            {!(
                              item.apiKey.revokedAt ||
                              item.apiKey.status === "REVOKED"
                            ) && (
                              <EditApiKeyButton
                                apiKeyId={item.apiKey.id}
                                name={item.apiKey.name}
                                scopes={item.apiKey.scopes}
                                allowedIps={item.apiKey.allowedIps}
                                expiresAt={
                                  item.apiKey.expiresAt
                                    ? item.apiKey.expiresAt.toISOString()
                                    : null
                                }
                              />
                            )}
                            <RevokeApiKeyButton
                              apiKeyId={item.apiKey.id}
                              isRevoked={Boolean(
                                item.apiKey.revokedAt ||
                                  item.apiKey.status === "REVOKED",
                              )}
                            />
                          </div>
                        ) : (
                          <span className="text-[#526173]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
