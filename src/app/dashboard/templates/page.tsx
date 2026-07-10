import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CopyPlus,
  Filter,
  Send,
} from "lucide-react";
import { redirect } from "next/navigation";
import { StatusPill, actionButtonClass, statusTone } from "@/app/dashboard/dashboard-ui";
import { canonicalizeTemplateDraft } from "@/lib/whatsapp-template/template-definition";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getTemplatesByCompany } from "@/server/services/template.service";
import { validateTemplateForMetaSubmission } from "@/server/services/whatsapp-template-validation.service";
import SubmitTemplateButton from "./submit-template-button";
import SyncWhatsAppTemplatesButton from "./sync-whatsapp-templates-button";
import TemplateRowActions from "./template-row-actions";

function templateSnippet(body: string) {
  if (!body) return "No preview available";
  return body.length > 48 ? `${body.slice(0, 48)}...` : body;
}

function formatTemplateDate(date?: Date | null) {
  if (!date) return "--";

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function templateStatusLabel(status: string) {
  const labels: Record<string, string> = {
    APPROVED: "Approved",
    DELETED: "Deleted",
    DISABLED: "Disabled",
    DRAFT: "Draft",
    IN_APPEAL: "In appeal",
    LIMIT_EXCEEDED: "Limited",
    PAUSED: "Paused",
    PENDING: "Pending",
    PENDING_APPROVAL: "Pending",
    REINSTATED: "Reinstated",
    REJECTED: "Rejected",
    SUBMITTING: "Submitting",
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function templateQualityLabel(qualityScore?: string | null) {
  if (!qualityScore) return "Unknown";

  return qualityScore
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function templateOperationalNote(
  template: Awaited<ReturnType<typeof getTemplatesByCompany>>[number],
) {
  if (template.status === "REJECTED" && template.rejectionReason) {
    return template.rejectionReason;
  }

  if (template.lastSubmitError) {
    return template.lastSubmitError;
  }

  if (template.status === "APPROVED") {
    return template.lastSyncedAt
      ? `Synced ${formatTemplateDate(template.lastSyncedAt)}`
      : "Ready for sending";
  }

  if (template.status === "PENDING" || template.status === "PENDING_APPROVAL") {
    return template.lastSubmittedAt
      ? `Submitted ${formatTemplateDate(template.lastSubmittedAt)}`
      : "Waiting for Meta review";
  }

  if (template.status === "SUBMITTING") {
    return "Submitting to Meta";
  }

  if (template.status === "PAUSED") {
    return "Paused by Meta; sync again after quality improves";
  }

  if (template.status === "IN_APPEAL") {
    return "In appeal with Meta";
  }

  const validation = validateTemplateForMetaSubmission(template);

  if (!validation.canSubmit) {
    return validation.errors[0]?.message ?? "Needs fixes before Meta submission";
  }

  if (validation.warnings.length > 0) {
    return validation.warnings[0]?.message;
  }

  return "Ready to submit";
}

const templateTableColumns =
  "grid-cols-[178px_82px_94px_126px_86px_74px_82px_106px_106px_308px]";

export default async function TemplatesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const templates = await getTemplatesByCompany(context.membership.companyId);
  const templateIds = templates.map((template) => template.id);
  const [sentGroups, readGroups] =
    templateIds.length > 0
      ? await Promise.all([
          prisma.message.groupBy({
            by: ["templateId"],
            where: {
              companyId: context.membership.companyId,
              templateId: {
                in: templateIds,
              },
              status: {
                in: ["SENT", "DELIVERED", "READ"],
              },
            },
            _count: true,
          }),
          prisma.message.groupBy({
            by: ["templateId"],
            where: {
              companyId: context.membership.companyId,
              templateId: {
                in: templateIds,
              },
              status: "READ",
            },
            _count: true,
          }),
        ])
      : [[], []];

  const sentCounts = new Map(
    sentGroups.map((group) => [group.templateId, group._count]),
  );
  const readCounts = new Map(
    readGroups.map((group) => [group.templateId, group._count]),
  );
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#081B3A]">Templates</h1>
          <p className="mt-1 text-sm text-[#526173]">
            Build, submit, sync, and manage approved WhatsApp templates.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SyncWhatsAppTemplatesButton canManage={canManage} />
          <Link href="/dashboard/templates/new" className={actionButtonClass("secondary")}>
            <CopyPlus className="mr-2 h-4 w-4" />
            Create Bulk Template
          </Link>
          <Link href="/dashboard/templates/new" className={actionButtonClass()}>
            <CopyPlus className="mr-2 h-4 w-4" />
            Create Template
          </Link>
        </div>
      </div>

      <details className="group mb-8 rounded-xl border border-[#BFE9D0] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-base text-[#081B3A]">
          <ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
          What are WhatsApp Templates? How to use this page?
        </summary>
        <div className="border-t border-[#BFE9D0] px-5 py-4 text-sm leading-6 text-[#526173]">
          Drafts are validated locally, submitted to Meta for review, then synced
          back with the final Meta category, status, quality, and rejection
          reason. Only approved templates can be used in campaigns or automation.
        </div>
      </details>

      <section className="overflow-hidden rounded-md bg-white shadow-[0_16px_40px_rgba(8,27,58,0.06)]">
        <div className="overflow-x-auto">
          <div className="min-w-[1272px]">
            <div
              className={[
                "grid border-b border-[#EDEDED] bg-white text-left text-xs font-semibold text-black",
                templateTableColumns,
              ].join(" ")}
            >
              {[
                "Name",
                "Type",
                "Category",
                "Language",
                "Status",
                "Quality",
                "Sent",
                "Read/Open",
                "Last synced",
                "Actions",
              ].map((heading) => (
                <div
                  key={heading}
                  className="flex min-w-0 items-center justify-between gap-2 border-r border-[#F0F0F0] px-3 py-2.5 last:border-r-0"
                >
                  <span className="truncate">{heading}</span>
                  {heading !== "Actions" ? (
                    <Filter className="h-3.5 w-3.5 shrink-0 fill-[#B9B9B9] text-[#B9B9B9]" />
                  ) : null}
                </div>
              ))}
            </div>

            {templates.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-[#526173]">
                No templates created yet.
              </div>
            ) : (
              <div className="divide-y divide-[#EDEDED]">
                {templates.map((template) => {
                  const draft = canonicalizeTemplateDraft(template);
                  const sent = sentCounts.get(template.id) ?? 0;
                  const read = readCounts.get(template.id) ?? 0;

                  return (
                    <div
                      key={template.id}
                      className={[
                        "grid min-h-[76px] items-center text-xs text-black",
                        templateTableColumns,
                      ].join(" ")}
                    >
                      <div className="min-w-0 px-3 py-2 text-sm">
                        <Link
                          href={`/dashboard/templates/${template.id}`}
                          className="block truncate font-medium text-[#081B3A] hover:text-[#128C7E]"
                        >
                          {template.name}
                        </Link>
                        <p className="mt-1 truncate text-xs text-[#8B8B96]">
                          {templateSnippet(template.body)}
                        </p>
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <p className="truncate">{draft.templateType}</p>
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <p className="truncate">{template.category}</p>
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <p className="truncate">{template.language}</p>
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <StatusPill tone={statusTone(template.status)}>
                          {templateStatusLabel(template.status)}
                        </StatusPill>
                        <p className="mt-1 flex min-w-0 items-start gap-1 text-[11px] leading-4 text-[#526173]">
                          {template.status === "APPROVED" ? (
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#128C7E]" />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#B7791F]" />
                          )}
                          <span className="line-clamp-2">
                            {templateOperationalNote(template)}
                          </span>
                        </p>
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <p className="truncate">{templateQualityLabel(template.qualityScore)}</p>
                      </div>
                      <div className="px-3 py-2">
                        <p>{sent}</p>
                      </div>
                      <div className="px-3 py-2">
                        <p>{read}</p>
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <p className="truncate">{formatTemplateDate(template.lastSyncedAt)}</p>
                        <p className="mt-1 truncate text-[11px] text-[#526173]">
                          Edited {formatTemplateDate(template.updatedAt)}
                        </p>
                      </div>
                      <div className="flex min-w-0 items-center justify-end gap-1 px-3 py-2">
                        <SubmitTemplateButton
                          canManage={canManage}
                          templateId={template.id}
                          status={template.status}
                        />
                        <TemplateRowActions
                          canManage={canManage}
                          status={template.status}
                          templateId={template.id}
                          templateName={template.name}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] px-4 py-3 text-sm leading-6 text-[#526173]">
        <Send className="mt-1 h-4 w-4 shrink-0 text-[#128C7E]" />
        <p>
          Sending is locked to approved templates. If Meta changes a submitted
          Utility template to Marketing, the next sync or webhook updates the
          local category automatically.
        </p>
      </div>
    </div>
  );
}
