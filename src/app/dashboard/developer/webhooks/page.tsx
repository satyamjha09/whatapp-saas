import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getDeveloperWebhookHealthLabel } from "@/server/services/developer-webhook-health.service";
import { getDeveloperWebhookEndpointsByCompany } from "@/server/services/developer-webhook.service";
import EditWebhookButton from "./edit-webhook-button";
import EnableWebhookButton from "./enable-webhook-button";
import RevokeWebhookEndpointButton from "./revoke-webhook-endpoint-button";
import RotateWebhookSecretButton from "./rotate-webhook-secret-button";
import TestWebhookEndpointButton from "./test-webhook-endpoint-button";
import WebhookEndpointForm from "./webhook-endpoint-form";

function getHealthBadgeClass(health: string) {
  if (health === "HEALTHY") return "bg-green-50 text-green-700";
  if (health === "DEGRADED") return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

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
  const healthyCount = endpoints.filter(
    (endpoint) =>
      endpoint.status === "ACTIVE" &&
      !endpoint.autoDisabledAt &&
      endpoint.consecutiveFailureCount < 5,
  ).length;
  const degradedCount = endpoints.filter(
    (endpoint) =>
      endpoint.status === "ACTIVE" &&
      !endpoint.autoDisabledAt &&
      endpoint.consecutiveFailureCount >= 5,
  ).length;
  const autoDisabledCount = endpoints.filter(
    (endpoint) => endpoint.autoDisabledAt || endpoint.status === "AUTO_DISABLED",
  ).length;

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
            <section className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Healthy</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {healthyCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Degraded</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {degradedCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Auto-disabled</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {autoDisabledCount}
                </p>
              </div>
            </section>

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
                      <th className="py-3 pr-4">Events</th>
                      <th className="py-3 pr-4">Secret</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Created</th>
                      <th className="py-3 pr-4">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {endpoints.map((endpoint) => {
                      const health = getDeveloperWebhookHealthLabel({
                        status: endpoint.status,
                        consecutiveFailureCount:
                          endpoint.consecutiveFailureCount,
                        autoDisabledAt: endpoint.autoDisabledAt,
                      });

                      return (
                      <tr key={endpoint.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-900">
                          {endpoint.name}
                        </td>

                        <td className="max-w-[260px] truncate py-3 pr-4 text-gray-600">
                          {endpoint.url}
                        </td>

                        <td className="py-3 pr-4">
                          <div className="max-w-[260px]">
                            <div className="flex flex-wrap gap-1">
                              {(endpoint.events.length > 0
                                ? endpoint.events
                                : ["All legacy events"]
                              ).map((event) => (
                                <span
                                  key={event}
                                  className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                                >
                                  {event}
                                </span>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                              Version: {endpoint.payloadVersion}
                            </p>
                          </div>
                        </td>

                        <td className="py-3 pr-4 font-mono text-xs text-gray-600">
                          <div className="space-y-1">
                            <p>
                              {endpoint.signingSecretPreview ??
                                `${endpoint.secretPrefix}...${endpoint.secretLast4}`}
                            </p>
                            {endpoint.signingSecretRotatedAt && (
                              <p className="font-sans text-[11px] text-gray-500">
                                Rotated:{" "}
                                {endpoint.signingSecretRotatedAt.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="space-y-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getHealthBadgeClass(health)}`}>
                            {health.replaceAll("_", " ")}
                          </span>
                          <span className="ml-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                            {endpoint.status}
                          </span>
                          <div className="space-y-1 text-xs text-gray-500">
                            <p>
                              Consecutive failures:{" "}
                              {endpoint.consecutiveFailureCount}
                            </p>
                            {endpoint.lastSuccessAt && (
                              <p>
                                Last success:{" "}
                                {endpoint.lastSuccessAt.toLocaleString()}
                              </p>
                            )}
                            {endpoint.lastFailureAt && (
                              <p>
                                Last failure:{" "}
                                {endpoint.lastFailureAt.toLocaleString()}
                              </p>
                            )}
                            {endpoint.autoDisabledAt && (
                              <p className="text-red-700">
                                Auto-disabled:{" "}
                                {endpoint.autoDisabledAt.toLocaleString()}
                              </p>
                            )}
                            {endpoint.autoDisabledReason && (
                              <p className="text-red-700">
                                Reason: {endpoint.autoDisabledReason}
                              </p>
                            )}
                          </div>
                          </div>
                        </td>

                        <td className="py-3 pr-4 text-gray-600">
                          {endpoint.createdAt.toLocaleDateString()}
                        </td>

                        <td className="py-3 pr-4">
                          {canManageWebhooks &&
                          endpoint.status === "ACTIVE" ? (
                            <div className="flex flex-wrap gap-2">
                              <EditWebhookButton
                                endpointId={endpoint.id}
                                initialName={endpoint.name}
                                initialUrl={endpoint.url}
                                initialEvents={endpoint.events}
                                initialPayloadVersion={endpoint.payloadVersion}
                              />

                              <TestWebhookEndpointButton
                                endpointId={endpoint.id}
                                disabled={false}
                              />

                              <RotateWebhookSecretButton
                                endpointId={endpoint.id}
                              />

                              <RevokeWebhookEndpointButton
                                endpointId={endpoint.id}
                                disabled={false}
                              />
                            </div>
                          ) : canManageWebhooks &&
                            endpoint.status === "AUTO_DISABLED" ? (
                            <EnableWebhookButton endpointId={endpoint.id} />
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
