import { redirect } from "next/navigation";
import { PageHeader } from "@/app/dashboard/dashboard-ui";
import AutomationBuilder from "@/components/automation-builder/automation-builder";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

type AutomationFlowBuilderPageProps = {
  params: Promise<{
    flowId: string;
  }>;
};

export default async function AutomationFlowBuilderPage({
  params,
}: AutomationFlowBuilderPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { flowId } = await params;

  return (
    <div>
      <PageHeader
        description="Edit the visual WhatsApp automation graph. Runtime execution is intentionally outside this phase."
        eyebrow={context.membership.company.name}
        title="Automation Builder"
      />

      <AutomationBuilder flowId={flowId} />
    </div>
  );
}
