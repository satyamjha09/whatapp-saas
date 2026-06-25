import { redirect } from "next/navigation";
import { OnboardingActions } from "@/app/dashboard/onboarding/onboarding-actions";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCompanyOnboardingState } from "@/server/services/company-onboarding-state.service";
import { isCompanyAdmin } from "@/server/tenant/tenant-rules";

export default async function DashboardOnboardingPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const state = await getCompanyOnboardingState(context.membership.companyId);

  if (context.membership.company.status === "ACTIVE") {
    redirect("/dashboard");
  }

  return (
    <OnboardingActions
      canManage={isCompanyAdmin(context.membership.role)}
      initialState={state}
    />
  );
}
