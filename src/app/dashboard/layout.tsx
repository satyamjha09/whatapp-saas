import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/app/dashboard/dashboard-shell";
import MaintenanceModeBanner from "@/app/dashboard/maintenance-mode-banner";
import NotificationBadge from "@/app/dashboard/notification-badge";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
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
  const bypassesLegalGate =
    pathname.startsWith("/dashboard/legal/acceptance") ||
    pathname.startsWith("/dashboard/system/trust-center");

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
