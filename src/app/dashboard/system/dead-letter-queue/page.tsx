import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import { REGISTERED_QUEUES, getQueueLabel } from "@/server/config/queue-registry";
import {
  getDeadLetterQueueSummary,
  listDeadLetterJobs,
} from "@/server/services/dead-letter-queue.service";
import {
  DeadLetterActions,
  SyncDeadLetterQueueButton,
} from "./dead-letter-actions";

const STATUSES = ["FAILED", "RETRIED", "IGNORED", "RESOLVED"] as const;
type Status = (typeof STATUSES)[number];

type DeadLetterQueuePageProps = {
  searchParams?: Promise<{ queue?: string; status?: string }>;
};

function formatJson(value: unknown) {
  return value === null || value === undefined
    ? "-"
    : JSON.stringify(value, null, 2);
}

export default async function DeadLetterQueuePage({
  searchParams,
}: DeadLetterQueuePageProps) {
  await requireAdmin();

  const params = await searchParams;
  const status: Status = STATUSES.includes(params?.status as Status)
    ? (params?.status as Status)
    : "FAILED";
  const queueName = REGISTERED_QUEUES.some((queue) => queue.name === params?.queue)
    ? params?.queue
    : undefined;

  const [summary, jobs] = await Promise.all([
    getDeadLetterQueueSummary(),
    listDeadLetterJobs({ status, queueName, take: 100 }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">System</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Dead Letter Queue</h1>
          <p className="mt-2 text-sm text-gray-600">
            Inspect redacted failure data, retry original BullMQ jobs, or dismiss them.
          </p>
        </div>
        <SyncDeadLetterQueueButton />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Failed", summary.failed],
          ["Retried", summary.retried],
          ["Ignored", summary.ignored],
          ["Status", summary.isHealthy ? "Healthy" : "Needs Review"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((item) => (
            <Link
              key={item}
              href={`/dashboard/system/dead-letter-queue?status=${item}${queueName ? `&queue=${encodeURIComponent(queueName)}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                status === item ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {item}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          <Link
            href={`/dashboard/system/dead-letter-queue?status=${status}`}
            className={`rounded-full px-3 py-1.5 text-xs ${!queueName ? "bg-emerald-100 text-emerald-800" : "bg-gray-100"}`}
          >
            All queues
          </Link>
          {REGISTERED_QUEUES.map((queue) => (
            <Link
              key={queue.name}
              title={queue.description}
              href={`/dashboard/system/dead-letter-queue?status=${status}&queue=${encodeURIComponent(queue.name)}`}
              className={`rounded-full px-3 py-1.5 text-xs ${queueName === queue.name ? "bg-emerald-100 text-emerald-800" : "bg-gray-100"}`}
            >
              {queue.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{status} job records</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Queue</th>
                <th className="px-5 py-3">Job</th>
                <th className="px-5 py-3">Attempts</th>
                <th className="px-5 py-3">Failure</th>
                <th className="px-5 py-3">Last failed</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="px-5 py-4 font-medium text-gray-900">
                    {getQueueLabel(job.queueName)}
                    <div className="font-mono text-xs font-normal text-gray-500">{job.queueName}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-gray-900">{job.jobName ?? "-"}</div>
                    <div className="font-mono text-xs text-gray-500">{job.jobId}</div>
                  </td>
                  <td className="px-5 py-4">{job.attemptsMade}</td>
                  <td className="max-w-lg px-5 py-4">
                    <p className="text-xs text-red-600">{job.failedReason ?? "-"}</p>
                    <details className="mt-2 text-xs text-gray-600">
                      <summary className="cursor-pointer font-medium text-gray-800">Inspect details</summary>
                      <p className="mt-3 font-semibold">Stack trace</p>
                      <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-gray-950 p-3 text-gray-100">
                        {job.stacktrace.length > 0 ? job.stacktrace.join("\n") : "-"}
                      </pre>
                      <p className="mt-3 font-semibold">Redacted payload</p>
                      <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3">
                        {formatJson(job.payload)}
                      </pre>
                      <p className="mt-3 font-semibold">Return value</p>
                      <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3">
                        {formatJson(job.returnValue)}
                      </pre>
                    </details>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">{job.lastFailedAt.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    {job.status === "FAILED" ? (
                      <DeadLetterActions jobRecordId={job.id} />
                    ) : (
                      <span className="text-xs font-medium text-gray-600">{job.status}</span>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No {status.toLowerCase()} jobs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
