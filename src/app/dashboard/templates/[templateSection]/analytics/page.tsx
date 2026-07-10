import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, Eye, Send } from "lucide-react";
import {
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getTemplateLifecycleEvents } from "@/server/services/template-lifecycle.service";

function formatDate(date?: Date | null) {
  if (!date) return "--";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function TemplateAnalyticsPage({
  params,
}: {
  params: Promise<{ templateSection: string }>;
}) {
  const { templateSection } = await params;
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const template = await prisma.template.findFirst({
    where: {
      companyId: context.membership.companyId,
      id: templateSection,
    },
  });

  if (!template) notFound();

  const [messageCounts, events] = await Promise.all([
    prisma.message.groupBy({
      by: ["status"],
      where: {
        companyId: context.membership.companyId,
        templateId: template.id,
      },
      _count: true,
    }),
    getTemplateLifecycleEvents(context.membership.companyId, template.id),
  ]);

  const counts = new Map(messageCounts.map((group) => [group.status, group._count]));
  const sent =
    (counts.get("SENT") ?? 0) +
    (counts.get("DELIVERED") ?? 0) +
    (counts.get("READ") ?? 0);
  const delivered = (counts.get("DELIVERED") ?? 0) + (counts.get("READ") ?? 0);
  const read = counts.get("READ") ?? 0;
  const failed = counts.get("FAILED") ?? 0;
  const readRate = sent > 0 ? Math.round((read / sent) * 100) : 0;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#128C7E]">
            Template Analytics
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            {template.name}
          </h1>
          <p className="mt-1 text-sm text-[#526173]">
            Last synced {formatDate(template.lastSyncedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/dashboard/templates/${template.id}`}
            className={actionButtonClass("secondary")}
          >
            Back to Template
          </Link>
          <Link href="/dashboard/templates" className={actionButtonClass("secondary")}>
            All Templates
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Send, label: "Sent", value: sent },
          { icon: CheckCircle2, label: "Delivered", value: delivered },
          { icon: Eye, label: "Read", value: read },
          { icon: AlertTriangle, label: "Failed", value: failed },
        ].map(({ icon: Icon, label, value }) => (
          <Panel key={label}>
            <Icon className="h-5 w-5 text-[#128C7E]" />
            <p className="mt-4 text-sm text-[#526173]">{label}</p>
            <p className="mt-2 text-3xl font-bold text-[#081B3A]">
              {value}
            </p>
          </Panel>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelTitle
            title="Message Status Breakdown"
            description="Counts are grouped from actual message records."
          />
          <div className="mt-6 space-y-3">
            {messageCounts.length === 0 ? (
              <p className="text-sm text-[#526173]">No messages sent yet.</p>
            ) : (
              messageCounts.map((group) => (
                <div
                  key={group.status}
                  className="flex items-center justify-between rounded-xl border border-[#BFE9D0] px-4 py-3"
                >
                  <StatusPill tone={statusTone(group.status)}>{group.status}</StatusPill>
                  <p className="text-sm font-semibold text-[#081B3A]">
                    {group._count}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Performance Summary" />
          <div className="mt-6 rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF] p-5">
            <Activity className="h-5 w-5 text-[#128C7E]" />
            <p className="mt-4 text-sm text-[#526173]">Read rate</p>
            <p className="mt-2 text-4xl font-bold text-[#081B3A]">{readRate}%</p>
            <p className="mt-3 text-xs leading-5 text-[#526173]">
              Based on sent, delivered, and read records currently stored for
              this template.
            </p>
          </div>
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelTitle
          title="Sync and Status History"
          description="Recent lifecycle changes from app actions, Meta sync, and webhooks."
        />
        <div className="mt-5 grid gap-3">
          {events.length === 0 ? (
            <p className="text-sm text-[#526173]">No lifecycle history yet.</p>
          ) : (
            events.slice(0, 12).map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-[#E7F8EF] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#081B3A]">
                    {event.eventType.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-[#526173]">{formatDate(event.createdAt)}</p>
                </div>
                <p className="mt-2 text-xs text-[#526173]">
                  {event.source} · {event.previousStatus ?? "--"} →{" "}
                  {event.newStatus ?? "--"}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
