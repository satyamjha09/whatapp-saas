import Link from "next/link";
import { CheckCircle2, RadioTower, Send } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCampaignsByCompany } from "@/server/services/campaign.service";
import { getContactsByCompany } from "@/server/services/contact.service";
import { getTemplatesByCompany } from "@/server/services/template.service";
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

  const [campaigns, contacts, templates] = await Promise.all([
    getCampaignsByCompany(companyId),
    getContactsByCompany(companyId),
    getTemplatesByCompany(companyId),
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

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Campaigns"
        description="Create draft campaigns from real contacts and templates, then track queued, delivered, read, and failed counts."
      />

      {contacts.length === 0 || templates.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-200">
          Before creating a campaign, create at least one contact and one
          template.
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      </section>

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <CampaignForm contacts={contacts} templates={templates} />

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
