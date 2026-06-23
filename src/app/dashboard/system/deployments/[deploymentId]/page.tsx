import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

type DeploymentPageProps = {
  params: Promise<{
    deploymentId: string;
  }>;
};

export default async function DeploymentDetailPage({
  params,
}: DeploymentPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context?.membership) {
    notFound();
  }

  const { deploymentId } = await params;

  const deployment = await prisma.productionDeployment.findUnique({
    where: {
      id: deploymentId,
    },
  });

  if (!deployment) {
    notFound();
  }

  const steps = [
    ["Maintenance enabled", deployment.maintenanceEnabledAt],
    ["Backup completed", deployment.backupCompletedAt],
    ["Migration completed", deployment.migrationCompletedAt],
    ["Prisma generated", deployment.prismaGeneratedAt],
    ["Build completed", deployment.buildCompletedAt],
    ["PM2 restarted", deployment.pm2RestartedAt],
    ["Health check passed", deployment.healthCheckPassedAt],
    ["Deep health check passed", deployment.deepHealthCheckPassedAt],
    ["Maintenance disabled", deployment.maintenanceDisabledAt],
  ] as const;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/dashboard/system/health"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Back to System Health
      </Link>

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Production Deployment
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {deployment.commitSha ?? "Unknown commit"}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              deployment.status === "SUCCEEDED"
                ? "bg-green-50 text-green-700"
                : deployment.status === "FAILED"
                  ? "bg-red-50 text-red-700"
                  : "bg-yellow-50 text-yellow-700"
            }`}
          >
            {deployment.status}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Commit message</dt>
            <dd className="font-medium text-gray-900">
              {deployment.commitMessage ?? "-"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">Branch</dt>
            <dd className="font-medium text-gray-900">
              {deployment.branch ?? "-"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">Started</dt>
            <dd className="font-medium text-gray-900">
              {deployment.startedAt.toLocaleString()}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">Completed</dt>
            <dd className="font-medium text-gray-900">
              {deployment.completedAt
                ? deployment.completedAt.toLocaleString()
                : "-"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">Backup run</dt>
            <dd className="font-medium text-gray-900">
              {deployment.backupRunId ?? "-"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">App URL</dt>
            <dd className="break-all font-medium text-gray-900">
              {deployment.appUrl ?? "-"}
            </dd>
          </div>
        </dl>

        {deployment.errorStage && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Failed at: {deployment.errorStage}</p>
            <p className="mt-1">{deployment.errorMessage}</p>
          </div>
        )}
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Deploy Steps</h2>

        <div className="mt-4 space-y-3">
          {steps.map(([label, completedAt]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
            >
              <span className="text-sm font-medium text-gray-900">
                {label}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  completedAt
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {completedAt ? completedAt.toLocaleString() : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
