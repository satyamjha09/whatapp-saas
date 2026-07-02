import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { ensureAutomationFlowDraft } from "@/server/services/automation-versioning.service";

export default async function AutomationBuilderPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const flow = await ensureAutomationFlowDraft({
    actorUserId: context.user.id,
    companyId: context.membership.companyId,
  });

  redirect(`/dashboard/automation/builder/${flow.id}`);
}
