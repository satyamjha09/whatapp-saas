import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, actionButtonClass } from "@/app/dashboard/dashboard-ui";
import AutomationBuilder from "@/components/automation-builder/automation-builder";
import { AUTOMATION_PERMISSION_NAMES } from "@/lib/automation-permissions";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { getAutomationFlowDraft } from "@/server/services/automation-versioning.service";

type AutomationFlowBuilderPageProps = {
  params: Promise<{
    flowId: string;
  }>;
};

export default async function AutomationFlowBuilderPage({
  params,
}: AutomationFlowBuilderPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");
  const { membership } = context;

  const { flowId } = await params;
  const permissionEntries = await Promise.all(
    AUTOMATION_PERMISSION_NAMES.map(async (permission) => [
      permission,
      await checkUserAutomationPermission(
        membership.companyId,
        context.user.id,
        permission,
      ),
    ] as const),
  );
  const automationPermissions = Object.fromEntries(permissionEntries) as Record<
    (typeof AUTOMATION_PERMISSION_NAMES)[number],
    boolean
  >;

  if (!automationPermissions["automation.flow.view"]) {
    redirect("/dashboard");
  }

  const draft = await getAutomationFlowDraft(membership.companyId, flowId);

  if (!draft) redirect("/dashboard/automation/builder");

  return (
    <div>
      <PageHeader
        description="Edit the draft graph safely. Runtime uses only the latest published immutable version."
        eyebrow={membership.company.name}
        title={draft.flow.name}
        actions={
          <>
            {automationPermissions["automation.analytics.view"] ? (
              <Link
                href={`/dashboard/automation/flows/${flowId}/analytics`}
                className={actionButtonClass("secondary")}
              >
                Analytics
              </Link>
            ) : null}
            {automationPermissions["automation.execution.view"] ? (
              <Link
                href={`/dashboard/automation/executions?flowId=${flowId}`}
                className={actionButtonClass("secondary")}
              >
                Execution Logs
              </Link>
            ) : null}
          </>
        }
      />

      <AutomationBuilder
        flowId={flowId}
        userRole={membership.role}
        approvalRequired={membership.company.automationPublishApprovalRequired}
        permissions={automationPermissions}
        initialFlow={{
          currentVersionNumber: draft.publishedVersion?.versionNumber ?? null,
          description: draft.flow.description,
          hasUnpublishedChanges: draft.hasUnpublishedChanges,
          id: draft.flow.id,
          lastPublishedByUserId: draft.flow.lastPublishedByUserId,
          name: draft.flow.name,
          publishedAt: draft.flow.publishedAt?.toISOString() ?? null,
          publishedGraph: draft.publishedGraph,
          publishedVersionId: draft.flow.publishedVersionId,
          status: draft.flow.status,
          updatedAt: draft.flow.updatedAt.toISOString(),
          metadata: draft.flow.metadata,
        }}
        initialGraph={draft.draftGraph}
      />
    </div>
  );
}
