import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { ensureAutomationFlowDraft } from "@/server/services/automation-versioning.service";

export default async function AutomationBuilderPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canCreate = await checkUserAutomationPermission(
    context.membership.companyId,
    context.user.id,
    "automation.flow.create",
  );
  if (!canCreate) redirect("/dashboard");

  const flow = await ensureAutomationFlowDraft({
    actorUserId: context.user.id,
    companyId: context.membership.companyId,
  });

  redirect(`/dashboard/automation/builder/${flow.id}`);
}
