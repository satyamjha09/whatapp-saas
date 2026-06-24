import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactTimeline } from "@/server/services/contact-activity.service";
import { getContactConsentTimeline } from "@/server/services/contact-consent.service";
import { getContactCrmProfile } from "@/server/services/contact-crm.service";
import ContactConsentPanel from "./contact-consent-panel";
import ContactCrmProfileForm from "./contact-crm-profile-form";
import { PrivacyRequestButtons } from "./privacy-request-buttons";

type PageProps = {
  params: Promise<{
    contactId: string;
  }>;
};

export default async function ContactCrmPage({ params }: PageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { contactId } = await params;

  await assertTenantEntityAccess({
    companyId: context.membership.companyId,
    entityType: "Contact",
    entityId: contactId,
  });

  const [contact, timeline, consentEvents] = await Promise.all([
    getContactCrmProfile({
      companyId: context.membership.companyId,
      contactId,
    }),
    getContactTimeline({
      companyId: context.membership.companyId,
      contactId,
      take: 100,
    }),
    getContactConsentTimeline({
      companyId: context.membership.companyId,
      contactId,
    }),
  ]);

  if (!contact) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/dashboard/inbox"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        Back to inbox
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Customer Profile</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {contact.name ?? contact.phoneNumber}
            </h1>
            <p className="mt-1 font-mono text-sm text-gray-500">
              +{contact.countryCode} {contact.phoneNumber}
            </p>

            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">Assigned to</p>
                <p className="font-medium text-gray-900">
                  {contact.assignedTo?.name ??
                    contact.assignedTo?.email ??
                    "Unassigned"}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">Messages</p>
                <p className="font-medium text-gray-900">
                  {contact._count.messages}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">Notes</p>
                <p className="font-medium text-gray-900">
                  {contact._count.inboxNotes}
                </p>
              </div>
            </div>

            {["OWNER", "ADMIN"].includes(context.membership.role) ? (
              <div className="mt-5">
                <PrivacyRequestButtons contactId={contact.id} />
              </div>
            ) : null}

            <div className="mt-6">
              <ContactCrmProfileForm contact={contact} />
            </div>
          </section>

          {["OWNER", "ADMIN"].includes(context.membership.role) ? (
            <ContactConsentPanel
              contactId={contact.id}
              marketingConsentStatus={contact.marketingConsentStatus}
              utilityConsentStatus={contact.utilityConsentStatus}
            />
          ) : null}

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Consent History</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              Ledger Events
            </h2>

            <div className="mt-4 space-y-3">
              {consentEvents.map((event) => (
                <div key={event.id} className="rounded-xl bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {event.type} - {event.status}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {event.source} - {event.createdAt.toLocaleString()}
                    {event.actor?.email ? ` - ${event.actor.email}` : ""}
                  </p>
                  {event.evidenceText ? (
                    <p className="mt-2 text-sm text-gray-700">
                      {event.evidenceText}
                    </p>
                  ) : null}
                </div>
              ))}

              {consentEvents.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
                  No consent events yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">CRM Timeline</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                Customer Activity
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {contact.inboxTags.map((item) => (
                <span
                  key={item.id}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {item.tag.name}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {timeline.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.type}
                      {item.actorName ? ` - ${item.actorName}` : ""}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500">
                    {item.createdAt.toLocaleString()}
                  </p>
                </div>

                {item.description ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                    {item.description}
                  </p>
                ) : null}
              </div>
            ))}

            {timeline.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No activity yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
