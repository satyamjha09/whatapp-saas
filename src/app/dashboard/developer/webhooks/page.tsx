import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getDeveloperWebhookEndpointsByCompany } from "@/server/services/developer-webhook.service";
import RevokeWebhookEndpointButton from "./revoke-webhook-endpoint-button";
import WebhookEndpointForm from "./webhook-endpoint-form";

export default async function DeveloperWebhooksPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const canManageWebhooks =
    context.membership.role === "OWNER" || context.membership.role === "ADMIN";

  const endpoints = await getDeveloperWebhookEndpointsByCompany(
    context.membership.companyId,
  );

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Developer Webhooks
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {canManageWebhooks ? (
            <WebhookEndpointForm />
          ) : (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Create Webhook Endpoint
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Only owners and admins can create webhook endpoints.
              </p>
            </div>
          )}

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Webhook Endpoints
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  These endpoints will receive developer webhook events later.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {endpoints.length} endpoint(s)
              </span>
            </div>

            {endpoints.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No webhook endpoints created yet.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">URL</th>
                      <th className="py-3 pr-4">Secret</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Created</th>
                      <th className="py-3 pr-4">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {endpoints.map((endpoint) => (
                      <tr key={endpoint.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-900">
                          {endpoint.name}
                        </td>

                        <td className="max-w-[260px] truncate py-3 pr-4 text-gray-600">
                          {endpoint.url}
                        </td>

                        <td className="py-3 pr-4 font-mono text-xs text-gray-600">
                          {endpoint.secretPrefix}...{endpoint.secretLast4}
                        </td>

                        <td className="py-3 pr-4">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                            {endpoint.status}
                          </span>
                        </td>

                        <td className="py-3 pr-4 text-gray-600">
                          {endpoint.createdAt.toLocaleDateString()}
                        </td>

                        <td className="py-3 pr-4">
                          {canManageWebhooks &&
                          endpoint.status === "ACTIVE" ? (
                            <RevokeWebhookEndpointButton
                              endpointId={endpoint.id}
                              disabled={false}
                            />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <section className="mt-6 rounded-2xl border bg-yellow-50 p-6 text-sm text-yellow-900">
          <h2 className="text-lg font-semibold">Webhook Signing</h2>

          <p className="mt-2">
            Each endpoint has a signing secret. Later, when your SaaS sends
            webhook events to this URL, it will sign the payload so the receiver
            can verify the request is really from your platform.
          </p>
        </section>
      </div>
    </main>
  );
}
