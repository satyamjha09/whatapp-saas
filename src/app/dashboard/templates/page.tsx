import { FileText, Globe2, Tags } from "lucide-react";
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
import { getTemplatesByCompany } from "@/server/services/template.service";
import TemplateForm from "./template-form";

export default async function TemplatesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const templates = await getTemplatesByCompany(context.membership.companyId);
  const approvedTemplates = templates.filter(
    (template) => template.status === "APPROVED",
  ).length;
  const languages = new Set(templates.map((template) => template.language)).size;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Message templates"
        description="Create and review reusable WhatsApp template content. These are the real templates used by messages and campaigns."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={FileText}
          label="Total templates"
          value={templates.length.toLocaleString("en-IN")}
          detail="Created in this workspace"
        />
        <MetricCard
          icon={Tags}
          label="Approved"
          value={approvedTemplates.toLocaleString("en-IN")}
          detail="Ready for production sending"
        />
        <MetricCard
          icon={Globe2}
          label="Languages"
          value={languages.toLocaleString("en-IN")}
          detail="Unique language codes"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <TemplateForm />

        <Panel>
          <PanelTitle
            title="Saved templates"
            description="Template bodies and variables stored for this workspace."
          />

          {templates.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No templates created yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">
                        {template.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {template.language} - {template.category}
                      </p>
                    </div>

                    <StatusPill tone={statusTone(template.status)}>
                      {template.status}
                    </StatusPill>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-zinc-950/45 p-4 text-sm leading-6 text-zinc-300">
                    {template.body}
                  </p>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-zinc-500">
                      Variables
                    </p>

                    {template.variables.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-600">
                        No variables
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {template.variables.map((variable) => (
                          <StatusPill key={variable} tone="blue">
                            {variable}
                          </StatusPill>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
