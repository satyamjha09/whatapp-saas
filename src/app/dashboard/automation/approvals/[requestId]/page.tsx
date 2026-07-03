import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { getPublishRequestById } from "@/server/services/automation-publish-approval.service";
import AutomationApprovalDetail from "@/components/automation-approvals/automation-approval-detail";

type PageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function AutomationApprovalDetailPage({ params }: PageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { requestId } = await params;
  const request = await getPublishRequestById(
    context.membership.companyId,
    requestId,
    context.user.id
  );

  if (!request) {
    notFound();
  }

  const [canApprove, canReject] = await Promise.all([
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
  ]);

  return (
    <AutomationApprovalDetail
      request={request}
      currentUserId={context.user.id}
      isManagement={canApprove || canReject}
    />
  );
}
