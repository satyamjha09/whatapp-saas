import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getApiKeysByCompany } from "@/server/services/api-key.service";
import ApiKeyForm from "./api-key-form";
import EditApiKeyButton from "./edit-api-key-button";
import RevokeApiKeyButton from "./revoke-api-key-button";

function renderExpiry(expiresAt: Date | null) {
  if (!expiresAt) {
    return <span className="text-xs text-gray-500">Never</span>;
  }

  if (expiresAt < new Date()) {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        Expired
      </span>
    );
  }

  return <span className="text-gray-600">{expiresAt.toLocaleString()}</span>;
}

export default async function ApiKeysPage() {
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

  const apiKeys = await getApiKeysByCompany(context.membership.companyId);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Developer API Keys
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {canManageApiKeys ? (
            <ApiKeyForm />
          ) : (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Create API Key
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Only owners and admins can create API keys.
              </p>
            </div>
          )}

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  API Keys
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  Manage keys used by external integrations.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {apiKeys.length} key(s)
              </span>
            </div>

            {apiKeys.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No API keys created yet.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Key</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Scopes</th>
                      <th className="py-3 pr-4">Allowed IPs</th>
                      <th className="py-3 pr-4">Expires</th>
                      <th className="py-3 pr-4">Last Used</th>
                      <th className="py-3 pr-4">Created</th>
                      <th className="py-3 pr-4">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {apiKeys.map((apiKey) => {
                      const isRevoked =
                        apiKey.status === "REVOKED" || Boolean(apiKey.revokedAt);

                      return (
                        <tr
                          key={apiKey.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-3 pr-4 font-medium text-gray-900">
                            <Link
                              href={`/dashboard/developer/logs?apiKeyId=${apiKey.id}`}
                              className="hover:text-[#0052CC] hover:underline"
                            >
                              {apiKey.name}
                            </Link>
                          </td>

                          <td className="py-3 pr-4 font-mono text-xs text-gray-600">
                            {apiKey.keyPrefix}...{apiKey.keyLast4}
                          </td>

                          <td className="py-3 pr-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                isRevoked
                                  ? "bg-red-50 text-red-700"
                                  : "bg-green-50 text-green-700"
                              }`}
                            >
                              {isRevoked ? "REVOKED" : "ACTIVE"}
                            </span>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="flex max-w-xs flex-wrap gap-1">
                              {apiKey.scopes.length === 0 ? (
                                <span className="rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
                                  No scopes
                                </span>
                              ) : (
                                apiKey.scopes.map((scope) => (
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

                          <td className="py-3 pr-4">
                            {apiKey.allowedIps.length === 0 ? (
                              <span className="text-xs text-gray-500">
                                Any IP
                              </span>
                            ) : (
                              <div className="flex max-w-xs flex-wrap gap-1">
                                {apiKey.allowedIps.map((ip) => (
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

                          <td className="py-3 pr-4">
                            {renderExpiry(apiKey.expiresAt)}
                          </td>

                          <td className="py-3 pr-4 text-gray-600">
                            {apiKey.lastUsedAt
                              ? apiKey.lastUsedAt.toLocaleString()
                              : "Never"}
                          </td>

                          <td className="py-3 pr-4 text-gray-600">
                            {apiKey.createdAt.toLocaleDateString()}
                          </td>

                          <td className="py-3 pr-4">
                            {canManageApiKeys ? (
                              <div className="flex flex-wrap gap-2">
                                {!isRevoked && (
                                  <EditApiKeyButton
                                    apiKeyId={apiKey.id}
                                    name={apiKey.name}
                                    scopes={apiKey.scopes}
                                    allowedIps={apiKey.allowedIps}
                                    expiresAt={
                                      apiKey.expiresAt
                                        ? apiKey.expiresAt.toISOString()
                                        : null
                                    }
                                  />
                                )}
                                <RevokeApiKeyButton
                                  apiKeyId={apiKey.id}
                                  isRevoked={isRevoked}
                                />
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
