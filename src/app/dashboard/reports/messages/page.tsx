import {
  CircleX,
  Inbox,
  MessageSquareText,
  Send,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getMessageReportsByCompany,
  type MessageReportFilters as ReportFilters,
} from "@/server/services/message-report.service";
import MessageReportFilters from "./message-report-filters";

type MessageReportsPageProps = {
  searchParams: Promise<ReportFilters>;
};

function buildPageHref(filters: ReportFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  return `/dashboard/reports/messages?${params.toString()}`;
}

export default async function MessageReportsPage({
  searchParams,
}: MessageReportsPageProps) {
  const filters = await searchParams;
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const report = await getMessageReportsByCompany(
    context.membership.companyId,
    filters,
  );

  const statusCards = [
    ["Received", report.statusSummary.RECEIVED],
    ["Queued", report.statusSummary.QUEUED],
    ["Sending", report.statusSummary.SENDING],
    ["Sent", report.statusSummary.SENT],
    ["Delivered", report.statusSummary.DELIVERED],
    ["Read", report.statusSummary.READ],
    ["Canceled", report.statusSummary.CANCELED],
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Message Reports"
        description="Search, filter, inspect, and export inbound and outbound WhatsApp message activity."
        actions={
          <>
            <Link
              href="/dashboard/messages/send"
              className={actionButtonClass()}
            >
              Single Message
            </Link>
            <Link
              href="/dashboard/messages/bulk"
              className={actionButtonClass("secondary")}
            >
              Bulk Message
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={MessageSquareText}
          label="Filtered Messages"
          value={report.totalCount.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Inbox}
          label="All Inbound"
          value={report.directionSummary.INBOUND.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Send}
          label="All Outbound"
          value={report.directionSummary.OUTBOUND.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={CircleX}
          label="All Failed"
          value={report.statusSummary.FAILED.toLocaleString("en-IN")}
        />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statusCards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_12px_28px_rgba(8,27,58,0.06)]"
          >
            <p className="text-sm text-[#526173]">{label}</p>
            <p className="mt-1 text-xl font-bold text-[#081B3A]">
              {value.toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </section>

      <MessageReportFilters initialFilters={filters} />

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#D8E6F3] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Message log"
            description={`Page ${report.page} of ${report.totalPages}; up to ${report.pageSize} messages per page.`}
          />
        </div>

        {report.messages.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No messages found for these filters.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[#F0F8FF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Direction</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Message / Meta ID</th>
                  <th className="px-5 py-3">Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6F3]">
                {report.messages.map((message) => (
                  <tr key={message.id}>
                    <td className="px-5 py-4 text-[#526173]">
                      {message.createdAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">{message.direction}</td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(message.status)}>
                        {message.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#081B3A]">
                        {message.contact.name ?? "Unnamed contact"}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        +{message.contact.countryCode} {message.contact.phoneNumber}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {message.template
                        ? `${message.template.name} · ${message.template.language}`
                        : "—"}
                    </td>
                    <td className="max-w-xs px-5 py-4 font-mono text-xs">
                      <Link
                        href={`/dashboard/messages/${message.id}`}
                        className="block truncate font-semibold text-[#0052CC] hover:underline"
                      >
                        {message.id}
                      </Link>
                      <span className="mt-1 block truncate text-[#526173]">
                        {message.metaMessageId ?? "No Meta ID"}
                      </span>
                    </td>
                    <td className="max-w-sm px-5 py-4 text-[#526173]">
                      <p className="line-clamp-2 whitespace-pre-wrap">
                        {message.body || "—"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#D8E6F3] bg-[#F0F8FF] px-5 py-4 text-sm sm:px-6">
          <p className="text-[#526173]">
            Page {report.page} of {report.totalPages}
          </p>
          <div className="flex gap-2">
            {report.page > 1 ? (
              <Link
                href={buildPageHref(filters, report.page - 1)}
                className={actionButtonClass("secondary")}
              >
                Previous
              </Link>
            ) : null}
            {report.page < report.totalPages ? (
              <Link
                href={buildPageHref(filters, report.page + 1)}
                className={actionButtonClass("secondary")}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}
