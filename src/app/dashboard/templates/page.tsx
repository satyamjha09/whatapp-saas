import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CopyPlus,
  FileText,
  Filter,
  Search,
  Send,
  X,
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

type TemplatesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_FILTER_OPTIONS = [
  ["DRAFT", "Draft"],
  ["SUBMITTING", "Submitting"],
  ["PENDING_APPROVAL", "Pending approval"],
  ["PENDING", "Pending"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
  ["PAUSED", "Paused"],
  ["DISABLED", "Disabled"],
  ["DELETED", "Deleted"],
] as const;

const CATEGORY_FILTER_OPTIONS = [
  ["MARKETING", "Marketing"],
  ["UTILITY", "Utility"],
  ["AUTHENTICATION", "Authentication"],
] as const;

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeTemplateFilters(
  params: Record<string, string | string[] | undefined> | undefined,
) {
  return {
    category: firstQueryValue(params?.category).trim().toUpperCase(),
    language: firstQueryValue(params?.language).trim(),
    search: firstQueryValue(params?.search).trim(),
    status: firstQueryValue(params?.status).trim().toUpperCase(),
  };
}

function languageLabel(language: string) {
  const labels: Record<string, string> = {
    en: "English",
    en_US: "English (US)",
    hi: "Hindi",
  };

  return labels[language] ?? language;
}

function buildTemplateFilterHref(
  filters: ReturnType<typeof normalizeTemplateFilters>,
  removeKey?: keyof ReturnType<typeof normalizeTemplateFilters>,
) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || key === removeKey) return;
    params.set(key, value);
  });

  const query = params.toString();
  return query ? `/dashboard/templates?${query}` : "/dashboard/templates";
}

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
  "grid-cols-[220px_90px_116px_128px_144px_92px_70px_82px_134px_246px]";
const filterableTableHeadings = new Set([
  "Name",
  "Type",
  "Category",
  "Language",
  "Status",
  "Quality",
  "Last sync",
]);

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const filters = normalizeTemplateFilters(await searchParams);
  const templates = await getTemplatesByCompany(context.membership.companyId);
  const languageOptions = Array.from(
    new Set(templates.map((template) => template.language).filter(Boolean)),
  ).sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)));
  const filteredTemplates = templates.filter((template) => {
    const search = filters.search.toLowerCase();
    const searchable = [
      template.name,
      template.body,
      template.metaTemplateId ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!search || searchable.includes(search)) &&
      (!filters.category || template.category === filters.category) &&
      (!filters.language || template.language === filters.language) &&
      (!filters.status || template.status === filters.status)
    );
  });
  const templateIds = filteredTemplates.map((template) => template.id);
  const activeFilters = [
    filters.search
      ? {
          href: buildTemplateFilterHref(filters, "search"),
          label: `Search: ${filters.search}`,
        }
      : null,
    filters.category
      ? {
          href: buildTemplateFilterHref(filters, "category"),
          label:
            CATEGORY_FILTER_OPTIONS.find(([value]) => value === filters.category)?.[1] ??
            filters.category,
        }
      : null,
    filters.language
      ? {
          href: buildTemplateFilterHref(filters, "language"),
          label: languageLabel(filters.language),
        }
      : null,
    filters.status
      ? {
          href: buildTemplateFilterHref(filters, "status"),
          label:
            STATUS_FILTER_OPTIONS.find(([value]) => value === filters.status)?.[1] ??
            templateStatusLabel(filters.status),
        }
      : null,
  ].filter(
    (filter): filter is { href: string; label: string } => filter !== null,
  );
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
        <div className="flex flex-wrap items-center gap-3">
          <SyncWhatsAppTemplatesButton canManage={canManage} />
        </div>
      </div>

      <details className="group mb-8 rounded-2xl border border-[#D5F0E2] bg-white/80">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-semibold text-[#081B3A]">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
            <ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
          </span>
          What are WhatsApp Templates? How to use this page?
        </summary>
        <div className="border-t border-[#E1F3E9] px-5 py-4 text-sm leading-6 text-[#526173]">
          Drafts are validated locally, submitted to Meta for review, then synced
          back with the final Meta category, status, quality, and rejection
          reason. Only approved templates can be used in campaigns or automation.
        </div>
      </details>

      <section className="mb-6 rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_16px_40px_rgba(8,27,58,0.06)]">
        <form className="grid gap-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
            <input
              className="h-12 w-full rounded-xl border border-[#BFE9D0] bg-white py-3 pl-10 pr-4 text-sm text-[#081B3A] outline-none transition placeholder:text-[#526173]/60 focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10"
              defaultValue={filters.search}
              name="search"
              placeholder="Search templates..."
            />
          </label>

          <div className="grid gap-3 lg:grid-cols-[170px_170px_180px_auto] lg:items-center">
            <select
              className="h-12 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm font-medium text-[#081B3A] outline-none transition focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10"
              defaultValue={filters.category}
              name="category"
            >
              <option value="">All categories</option>
              {CATEGORY_FILTER_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              className="h-12 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm font-medium text-[#081B3A] outline-none transition focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10"
              defaultValue={filters.language}
              name="language"
            >
              <option value="">All languages</option>
              {languageOptions.map((language) => (
                <option key={language} value={language}>
                  {languageLabel(language)}
                </option>
              ))}
            </select>

            <select
              className="h-12 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm font-medium text-[#081B3A] outline-none transition focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10"
              defaultValue={filters.status}
              name="status"
            >
              <option value="">All statuses</option>
              {STATUS_FILTER_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button className={actionButtonClass("secondary")} type="submit">
                Apply filters
              </button>
              <Link
                href="/dashboard/templates/create"
                className={actionButtonClass()}
              >
                <CopyPlus className="mr-2 h-4 w-4" />
                Create Template
              </Link>
            </div>
          </div>
        </form>

        {activeFilters.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => (
              <Link
                className="inline-flex items-center gap-1 rounded-full bg-[#E7F8EF] px-3 py-1.5 text-xs font-semibold text-[#128C7E] ring-1 ring-[#BFE9D0]"
                href={filter.href}
                key={filter.label}
              >
                {filter.label}
                <X className="h-3 w-3" />
              </Link>
            ))}
            <Link
              className="text-xs font-semibold text-[#526173] transition hover:text-[#128C7E]"
              href="/dashboard/templates"
            >
              Clear all
            </Link>
            <span className="ml-auto text-xs text-[#526173]">
              Showing {filteredTemplates.length} of {templates.length}
            </span>
          </div>
        ) : (
          <div className="mt-4 flex justify-end text-xs text-[#526173]">
            Showing {filteredTemplates.length} of {templates.length}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_rgba(8,27,58,0.06)]">
        <div className="overflow-x-auto scrollbar-thin scrollbar-track-[#EEF4F1] scrollbar-thumb-[#8BD8C9]">
          <div className="min-w-[1322px]">
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
                "Read",
                "Last sync",
                "Actions",
              ].map((heading) => (
                <div
                  key={heading}
                  title={heading}
                  className="flex min-w-0 items-center justify-between gap-2 border-r border-[#F0F0F0] px-3 py-2.5 last:border-r-0"
                >
                  <span className="truncate">{heading}</span>
                  {filterableTableHeadings.has(heading) ? (
                    <Filter className="h-3.5 w-3.5 shrink-0 fill-[#B9B9B9] text-[#B9B9B9]" />
                  ) : null}
                </div>
              ))}
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="grid min-h-[260px] place-items-center px-5 py-12 text-center">
                <div className="mx-auto max-w-md">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#E7F8EF] text-[#128C7E] ring-1 ring-[#BFE9D0]">
                    <FileText className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-lg font-extrabold text-[#081B3A]">
                    {templates.length === 0
                      ? "Create your first WhatsApp template"
                      : "No templates match these filters"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#526173]">
                    {templates.length === 0
                      ? "Start with a marketing or utility template, submit it to Meta, then use approved templates in broadcasts and automation."
                      : "Try clearing one filter or search by template name, language, body text, or Meta template ID."}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {templates.length === 0 ? (
                      <Link
                        href="/dashboard/templates/create"
                        className={actionButtonClass()}
                      >
                        <CopyPlus className="mr-2 h-4 w-4" />
                        Create your first template
                      </Link>
                    ) : (
                      <Link
                        href="/dashboard/templates"
                        className={actionButtonClass("secondary")}
                      >
                        Clear filters
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#EDEDED]">
                {filteredTemplates.map((template) => {
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
