import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
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
    requestId
  );

  if (!request) {
    notFound();
  }

  const isManagement =
    context.membership.role === "OWNER" || context.membership.role === "ADMIN";

  return (
    <AutomationApprovalDetail
      request={request}
      currentUserId={context.user.id}
      isManagement={isManagement}
    />
  );
}
