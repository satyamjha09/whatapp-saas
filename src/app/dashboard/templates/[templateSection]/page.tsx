import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, Clock3, Info, Pencil } from "lucide-react";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";
import {
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { canonicalizeTemplateDraft } from "@/lib/whatsapp-template/template-definition";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getTemplateLifecycleEvents } from "@/server/services/template-lifecycle.service";
import SubmitTemplateButton from "../submit-template-button";
import TemplateRowActions from "../template-row-actions";

function formatDate(date?: Date | null) {
  if (!date) return "--";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function jsonPreview(value: unknown) {
  if (!value) return "No payload stored";

  return JSON.stringify(value, null, 2);
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateSection: string }>;
}) {
  const { templateSection } = await params;

  if (templateSection === "match-logs") {
    return <ComingSoonPage title="Template Match Logs" />;
  }

  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const template = await prisma.template.findFirst({
    where: {
      id: templateSection,
      companyId: context.membership.companyId,
    },
  });

  if (!template) notFound();

  const [events, messageCounts] = await Promise.all([
    getTemplateLifecycleEvents(context.membership.companyId, template.id),
    prisma.message.groupBy({
      by: ["status"],
      where: {
        companyId: context.membership.companyId,
        templateId: template.id,
      },
      _count: true,
    }),
  ]);

  const draft = canonicalizeTemplateDraft(template);
  const metrics = new Map(
    messageCounts.map((group) => [group.status, group._count]),
  );
  const sent =
    (metrics.get("SENT") ?? 0) +
    (metrics.get("DELIVERED") ?? 0) +
    (metrics.get("READ") ?? 0);
  const delivered = (metrics.get("DELIVERED") ?? 0) + (metrics.get("READ") ?? 0);
  const read = metrics.get("READ") ?? 0;
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#128C7E]">
            Template Management
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            {template.name}
          </h1>
          <p className="mt-1 text-sm text-[#526173]">
            {draft.templateType} · {template.category} · {template.language}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SubmitTemplateButton
            canManage={canManage}
            status={template.status}
            templateId={template.id}
          />
          <Link
            href={`/dashboard/templates/${template.id}/edit`}
            className={actionButtonClass("secondary")}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
          <Link
            href={`/dashboard/templates/${template.id}/analytics`}
            className={actionButtonClass("secondary")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Link>
          <Link href="/dashboard/templates" className={actionButtonClass("secondary")}>
            Back to Templates
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <PanelTitle
                title="Lifecycle"
                description="Current Meta review state, quality, and sync metadata."
              />
              <StatusPill tone={statusTone(template.status)}>
                {statusLabel(template.status)}
              </StatusPill>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                ["Quality", template.qualityScore ?? "Unknown"],
                ["Last synced", formatDate(template.lastSyncedAt)],
                ["Submitted", formatDate(template.lastSubmittedAt)],
                ["Approved", formatDate(template.approvedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#BFE9D0] p-4">
                  <p className="text-xs uppercase text-[#526173]">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-[#081B3A]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {template.rejectionReason || template.lastSubmitError ? (
              <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {template.rejectionReason ?? template.lastSubmitError}
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelTitle
              title="Message Usage"
              description="Counts from messages created with this template."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Sent", sent],
                ["Delivered", delivered],
                ["Read", read],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#BFE9D0] p-4">
                  <p className="text-sm text-[#526173]">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-[#081B3A]">{value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Status History"
              description="Submission, sync, rejection, quality, and category changes."
            />
            <div className="mt-5 space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-[#526173]">No lifecycle events yet.</p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-[#E7F8EF] bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#081B3A]">
                        {event.eventType.replaceAll("_", " ")}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-[#526173]">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDate(event.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#526173]">
                      Source: {event.source}
                      {event.previousStatus || event.newStatus
                        ? ` · Status: ${event.previousStatus ?? "--"} -> ${event.newStatus ?? "--"}`
                        : ""}
                      {event.previousCategory || event.newCategory
                        ? ` · Category: ${event.previousCategory ?? "--"} -> ${event.newCategory ?? "--"}`
                        : ""}
                    </p>
                    {event.reason ? (
                      <p className="mt-2 text-xs leading-5 text-rose-600">
                        {event.reason}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Submitted Payload"
              description="Last payload sent to Meta for review."
            />
            <pre className="mt-5 max-h-[360px] overflow-auto rounded-xl bg-[#081B3A] p-4 text-xs leading-5 text-white">
              {jsonPreview(template.submittedPayload)}
            </pre>
          </Panel>
        </div>

        <aside className="space-y-6 xl:self-start">
          <Panel>
            <PanelTitle title="Preview" />
            <div className="mt-5 min-h-[420px] rounded-xl bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
              <div className="mx-auto mb-3 w-fit rounded-full bg-white px-3 py-2 text-xs text-[#526173] shadow-sm">
                Today
              </div>
              <div className="rounded-lg bg-white p-4 text-sm text-[#081B3A] shadow-sm">
                {draft.header?.text ? (
                  <p className="mb-2 font-semibold">{draft.header.text}</p>
                ) : null}
                <p className="whitespace-pre-wrap break-words leading-6">
                  {draft.body}
                </p>
                {draft.footer ? (
                  <p className="mt-3 text-xs text-[#526173]">{draft.footer}</p>
                ) : null}
                {draft.buttons.length > 0 ? (
                  <div className="mt-3 divide-y divide-[#E7F8EF] border-t border-[#E7F8EF]">
                    {draft.buttons.slice(0, 4).map((button, index) => (
                      <p
                        key={`${button.type}-${button.text ?? index}`}
                        className="py-2 text-center text-xs font-semibold text-[#128C7E]"
                      >
                        {button.text ?? button.type}
                      </p>
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 text-right text-xs text-[#526173]">10:13 PM</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelTitle title="Actions" />
            <div className="mt-5 flex flex-wrap gap-2">
              <TemplateRowActions
                canManage={canManage}
                status={template.status}
                templateId={template.id}
                templateName={template.name}
              />
            </div>
            <div className="mt-5 rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4 text-xs leading-5 text-[#526173]">
              <Info className="mb-2 h-4 w-4 text-[#128C7E]" />
              Use campaign and automation actions only after Meta approves the
              template.
            </div>
          </Panel>

          <Panel>
            <PanelTitle title="Meta IDs" />
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-[#526173]">Meta template ID</dt>
                <dd className="mt-1 break-all font-medium text-[#081B3A]">
                  {template.metaTemplateId ?? "--"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#526173]">Local ID</dt>
                <dd className="mt-1 break-all font-medium text-[#081B3A]">
                  {template.id}
                </dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
