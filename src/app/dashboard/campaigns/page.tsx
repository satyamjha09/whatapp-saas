import Link from "next/link";
import { CheckCircle2, Layers3, RadioTower, Send } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCampaignsByCompany } from "@/server/services/campaign.service";
import { getContactsByCompany } from "@/server/services/contact.service";
import { getTemplatesByCompany } from "@/server/services/template.service";
import { prisma } from "@/lib/prisma";
import CampaignForm from "./campaign-form";
import StartCampaignButton from "./start-campaign-button";

export default async function CampaignsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const companyId = context.membership.companyId;

  const [campaigns, contacts, templates, bulkBatches] = await Promise.all([
    getCampaignsByCompany(companyId),
    getContactsByCompany(companyId),
    getTemplatesByCompany(companyId),
    prisma.bulkMessageBatch.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const runningCampaigns = campaigns.filter(
    (campaign) => campaign.status === "RUNNING",
  ).length;
  const totalQueued = campaigns.reduce(
    (total, campaign) => total + campaign.queuedCount,
    0,
  );
  const totalDelivered = campaigns.reduce(
    (total, campaign) => total + campaign.deliveredCount,
    0,
  );
  const approvedTemplates = templates.filter(
    (template) => template.status === "APPROVED",
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Campaigns"
        description="Create draft campaigns from real contacts and templates, then track queued, delivered, read, and failed counts."
        actions={
          <Link href="/dashboard/messages/bulk" className={actionButtonClass()}>
            <Send className="mr-2 h-4 w-4" />
            New Bulk Message
          </Link>
        }
      />

      {contacts.length === 0 || approvedTemplates.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-200">
          Before creating a campaign, create at least one contact and one
          approved template.
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={RadioTower}
          label="Campaigns"
          value={campaigns.length.toLocaleString("en-IN")}
          detail={`${runningCampaigns.toLocaleString("en-IN")} running`}
        />
        <MetricCard
          icon={Send}
          label="Queued messages"
          value={totalQueued.toLocaleString("en-IN")}
          detail="Across all campaigns"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Delivered"
          value={totalDelivered.toLocaleString("en-IN")}
          detail="Confirmed campaign deliveries"
        />
        <MetricCard
          icon={Layers3}
          label="Bulk batches"
          value={bulkBatches.length.toLocaleString("en-IN")}
          detail="Latest tracked bulk sends"
        />
      </section>

      <Panel className="mb-6 overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Bulk campaign history"
            description="Tracked CSV and pasted-recipient batches, including duplicates and queue failures."
          />
        </div>

        {bulkBatches.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No bulk message batches yet.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Group</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Scheduled</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Queued</th>
                  <th className="px-5 py-3">Failed</th>
                  <th className="px-5 py-3">Duplicates</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {bulkBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-5 py-4 font-semibold text-[#081B3A]">
                      {batch.templateName ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {batch.contactGroupName ?? "CSV / Manual"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(batch.status)}>
                        {batch.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {batch.scheduledAt
                        ? batch.scheduledAt.toLocaleString()
                        : "Immediate"}
                    </td>
                    <td className="px-5 py-4">{batch.requestedCount}</td>
                    <td className="px-5 py-4">{batch.queuedCount}</td>
                    <td className="px-5 py-4">{batch.failedCount}</td>
                    <td className="px-5 py-4">
                      {batch.skippedDuplicateCount}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {batch.createdAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/dashboard/campaigns/${batch.id}`}
                          className="font-semibold text-[#128C7E] hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/reports/campaigns/${batch.id}`}
                          className="font-semibold text-[#128C7E] hover:underline"
                        >
                          Report
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <CampaignForm contacts={contacts} templates={approvedTemplates} />

        <Panel>
          <PanelTitle
            title="Saved campaigns"
            description="Real campaign records and their stored delivery counters."
          />

          {campaigns.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No campaigns created yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">
                        {campaign.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Template: {campaign.template.name}
                      </p>
                    </div>

                    <StatusPill tone={statusTone(campaign.status)}>
                      {campaign.status}
                    </StatusPill>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/[0.045] p-3">
                      <p className="text-xs text-zinc-500">Contacts</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {campaign.totalContacts}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/[0.045] p-3">
                      <p className="text-xs text-zinc-500">Queued</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {campaign.queuedCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/[0.045] p-3">
                      <p className="text-xs text-zinc-500">Failed</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {campaign.failedCount}
                      </p>
                    </div>
                  </div>

                  {campaign.status === "DRAFT" ? (
                    <StartCampaignButton campaignId={campaign.id} />
                  ) : null}

                  <div className="mt-4">
                    <p className="text-xs font-medium text-zinc-500">
                      Campaign contacts
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {campaign.contacts.slice(0, 5).map((item) => (
                        <StatusPill key={item.id} tone="blue">
                          {item.contact.name ?? item.contact.phoneNumber}
                        </StatusPill>
                      ))}

                      {campaign.contacts.length > 5 ? (
                        <StatusPill tone="zinc">
                          +{campaign.contacts.length - 5} more
                        </StatusPill>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-zinc-600">
                    Created {campaign.createdAt.toLocaleDateString()}
                  </p>

                  <div className="mt-4">
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
                    >
                      View campaign details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
