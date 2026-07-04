import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Clock3,
  Workflow,
} from "lucide-react";
import AutomationBuilder from "@/components/automation-builder/automation-builder";
import { AUTOMATION_PERMISSION_NAMES } from "@/lib/automation-permissions";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertCompanyHasActivePlan } from "@/server/services/company-plan-assignment.service";
import { getCompanyOnboardingState } from "@/server/services/company-onboarding-state.service";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { getAutomationFlowDraft } from "@/server/services/automation-versioning.service";
import { getCompanyTrustAcceptanceStatus } from "@/server/services/trust-center.service";

type AutomationFlowBuilderPageProps = {
  params: Promise<{
    flowId: string;
  }>;
};

type FlowStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";

const statusClasses: Record<FlowStatus, string> = {
  ARCHIVED: "bg-slate-100 text-slate-600 ring-slate-200",
  DRAFT: "bg-sky-50 text-sky-700 ring-sky-200",
  PAUSED: "bg-amber-100 text-amber-700 ring-amber-200",
  PUBLISHED: "bg-[#E7F8EF] text-[#128C7E] ring-[#BFE9D0]",
};

function formatUpdatedAt(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(value);
}

async function assertAutomationBuilderWorkspace() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const onboardingState = await getCompanyOnboardingState(
    context.membership.companyId,
  );

  if (onboardingState.shouldShowGate) {
    redirect("/dashboard/onboarding");
  }

  if (context.membership.company.status === "ACTIVE") {
    await assertCompanyHasActivePlan(context.membership.companyId);
  }

  const trustStatus = await getCompanyTrustAcceptanceStatus({
    companyId: context.membership.companyId,
  });

  if (trustStatus.required && !trustStatus.isComplete) {
    redirect("/dashboard/legal/acceptance");
  }

  return context;
}

export default async function AutomationFlowBuilderPage({
  params,
}: AutomationFlowBuilderPageProps) {
  const context = await assertAutomationBuilderWorkspace();
  const membership = context.membership;

  if (!membership) redirect("/onboarding");

  const { flowId } = await params;
  const permissionEntries = await Promise.all(
    AUTOMATION_PERMISSION_NAMES.map(
      async (permission) =>
        [
          permission,
          await checkUserAutomationPermission(
            membership.companyId,
            context.user.id,
            permission,
          ),
        ] as const,
    ),
  );
  const automationPermissions = Object.fromEntries(permissionEntries) as Record<
    (typeof AUTOMATION_PERMISSION_NAMES)[number],
    boolean
  >;

  if (!automationPermissions["automation.flow.view"]) {
    redirect("/dashboard");
  }

  const draft = await getAutomationFlowDraft(membership.companyId, flowId);

  if (!draft) redirect("/automation/builder");

  const flowStatus = draft.flow.status as FlowStatus;
  const versionLabel = draft.publishedVersion?.versionNumber
    ? `Version ${draft.publishedVersion.versionNumber}`
    : "Draft version";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[#BFE9D0] bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(8,27,58,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BFE9D0] bg-white text-[#128C7E] transition hover:bg-[#E7F8EF]"
              href="/dashboard/automation"
              title="Back to automation"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E] sm:grid">
              <Workflow className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
                {membership.company.name}
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="max-w-[42rem] truncate text-lg font-bold text-[#081B3A]">
                  {draft.flow.name}
                </h1>
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                    statusClasses[flowStatus],
                  ].join(" ")}
                >
                  {flowStatus}
                </span>
                <span className="inline-flex items-center rounded-full bg-[#F7FBFF] px-2.5 py-1 text-xs font-semibold text-[#526173] ring-1 ring-[#D6EADF]">
                  {versionLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#526173] md:inline-flex">
              <Clock3 className="h-3.5 w-3.5 text-[#128C7E]" />
              Updated {formatUpdatedAt(draft.flow.updatedAt)}
            </span>
            {automationPermissions["automation.analytics.view"] ? (
              <Link
                className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                href={`/dashboard/automation/flows/${flowId}/analytics`}
              >
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                Analytics
              </Link>
            ) : null}
            {automationPermissions["automation.execution.view"] ? (
              <Link
                className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                href={`/dashboard/automation/executions?flowId=${flowId}`}
              >
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                Logs
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden">
        <AutomationBuilder
          flowId={flowId}
          layout="fullscreen"
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
      </section>
    </div>
  );
}
