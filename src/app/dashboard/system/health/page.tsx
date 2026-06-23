import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getOperationsHealth } from "@/server/services/operations-health.service";
import { getSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";
import MaintenanceModeCard from "./maintenance-mode-card";
import RunDatabaseBackupButton from "./run-database-backup-button";
import VerifyLatestBackupButton from "./verify-latest-backup-button";

function statusClass(ok: boolean) {
  return ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700";
}

function queueStatusClass(isHealthy: boolean) {
  return isHealthy ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700";
}

export default async function SystemHealthPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  if (
    context.membership.role !== "OWNER" &&
    context.membership.role !== "ADMIN"
  ) {
    redirect("/dashboard");
  }

  const [health, maintenanceMode] = await Promise.all([
    getOperationsHealth(),
    getSystemMaintenanceMode(),
  ]);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>

          <p className="mt-2 text-sm text-gray-600">
            Monitor database, Redis, queues, and maintenance jobs.
          </p>
        </div>

        <MaintenanceModeCard maintenanceMode={maintenanceMode} />

        <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Overall Status
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Background infrastructure status for this application.
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${statusClass(
                health.isHealthy,
              )}`}
            >
              {health.isHealthy ? "Healthy" : "Needs Attention"}
            </span>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Health Check Endpoints
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            Use the public endpoint for uptime monitoring and the
            token-protected deep endpoint for internal diagnostics.
          </p>

          <div className="mt-4 grid gap-3">
            <code className="block rounded-lg bg-blue-950 px-4 py-3 text-sm text-white">
              GET /api/health
            </code>

            <code className="block rounded-lg bg-blue-950 px-4 py-3 text-sm text-white">
              GET /api/health/deep with x-healthcheck-token
            </code>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Database</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {health.database.ok ? "Connected" : "Down"}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                  health.database.ok,
                )}`}
              >
                {health.database.ok ? "OK" : "ERROR"}
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Latency:{" "}
              {health.database.latencyMs !== null
                ? `${health.database.latencyMs}ms`
                : "-"}
            </p>

            {health.database.error ? (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {health.database.error}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Redis</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {health.redis.ok ? "Connected" : "Down"}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                  health.redis.ok,
                )}`}
              >
                {health.redis.ok ? "OK" : "ERROR"}
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Latency:{" "}
              {health.redis.latencyMs !== null
                ? `${health.redis.latencyMs}ms`
                : "-"}
            </p>

            {health.redis.error ? (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {health.redis.error}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Database Backups
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Scheduled PostgreSQL backup status and retention.
              </p>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <RunDatabaseBackupButton />
              <VerifyLatestBackupButton />

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  health.databaseBackups.isHealthy
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {health.databaseBackups.enabled
                  ? health.databaseBackups.isHealthy
                    ? "Healthy"
                    : "Needs Attention"
                  : "Disabled"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-6">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Enabled</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.enabled ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Latest Backup</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackup?.status ?? "-"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Age</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackupAgeHours !== null
                  ? `${health.databaseBackups.latestBackupAgeHours}h`
                  : "-"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Retention</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.retentionDays} days
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Remote Storage</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.remoteStorageEnabled
                  ? "Enabled"
                  : "Disabled"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Remote Copy</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackupHasRemoteCopy
                  ? "Available"
                : "Missing"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Verification</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackup?.verificationStatus ?? "-"}
              </p>
            </div>
          </div>

          {health.databaseBackups.latestBackup?.fileName && (
            <p className="mt-4 break-all text-xs text-gray-500">
              Latest file: {health.databaseBackups.latestBackup.fileName}
            </p>
          )}

          {health.databaseBackups.latestBackup?.remoteKey && (
            <p className="mt-2 break-all text-xs text-gray-500">
              Remote key: {health.databaseBackups.latestBackup.remoteKey}
            </p>
          )}

          {health.databaseBackups.latestBackup?.remoteUploadError && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Remote upload error:{" "}
              {health.databaseBackups.latestBackup.remoteUploadError}
            </p>
          )}

          {health.databaseBackups.latestBackup?.verificationError && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Verification error:{" "}
              {health.databaseBackups.latestBackup.verificationError}
            </p>
          )}

          {health.databaseBackups.latestBackup?.verifiedAt && (
            <p className="mt-2 text-xs text-gray-500">
              Verified at:{" "}
              {health.databaseBackups.latestBackup.verifiedAt.toLocaleString()}
            </p>
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Queues</h2>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3">Queue</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Waiting</th>
                  <th className="px-6 py-3">Active</th>
                  <th className="px-6 py-3">Delayed</th>
                  <th className="px-6 py-3">Failed</th>
                  <th className="px-6 py-3">Completed</th>
                  <th className="px-6 py-3">Error</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {health.queues.map((queue) => (
                  <tr key={queue.name}>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {queue.name}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${queueStatusClass(
                          queue.isHealthy,
                        )}`}
                      >
                        {queue.paused
                          ? "Paused"
                          : queue.isHealthy
                            ? "Healthy"
                            : "Attention"}
                      </span>
                    </td>

                    <td className="px-6 py-4">{queue.waiting}</td>
                    <td className="px-6 py-4">{queue.active}</td>
                    <td className="px-6 py-4">{queue.delayed}</td>
                    <td className="px-6 py-4">{queue.failed}</td>
                    <td className="px-6 py-4">{queue.completed}</td>
                    <td className="max-w-md px-6 py-4 text-gray-600">
                      {queue.error ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Production Process Manager
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            Use PM2 or an equivalent process manager to keep the web server and
            workers running. Required workers that are not started will appear
            as stale or missing here.
          </p>

          <code className="mt-4 block rounded-lg bg-blue-950 px-4 py-3 text-sm text-white">
            npm run pm2:start
          </code>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Worker Heartbeats
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            A worker is considered stale if it has not sent a heartbeat for
            more than two minutes. Make sure production process managers run
            all required workers.
          </p>
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Workers</h2>
          </div>

          {health.workerHeartbeats.workers.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">
              No worker heartbeats found yet. Start your workers to see them
              here.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Worker</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Hostname</th>
                    <th className="px-6 py-3">PID</th>
                    <th className="px-6 py-3">Last Heartbeat</th>
                    <th className="px-6 py-3">Error</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {health.workerHeartbeats.workers.map((worker) => (
                    <tr key={worker.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {worker.workerName}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            worker.isHealthy
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {worker.isStale ? "STALE" : worker.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">{worker.hostname ?? "-"}</td>
                      <td className="px-6 py-4">{worker.processId ?? "-"}</td>

                      <td className="px-6 py-4">
                        {worker.lastHeartbeatAt.toLocaleString()}
                      </td>

                      <td className="max-w-md px-6 py-4 text-gray-600">
                        {worker.lastError ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Maintenance Runs
            </h2>
          </div>

          {health.recentJobs.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">
              No maintenance jobs found.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Started</th>
                    <th className="px-6 py-3">Job</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Checked</th>
                    <th className="px-6 py-3">Recovered</th>
                    <th className="px-6 py-3">Error</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {health.recentJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4">
                        {job.startedAt.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-900">
                        {job.jobName}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            job.status === "COMPLETED"
                              ? "bg-green-50 text-green-700"
                              : job.status === "FAILED"
                                ? "bg-red-50 text-red-700"
                                : "bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">{job.checkedCount}</td>
                      <td className="px-6 py-4">{job.recoveredCount}</td>

                      <td className="max-w-md px-6 py-4 text-gray-600">
                        {job.errorMessage ?? "-"}
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
