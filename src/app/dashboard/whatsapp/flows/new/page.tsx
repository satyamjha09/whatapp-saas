import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import WhatsAppFlowForm from "../whatsapp-flow-form";

export default async function NewWhatsAppFlowPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Import WhatsApp Flow"
        description="Add an existing Meta Flow ID to your catalog. Meta Flow creation and publishing stays inside Meta for this MVP."
        actions={
          <Link
            href="/dashboard/whatsapp/flows"
            className={actionButtonClass("secondary")}
          >
            Back to Flows
          </Link>
        }
      />

      <Panel>
        <PanelTitle
          title="Flow details"
          description="Paste the Meta Flow ID, choose the default CTA, and mark it published when it is ready to send."
        />
        <div className="mt-6">
          <WhatsAppFlowForm />
        </div>
      </Panel>
    </div>
  );
}
