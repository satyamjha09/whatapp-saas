import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppFlowById } from "@/server/services/whatsapp-flow.service";
import SendTestFlowForm from "./send-test-flow-form";

type WhatsAppFlowDetailPageProps = {
  params: Promise<{
    flowId: string;
  }>;
};

function statusTone(status: string) {
  if (status === "PUBLISHED") return "green" as const;
  if (status === "DRAFT") return "amber" as const;
  if (status === "DISABLED") return "red" as const;
  return "zinc" as const;
}

export default async function WhatsAppFlowDetailPage({
  params,
}: WhatsAppFlowDetailPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { flowId } = await params;
  const flow = await getWhatsAppFlowById({
    companyId: context.membership.companyId,
    flowId,
  });

  if (!flow) notFound();

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title={flow.name}
        description={flow.description ?? "Imported WhatsApp Flow"}
        actions={
          <Link
            href="/dashboard/whatsapp/flows"
            className={actionButtonClass("secondary")}
          >
            Back to Flows
          </Link>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <PanelTitle
              title="Flow settings"
              description="This MVP sends existing Meta Flows using the saved Meta Flow ID."
            />
            <StatusPill tone={statusTone(flow.status)}>{flow.status}</StatusPill>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#D8E6F3] p-4">
              <dt className="text-xs text-[#526173]">Meta Flow ID</dt>
              <dd className="mt-1 font-semibold text-[#081B3A]">
                {flow.metaFlowId}
              </dd>
            </div>
            <div className="rounded-xl border border-[#D8E6F3] p-4">
              <dt className="text-xs text-[#526173]">Use case</dt>
              <dd className="mt-1 font-semibold text-[#081B3A]">
                {flow.useCase.replaceAll("_", " ")}
              </dd>
            </div>
            <div className="rounded-xl border border-[#D8E6F3] p-4">
              <dt className="text-xs text-[#526173]">CTA</dt>
              <dd className="mt-1 font-semibold text-[#081B3A]">
                {flow.defaultCta}
              </dd>
            </div>
            <div className="rounded-xl border border-[#D8E6F3] p-4">
              <dt className="text-xs text-[#526173]">Start screen</dt>
              <dd className="mt-1 font-semibold text-[#081B3A]">
                {flow.defaultScreen ?? "Meta default"}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel>
          <PanelTitle
            title="Send test"
            description="Queue this Flow to one phone number using the message worker."
          />
          <div className="mt-5">
            <SendTestFlowForm flowId={flow.id} />
          </div>
        </Panel>
      </section>

      <Panel className="mt-5 overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#D8E6F3] px-5 py-4">
          <PanelTitle
            title="Responses"
            description="Submitted Flow payloads captured from WhatsApp webhooks."
          />
        </div>

        {flow.responses.length === 0 ? (
          <p className="p-5 text-sm text-[#526173]">No responses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#F0F8FF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Flow token</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6F3]">
                {flow.responses.map((response) => (
                  <tr key={response.id}>
                    <td className="px-5 py-4">
                      {response.contact
                        ? `${response.contact.name ?? "Unnamed"} (+${response.contact.countryCode}${response.contact.phoneNumber})`
                        : "Unknown contact"}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[#526173]">
                      {response.flowToken}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {response.submittedAt.toLocaleString()}
                    </td>
                    <td className="max-w-md px-5 py-4">
                      <pre className="max-h-36 overflow-auto rounded-lg bg-[#F0F8FF] p-3 text-xs text-[#081B3A]">
                        {JSON.stringify(response.responsePayload, null, 2)}
                      </pre>
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
