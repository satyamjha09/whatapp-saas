import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertCompanyHasActivePlan } from "@/server/services/company-plan-assignment.service";
import { getCompanyOnboardingState } from "@/server/services/company-onboarding-state.service";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { ensureAutomationFlowDraft } from "@/server/services/automation-versioning.service";
import { getCompanyTrustAcceptanceStatus } from "@/server/services/trust-center.service";

export default async function AutomationBuilderPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const onboardingState = await getCompanyOnboardingState(
    context.membership.companyId,
  );

  if (onboardingState.shouldShowGate) {
    redirect("/dashboard/onboarding");
  }

  if (context.membership.company.status === "ACTIVE") {
    await assertCompanyHasActivePlan(context.membership.companyId);
  }

  const trustStatus = await getCompanyTrustAcceptanceStatus({
    companyId: context.membership.companyId,
  });

  if (trustStatus.required && !trustStatus.isComplete) {
    redirect("/dashboard/legal/acceptance");
  }

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

  redirect(`/automation/builder/${flow.id}`);
}
