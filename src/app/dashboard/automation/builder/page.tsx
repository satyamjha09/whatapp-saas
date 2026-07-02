import { redirect } from "next/navigation";
import { PageHeader } from "@/app/dashboard/dashboard-ui";
import AutomationBuilder from "@/components/automation-builder/automation-builder";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

export default async function AutomationBuilderPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  return (
    <div>
      <PageHeader
        description="Design WhatsApp automation flows with editable nodes, quick replies, conditions, templates, APIs, and human handoff."
        eyebrow={context.membership.company.name}
        title="Automation Builder"
      />

      <AutomationBuilder flowId="draft-whatsapp-flow" />
    </div>
  );
}
