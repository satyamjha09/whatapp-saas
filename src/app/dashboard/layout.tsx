import { redirect } from "next/navigation";
import { DashboardShell } from "@/app/dashboard/dashboard-shell";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

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

  return (
    <DashboardShell
      companyName={context.membership.company.name}
      userName={context.user.name ?? context.user.email}
      userRole={context.membership.role}
    >
      {children}
    </DashboardShell>
  );
}
