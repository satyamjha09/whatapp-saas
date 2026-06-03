import Link from "next/link";
import { redirect } from "next/navigation";
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

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to dashboard
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">Campaigns</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        {contacts.length === 0 || templates.length === 0 ? (
          <div className="mb-6 rounded-2xl border bg-yellow-50 p-5 text-sm text-yellow-800">
            Before creating a campaign, create at least one contact and one
            template.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
          <CampaignForm contacts={contacts} templates={templates} />

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Saved Campaigns
            </h2>

            {campaigns.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No campaigns created yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {campaign.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          Template: {campaign.template.name}
                        </p>
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {campaign.status}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Contacts</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">
                          {campaign.totalContacts}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Queued</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">
                          {campaign.queuedCount}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Failed</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">
                          {campaign.failedCount}
                        </p>
                      </div>
                    </div>

                    {campaign.status === "DRAFT" ? (
                      <StartCampaignButton campaignId={campaign.id} />
                    ) : null}

                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500">
                        Campaign Contacts
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {campaign.contacts.slice(0, 5).map((item) => (
                          <span
                            key={item.id}
                            className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                          >
                            {item.contact.name ?? item.contact.phoneNumber}
                          </span>
                        ))}

                        {campaign.contacts.length > 5 ? (
                          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                            +{campaign.contacts.length - 5} more
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-gray-500">
                      Created: {campaign.createdAt.toLocaleDateString()}
                    </p>

                    <div className="mt-4">
                      <Link
                        href={`/dashboard/campaigns/${campaign.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        View campaign details &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
