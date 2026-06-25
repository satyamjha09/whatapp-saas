import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getMessagesByCompany } from "@/server/services/message.service";

export default async function ReportsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const messages = await getMessagesByCompany(context.membership.companyId);

  const stats = [
    { label: "Total", value: messages.length },
    {
      label: "Queued",
      value: messages.filter((message) => message.status === "QUEUED").length,
    },
    {
      label: "Sending",
      value: messages.filter((message) => message.status === "SENDING").length,
    },
    {
      label: "Retry Pending",
      value: messages.filter((message) => message.status === "RETRY_PENDING")
        .length,
    },
    {
      label: "Sent",
      value: messages.filter((message) => message.status === "SENT").length,
    },
    {
      label: "Delivered",
      value: messages.filter((message) => message.status === "DELIVERED")
        .length,
    },
    {
      label: "Read",
      value: messages.filter((message) => message.status === "READ").length,
    },
    {
      label: "Failed",
      value: messages.filter((message) => message.status === "FAILED").length,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Reports"
        description="A real-time operational report based on the stored message records for this workspace."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard
            key={stat.label}
            icon={BarChart3}
            label={stat.label}
            value={stat.value.toLocaleString("en-IN")}
          />
        ))}
      </section>

      <Panel>
        <PanelTitle
          title="Latest messages"
          description="Most recent message records with contact, template, status, and created date."
        />

        {messages.length === 0 ? (
          <div className="mt-6">
            <EmptyState>No messages found.</EmptyState>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-500">
                  <th className="py-3 pr-4 font-medium">Contact</th>
                  <th className="py-3 pr-4 font-medium">Phone</th>
                  <th className="py-3 pr-4 font-medium">Template</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Created</th>
                  <th className="py-3 pr-4 font-medium">Action</th>
                </tr>
              </thead>

              <tbody>
                {messages.map((message) => (
                  <tr
                    key={message.id}
                    className="border-b border-white/[0.06] text-zinc-300 last:border-0"
                  >
                    <td className="py-4 pr-4">
                      {message.contact.name ?? "Unnamed Contact"}
                    </td>

                    <td className="py-4 pr-4 text-zinc-500">
                      +{message.toPhoneNumber}
                    </td>

                    <td className="py-4 pr-4 text-zinc-500">
                      {message.template?.name ?? "Deleted template"}
                    </td>

                    <td className="py-4 pr-4">
                      <StatusPill tone={statusTone(message.status)}>
                        {message.status}
                      </StatusPill>
                    </td>

                    <td className="py-4 pr-4 text-zinc-500">
                      {message.createdAt.toLocaleDateString()}
                    </td>

                    <td className="py-4 pr-4">
                      <Link
                        href={`/dashboard/messages/${message.id}`}
                        className="font-medium text-indigo-300 transition hover:text-indigo-200"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
