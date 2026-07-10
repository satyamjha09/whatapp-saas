import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, CopyPlus, Pencil } from "lucide-react";
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
import SubmitTemplateButton from "../../submit-template-button";
import TemplateRowActions from "../../template-row-actions";

function formatDate(date?: Date | null) {
  if (!date) return "--";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function TemplateEditPage({
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

  const draft = canonicalizeTemplateDraft(template);
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const isLockedByMeta = !["DRAFT", "REJECTED"].includes(template.status);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#128C7E]">
            Template Editor
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            {template.name}
          </h1>
          <p className="mt-1 text-sm text-[#526173]">
            Last edited {formatDate(template.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/dashboard/templates/${template.id}`}
            className={actionButtonClass("secondary")}
          >
            Back to Template
          </Link>
          <Link href="/dashboard/templates/new" className={actionButtonClass()}>
            <CopyPlus className="mr-2 h-4 w-4" />
            New Template
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <PanelTitle
              title="Edit Safety"
              description="Meta templates become immutable after submission. Duplicate to create a draft revision."
            />
            <StatusPill tone={statusTone(template.status)}>
              {template.status.replaceAll("_", " ")}
            </StatusPill>
          </div>

          {isLockedByMeta ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              <AlertTriangle className="mb-2 h-4 w-4" />
              This template has already entered the Meta lifecycle. To change
              text, variables, header, footer, or buttons, duplicate it first,
              edit the new draft, then submit that draft to Meta.
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] px-4 py-3 text-sm leading-6 text-[#526173]">
              Draft editing UI is backed by the same canonical template model.
              For this release, use Duplicate/New Template to create the next
              draft revision without risking submitted Meta records.
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["Type", draft.templateType],
              ["Category", template.category],
              ["Language", template.language],
              ["Variables", template.variables.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#BFE9D0] p-4">
                <p className="text-xs uppercase text-[#526173]">{label}</p>
                <p className="mt-2 text-sm font-semibold text-[#081B3A]">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <SubmitTemplateButton
              canManage={canManage}
              status={template.status}
              templateId={template.id}
            />
            <TemplateRowActions
              canManage={canManage}
              status={template.status}
              templateId={template.id}
              templateName={template.name}
            />
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Current Body" />
          <div className="mt-5 rounded-xl border border-[#BFE9D0] bg-white p-4 text-sm leading-6 text-[#081B3A]">
            <Pencil className="mb-3 h-4 w-4 text-[#128C7E]" />
            <p className="whitespace-pre-wrap break-words">{template.body}</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
