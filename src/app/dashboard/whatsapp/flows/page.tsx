import { Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppFlowsByCompany } from "@/server/services/whatsapp-flow.service";

function flowStatusTone(status: string) {
  if (status === "PUBLISHED") return "green" as const;
  if (status === "DRAFT") return "amber" as const;
  if (status === "DISABLED") return "red" as const;
  return "zinc" as const;
}

export default async function WhatsAppFlowsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const flows = await getWhatsAppFlowsByCompany(
    context.membership.companyId,
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="WhatsApp Flows"
        description="Import existing Meta Flows, send them to customers, and capture submitted responses."
        actions={
          <Link href="/dashboard/whatsapp/flows/new" className={actionButtonClass()}>
            <Plus className="mr-2 h-4 w-4" />
            Import Flow
          </Link>
        }
      />

      <Panel className="overflow-hidden p-0 sm:p-0">
        {flows.length === 0 ? (
          <div className="p-6">
            <EmptyState>No WhatsApp Flows imported yet.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#F0F8FF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Flow</th>
                  <th className="px-5 py-3">Meta Flow ID</th>
                  <th className="px-5 py-3">Use case</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Responses</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6F3]">
                {flows.map((flow) => (
                  <tr key={flow.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F0F8FF] text-[#0052CC]">
                          <Workflow className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-[#081B3A]">
                            {flow.name}
                          </p>
                          <p className="text-xs text-[#526173]">
                            {flow.defaultCta}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {flow.metaFlowId}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {flow.useCase.replaceAll("_", " ")}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={flowStatusTone(flow.status)}>
                        {flow.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      {flow._count.responses.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {flow.updatedAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/whatsapp/flows/${flow.id}`}
                        className="font-semibold text-[#0052CC] hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
