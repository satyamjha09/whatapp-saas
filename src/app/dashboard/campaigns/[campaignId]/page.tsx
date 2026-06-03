import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCampaignByCompany } from "@/server/services/campaign.service";
import StartCampaignButton from "../start-campaign-button";

type CampaignDetailPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function CampaignDetailPage({
  params,
}: CampaignDetailPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { campaignId } = await params;

  const campaign = await getCampaignByCompany(
    campaignId,
    context.membership.companyId,
  );

  if (!campaign) {
    notFound();
  }

  const stats = [
    { label: "Total", value: campaign.totalContacts },
    { label: "Queued", value: campaign.queuedCount },
    { label: "Sent", value: campaign.sentCount },
    { label: "Delivered", value: campaign.deliveredCount },
    { label: "Read", value: campaign.readCount },
    { label: "Failed", value: campaign.failedCount },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/dashboard/campaigns"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to campaigns
          </Link>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {campaign.name}
              </h1>

              <p className="mt-2 text-sm text-gray-600">
                Workspace: {context.membership.company.name}
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
              {campaign.status}
            </span>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Campaign Details
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Template: {campaign.template.name}
              </p>
            </div>

            {campaign.status === "DRAFT" ? (
              <StartCampaignButton campaignId={campaign.id} />
            ) : null}
          </div>

          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Template Body</p>

            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
              {campaign.template.body}
            </p>
          </div>

          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Campaign Variables</p>

            {campaign.variables.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No variables</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {campaign.variables.map((variable, index) => (
                  <span
                    key={`${variable}-${index}`}
                    className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                  >
                    {variable}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Campaign Contacts
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-3 pr-4">Contact</th>
                  <th className="py-3 pr-4">Phone</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Message</th>
                </tr>
              </thead>

              <tbody>
                {campaign.contacts.map((campaignContact) => (
                  <tr
                    key={campaignContact.id}
                    className="border-b last:border-0"
                  >
                    <td className="py-3 pr-4">
                      {campaignContact.contact.name ?? "Unnamed Contact"}
                    </td>

                    <td className="py-3 pr-4">
                      +{campaignContact.contact.countryCode}
                      {campaignContact.contact.phoneNumber}
                    </td>

                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {campaignContact.status}
                      </span>
                    </td>

                    <td className="py-3 pr-4">
                      {campaignContact.message ? (
                        <Link
                          href={`/dashboard/messages/${campaignContact.message.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          View message
                        </Link>
                      ) : (
                        <span className="text-gray-400">Not created</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
