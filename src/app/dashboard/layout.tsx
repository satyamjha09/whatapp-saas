import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/app/dashboard/dashboard-shell";
import MaintenanceModeBanner from "@/app/dashboard/maintenance-mode-banner";
import NotificationBadge from "@/app/dashboard/notification-badge";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertCompanyHasActivePlan } from "@/server/services/company-plan-assignment.service";
import { getCompanyOnboardingState } from "@/server/services/company-onboarding-state.service";
import { getCompanyTrustAcceptanceStatus } from "@/server/services/trust-center.service";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const bypassesOnboardingGate = pathname.startsWith("/dashboard/onboarding");
  const bypassesPlanGate = pathname.startsWith("/dashboard/account/plan");
  const bypassesLegalGate =
    bypassesOnboardingGate ||
    bypassesPlanGate ||
    pathname.startsWith("/dashboard/legal/acceptance") ||
    pathname.startsWith("/dashboard/system/trust-center");

  if (!bypassesOnboardingGate) {
    const onboardingState = await getCompanyOnboardingState(
      context.membership.companyId,
    );

    if (onboardingState.shouldShowGate) {
      redirect("/dashboard/onboarding");
    }
  }

  if (!bypassesPlanGate && context.membership.company.status === "ACTIVE") {
    await assertCompanyHasActivePlan(context.membership.companyId);
  }

  if (!bypassesLegalGate) {
    const trustStatus = await getCompanyTrustAcceptanceStatus({
      companyId: context.membership.companyId,
    });

    if (trustStatus.required && !trustStatus.isComplete) {
      redirect("/dashboard/legal/acceptance");
    }
  }

  return (
    <DashboardShell
      companyName={context.membership.company.name}
      userName={context.user.name ?? context.user.email}
      userRole={context.membership.role}
      notificationBadge={
        <NotificationBadge
          companyId={context.membership.companyId}
          userId={context.user.id}
        />
      }
    >
      <MaintenanceModeBanner />
      {children}
    </DashboardShell>
  );
}
