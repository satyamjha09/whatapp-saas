import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CopyPlus,
  Filter,
  Trash2,
} from "lucide-react";
import { redirect } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getTemplatesByCompany } from "@/server/services/template.service";
import { validateTemplateForMetaSubmission } from "@/server/services/whatsapp-template-validation.service";
import SubmitTemplateButton from "./submit-template-button";
import SyncWhatsAppTemplatesButton from "./sync-whatsapp-templates-button";

function templateSnippet(body: string) {
  if (!body) return "No preview available";
  return body.length > 42 ? `${body.slice(0, 42)}...` : body;
}

function formatTemplateDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function templateStatusClass(status: string) {
  if (status === "APPROVED") return "bg-[#F0FFE8] text-[#2BA500]";
  if (status === "DRAFT") return "bg-[#EAF5FF] text-[#128C7E] ring-1 ring-[#C9E2F8]";
  if (["REJECTED", "DISABLED", "DELETED", "LIMIT_EXCEEDED"].includes(status)) {
    return "bg-rose-50 text-rose-600";
  }

  return "bg-[#FFF7DE] text-[#8A6500]";
}

function templateStatusLabel(status: string) {
  const labels: Record<string, string> = {
    APPROVED: "Approved",
    DELETED: "Deleted",
    DISABLED: "Disabled",
    DRAFT: "Draft",
    LIMIT_EXCEEDED: "Limited",
    PENDING_APPROVAL: "Pending",
    REJECTED: "Rejected",
  };

  return labels[status] ?? status.replaceAll("_", " ");
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

  if (template.status === "PENDING_APPROVAL") {
    return template.lastSubmittedAt
      ? `Submitted ${formatTemplateDate(template.lastSubmittedAt)}; waiting for Meta approval`
      : "Waiting for Meta approval";
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
  "grid-cols-[200px_92px_176px_minmax(220px,1fr)_138px_96px]";

export default async function TemplatesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const templates = await getTemplatesByCompany(context.membership.companyId);
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#081B3A]">Templates</h1>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={actionButtonClass("secondary")}>
            Meta Actions
          </button>
          <SyncWhatsAppTemplatesButton canManage={canManage} />
          <Link href="/dashboard/templates/create" className={actionButtonClass("secondary")}>
            <CopyPlus className="mr-2 h-4 w-4" />
            Create Bulk Template
          </Link>
          <Link href="/dashboard/templates/create" className={actionButtonClass()}>
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
          Sync approved templates from Meta, review local drafts, and create new
          template drafts before submitting them for approval.
        </div>
      </details>

      <section className="overflow-hidden rounded-md bg-white shadow-[0_16px_40px_rgba(8,27,58,0.06)]">
        <div>
          <div>
            <div
              className={[
                "grid border-b border-[#EDEDED] bg-white text-left text-xs font-semibold text-black",
                templateTableColumns,
              ].join(" ")}
            >
              {["Template Name", "Category", "Status", "Language", "Creation Time", "Actions"].map((heading) => (
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
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={[
                      "grid min-h-[70px] items-center text-xs text-black",
                      templateTableColumns,
                    ].join(" ")}
                  >
                    <div className="min-w-0 px-3 py-2 text-sm">
                      <p className="truncate">{template.name}</p>
                    </div>
                    <div className="min-w-0 px-3 py-2">
                      <p className="truncate">{template.category}</p>
                    </div>
                    <div className="min-w-0 px-3 py-2">
                      <span
                        title={template.status}
                        className={[
                          "inline-flex max-w-full rounded-md px-2 py-1 text-center text-[11px] font-medium leading-3",
                          templateStatusClass(template.status),
                        ].join(" ")}
                      >
                        {templateStatusLabel(template.status)}
                      </span>
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
                      <p className="truncate">{template.language}</p>
                      <p className="mt-1 truncate text-sm text-[#8B8B96]">
                        {templateSnippet(template.body)}
                      </p>
                    </div>
                    <div className="whitespace-nowrap px-3 py-2">
                      {formatTemplateDate(template.createdAt)}
                    </div>
                    <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1 px-3 py-2">
                      <SubmitTemplateButton
                        canManage={canManage}
                        templateId={template.id}
                        status={template.status}
                      />
                      <Link
                        href={`/dashboard/templates/${template.id}`}
                        title="Insights"
                        aria-label={`Open insights for ${template.name}`}
                        className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#E7F8EF] text-[#128C7E] hover:bg-[#D7F2E1]"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        title="Delete"
                        aria-label={`Delete ${template.name}`}
                        className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#FFF1F0] text-[#FF3B3B] hover:bg-rose-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
