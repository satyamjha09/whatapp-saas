import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, actionButtonClass } from "@/app/dashboard/dashboard-ui";
import AutomationBuilder from "@/components/automation-builder/automation-builder";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
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

  const { flowId } = await params;
  const draft = await getAutomationFlowDraft(context.membership.companyId, flowId);

  if (!draft) redirect("/dashboard/automation/builder");

  return (
    <div>
      <PageHeader
        description="Edit the draft graph safely. Runtime uses only the latest published immutable version."
        eyebrow={context.membership.company.name}
        title={draft.flow.name}
        actions={
          <>
            <Link
              href={`/dashboard/automation/flows/${flowId}/analytics`}
              className={actionButtonClass("secondary")}
            >
              Analytics
            </Link>
            <Link
              href={`/dashboard/automation/executions?flowId=${flowId}`}
              className={actionButtonClass("secondary")}
            >
              Execution Logs
            </Link>
          </>
        }
      />

      <AutomationBuilder
        flowId={flowId}
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
