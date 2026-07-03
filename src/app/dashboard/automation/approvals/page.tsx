import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { listPublishRequests } from "@/server/services/automation-publish-approval.service";
import { PageHeader } from "@/app/dashboard/dashboard-ui";
import AutomationApprovalList from "@/components/automation-approvals/automation-approval-list";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    flowId?: string;
    page?: string;
  }>;
};

export default async function AutomationApprovalsPage({ searchParams }: PageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const sp = await searchParams;
  const [canApprove, canReject, canRequest] = await Promise.all([
    checkUserAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.flow.approve_publish",
    ),
    checkUserAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.flow.reject_publish",
    ),
    checkUserAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.flow.request_publish",
    ),
  ]);

  if (!canApprove && !canReject && !canRequest) {
    redirect("/dashboard");
  }

  const status = sp.status || undefined;
  const flowId = sp.flowId || undefined;
  const page = parseInt(sp.page || "1", 10);

  const { requests } = await listPublishRequests(
    context.membership.companyId,
    context.user.id,
    { status: status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "SUPERSEDED" | undefined, flowId, page, pageSize: 50 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Publish Approvals"
        description="Review, approve, or reject team automation publish requests before going live."
        eyebrow="Automation Management"
      />

      <AutomationApprovalList requests={requests} />
    </div>
  );
}
