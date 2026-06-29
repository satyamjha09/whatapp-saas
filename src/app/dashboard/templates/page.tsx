import Link from "next/link";
import { BarChart3, ChevronRight, CopyPlus, Filter, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getTemplatesByCompany } from "@/server/services/template.service";
import SubmitTemplateButton from "./submit-template-button";
import SyncWhatsAppTemplatesButton from "./sync-whatsapp-templates-button";

function templateSnippet(body: string) {
  if (!body) return "No preview available";
  return body.length > 34 ? `${body.slice(0, 34)}...` : body;
}

function formatTemplateDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function templateStatusClass(status: string) {
  if (status === "APPROVED") return "bg-[#F0FFE8] text-[#2BA500]";
  if (status === "DRAFT") return "bg-[#EAF5FF] text-[#0B74DE] ring-1 ring-[#C9E2F8]";
  if (["REJECTED", "DISABLED", "DELETED", "LIMIT_EXCEEDED"].includes(status)) {
    return "bg-rose-50 text-rose-600";
  }

  return "bg-[#FFF7DE] text-[#8A6500]";
}

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

      <details className="group mb-8 rounded-xl border border-[#D8E6F3] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-base text-[#081B3A]">
          <ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
          What are WhatsApp Templates? How to use this page?
        </summary>
        <div className="border-t border-[#D8E6F3] px-5 py-4 text-sm leading-6 text-[#526173]">
          Sync approved templates from Meta, review local drafts, and create new
          template drafts before submitting them for approval.
        </div>
      </details>

      <section className="overflow-hidden rounded-md bg-white">
        <div className="grid grid-cols-[20%_12%_10%_23%_18%_17%] border-b border-[#EDEDED] bg-white text-left text-sm font-semibold text-black">
          {["Template Name", "Category", "Status", "Language", "Creation Time", "Actions"].map((heading) => (
            <div
              key={heading}
              className="flex items-center justify-between border-r border-[#F0F0F0] px-5 py-4 last:border-r-0"
            >
              <span>{heading}</span>
              {heading !== "Actions" ? (
                <Filter className="h-4 w-4 fill-[#B9B9B9] text-[#B9B9B9]" />
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
                className="grid min-h-[96px] grid-cols-[20%_12%_10%_23%_18%_17%] items-center text-sm text-black"
              >
                <div className="truncate px-5 py-4 text-base">{template.name}</div>
                <div className="px-5 py-4">{template.category}</div>
                <div className="px-5 py-4">
                  <span
                    className={[
                      "inline-flex rounded-md px-2.5 py-1 text-xs font-medium",
                      templateStatusClass(template.status),
                    ].join(" ")}
                  >
                    {template.status}
                  </span>
                </div>
                <div className="min-w-0 px-5 py-4">
                  <p>{template.language}</p>
                  <p className="mt-1 truncate text-sm text-[#8B8B96]">
                    {templateSnippet(template.body)}
                  </p>
                </div>
                <div className="whitespace-nowrap px-5 py-4">
                  {formatTemplateDate(template.createdAt)}
                </div>
                <div className="flex flex-nowrap gap-2 px-5 py-4">
                  <SubmitTemplateButton
                    canManage={canManage}
                    templateId={template.id}
                    status={template.status}
                  />
                  <Link
                    href={`/dashboard/templates/${template.id}`}
                    className="inline-flex items-center rounded-md bg-[#E4F2FF] px-3 py-2 font-medium text-[#1677FF] hover:bg-[#D8ECFF]"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Insights
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-[#FFF1F0] px-3 py-2 font-medium text-[#FF3B3B] hover:bg-rose-100"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
