import { requireAdmin } from "@/server/auth/authorization";
import { getCampaignReplyAttributionDashboard } from "@/server/services/campaign-reply-attribution.service";
import {
  CreateCampaignConversionButton,
  FollowUpTaskActions,
} from "./reply-actions";

function badgeClass(value: string) {
  if (
    value === "POSITIVE" ||
    value === "LEAD_WON" ||
    value === "PAYMENT_RECEIVED"
  ) {
    return "bg-green-50 text-green-700";
  }

  if (value === "OPT_OUT" || value === "NEGATIVE" || value === "LEAD_LOST") {
    return "bg-red-50 text-red-700";
  }

  if (value === "QUESTION" || value === "HIGH") {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-gray-100 text-gray-700";
}

function money(paise?: number | null) {
  if (!paise) return "-";

  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    style: "currency",
  }).format(paise / 100);
}

export default async function CampaignRepliesPage() {
  const context = await requireAdmin();
  const dashboard = await getCampaignReplyAttributionDashboard({
    companyId: context.membership.companyId,
  });
  const positiveReplies = dashboard.attributions.filter(
    (item) => item.intent === "POSITIVE",
  ).length;
  const optOutReplies = dashboard.attributions.filter(
    (item) => item.intent === "OPT_OUT",
  ).length;
  const openTasks = dashboard.tasks.filter((task) => task.status === "OPEN").length;
  const totalValue = dashboard.conversions.reduce(
    (sum, event) => sum + (event.valuePaise ?? 0),
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Campaigns</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Campaign Replies & Conversions
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Attribute inbound replies to campaigns, track conversions, and create follow-up tasks.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Attributed Replies</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {dashboard.attributions.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Positive Replies</p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {positiveReplies}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Opt-outs</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {optOutReplies}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Conversion Value</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(totalValue)}
          </p>
        </div>
      </section>

      <div className="mt-6">
        <CreateCampaignConversionButton />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Attributed Replies
          </h2>
        </div>
        <div className="divide-y">
          {dashboard.attributions.map((reply) => (
            <div key={reply.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                    reply.intent,
                  )}`}
                >
                  {reply.intent}
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {reply.campaignId}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-800">
                {reply.replyBodyPreview || "-"}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Response time: {reply.responseTimeMinutes ?? 0} min /{" "}
                {reply.replyReceivedAt.toLocaleString()}
              </p>
            </div>
          ))}
          {dashboard.attributions.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No attributed replies yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Follow-up Tasks
          </h2>
          <p className="mt-1 text-sm text-gray-500">Open tasks: {openTasks}</p>
        </div>
        <div className="divide-y">
          {dashboard.tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-wrap items-start justify-between gap-4 px-6 py-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                      task.priority,
                    )}`}
                  >
                    {task.priority}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {task.status}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {task.campaignId}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-gray-900">{task.title}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {task.description || "-"}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Due: {task.dueAt?.toLocaleString() ?? "-"}
                </p>
              </div>
              <FollowUpTaskActions taskId={task.id} status={task.status} />
            </div>
          ))}
          {dashboard.tasks.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No follow-up tasks yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Conversion Events
          </h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3">Created By</th>
                <th className="px-5 py-3">Occurred</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboard.conversions.map((event) => (
                <tr key={event.id}>
                  <td className="px-5 py-4 font-mono text-xs">
                    {event.campaignId}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                        event.type,
                      )}`}
                    >
                      {event.type}
                    </span>
                  </td>
                  <td className="px-5 py-4">{money(event.valuePaise)}</td>
                  <td className="px-5 py-4">{event.note ?? "-"}</td>
                  <td className="px-5 py-4">
                    {event.createdByUser?.email ?? "system"}
                  </td>
                  <td className="px-5 py-4">
                    {event.occurredAt.toLocaleString()}
                  </td>
                </tr>
              ))}
              {dashboard.conversions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No conversion events yet.
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
