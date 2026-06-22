import { redirect } from "next/navigation";
import PlanFeatureLockCard from "@/app/dashboard/_components/plan-feature-lock-card";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { hasCompanyFeature } from "@/server/services/feature-gate.service";
import { getDeveloperApiUsage } from "@/server/services/developer-api-usage.service";
import DeveloperApiUsageCard from "./developer-api-usage-card";

export default async function DeveloperLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  if (
    !(await hasCompanyFeature(
      context.membership.companyId,
      "DEVELOPER_API",
    ))
  ) {
    return (
      <PlanFeatureLockCard
        title="Developer tools are locked"
        description="Upgrade this workspace to create API keys, call public APIs, and configure signed developer webhooks."
        requiredPlan="Growth"
      />
    );
  }

  const usage = await getDeveloperApiUsage(context.membership.companyId);

  return (
    <>
      <div className="px-8 pt-8">
        <div className="mx-auto max-w-6xl">
          <DeveloperApiUsageCard usage={usage} />
        </div>
      </div>
      {children}
    </>
  );
}
