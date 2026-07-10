import Link from "next/link";
import { redirect } from "next/navigation";
import { actionButtonClass, PageHeader } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppFlowsByCompany } from "@/server/services/whatsapp-flow.service";
import WhatsAppFlowManagementClient from "./whatsapp-flow-management-client";

export default async function WhatsAppFlowsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const flows = await getWhatsAppFlowsByCompany(
    context.membership.companyId,
  );
  const serializedFlows = flows.map((flow) => ({
    categories: flow.categories,
    defaultCta: flow.defaultCta,
    defaultScreen: flow.defaultScreen,
    id: flow.id,
    isUsableForTemplates: flow.isUsableForTemplates,
    lastSyncedAt: flow.lastSyncedAt?.toISOString() ?? null,
    metaFlowId: flow.metaFlowId,
    name: flow.name,
    remoteMissingAt: flow.remoteMissingAt?.toISOString() ?? null,
    remoteStatus: flow.remoteStatus,
    responseCount: flow._count.responses,
    status: flow.status,
    updatedAt: flow.updatedAt.toISOString(),
    validationErrors: flow.validationErrors,
  }));

  return (
    <div>
      <PageHeader
        actions={
          <Link href="/dashboard/templates/new/flow" className={actionButtonClass()}>
            Create Flow Template
          </Link>
        }
        description="Sync and manage Flow assets connected to your WhatsApp Business Account."
        eyebrow={context.membership.company.name}
        title="WhatsApp Flows"
      />

      <WhatsAppFlowManagementClient
        canSync={
          context.membership.role === "OWNER" ||
          context.membership.role === "ADMIN"
        }
        flows={serializedFlows}
      />
    </div>
  );
}
