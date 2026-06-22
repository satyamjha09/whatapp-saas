import { LayoutTemplate, Send } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import BulkTemplateMessageForm from "./bulk-template-message-form";
import { hasCompanyFeature } from "@/server/services/feature-gate.service";
import PlanFeatureLockCard from "@/app/dashboard/_components/plan-feature-lock-card";

export default async function BulkMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const params = await searchParams;
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canUseBulkCampaigns = await hasCompanyFeature(
    context.membership.companyId,
    "BULK_CAMPAIGNS",
  );
  if (!canUseBulkCampaigns) {
    return (
      <PlanFeatureLockCard
        title="Bulk campaigns are locked"
        description="Upgrade this workspace to send bulk campaigns and schedule messages to saved groups."
        requiredPlan="Starter"
      />
    );
  }

  const [templates, groups] = await Promise.all([
    prisma.template.findMany({
      where: {
        companyId: context.membership.companyId,
        status: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        language: true,
        category: true,
        body: true,
        variables: true,
      },
    }),
    prisma.contactGroup.findMany({
      where: { companyId: context.membership.companyId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    }),
  ]);
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const plan = getBillingPlanConfig(context.membership.company.billingPlan);
  const isSubscriptionActive =
    context.membership.company.billingPlan === "FREE" ||
    (!["PAST_DUE", "CANCELED"].includes(
      context.membership.company.subscriptionStatus,
    ) &&
      (!context.membership.company.currentPeriodEnd ||
        context.membership.company.currentPeriodEnd >= new Date()));

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Bulk Message"
        description={`Paste recipients, select an approved template, and queue up to ${plan.maxBulkRecipients.toLocaleString("en-IN")} messages on ${plan.name}.`}
        actions={
          <>
            <Link
              href="/dashboard/templates"
              className={actionButtonClass("secondary")}
            >
              <LayoutTemplate className="mr-2 h-4 w-4" />
              Templates
            </Link>
            <Link
              href="/dashboard/messages/send"
              className={actionButtonClass()}
            >
              <Send className="mr-2 h-4 w-4" />
              Single Message
            </Link>
          </>
        }
      />

      <BulkTemplateMessageForm
        canManage={canManage}
        templates={templates}
        groups={groups}
        initialGroupId={params.groupId}
        plan={{
          name: plan.name,
          maxBulkRecipients: plan.maxBulkRecipients,
          subscriptionStatus: context.membership.company.subscriptionStatus,
          currentPeriodEnd:
            context.membership.company.currentPeriodEnd?.toISOString() ?? null,
          isSubscriptionActive,
          cancelAtPeriodEnd: context.membership.company.cancelAtPeriodEnd,
        }}
      />
    </div>
  );
}
