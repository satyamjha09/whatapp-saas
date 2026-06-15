import { Calendar, Phone, Users } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactsByCompany } from "@/server/services/contact.service";
import ContactForm from "./contact-form";

export default async function ContactsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const contacts = await getContactsByCompany(context.membership.companyId);
  const namedContacts = contacts.filter((contact) => contact.name).length;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Contacts"
        description="Maintain the real customer phonebook used for inbox threads, campaigns, and template message delivery."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Total contacts"
          value={contacts.length.toLocaleString("en-IN")}
          detail="Stored in this workspace"
        />
        <MetricCard
          icon={Phone}
          label="Named contacts"
          value={namedContacts.toLocaleString("en-IN")}
          detail="Contacts with a display name"
        />
        <MetricCard
          icon={Calendar}
          label="Latest contact"
          value={contacts[0]?.createdAt.toLocaleDateString() ?? "-"}
          detail="Most recent record"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <ContactForm />

        <Panel>
          <PanelTitle
            title="Saved contacts"
            description="Real contacts available for message and campaign workflows."
          />

          {contacts.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No contacts created yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">
                        {contact.name ?? "Unnamed Contact"}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        +{contact.countryCode} {contact.phoneNumber}
                      </p>
                    </div>

                    <StatusPill tone="violet">Contact</StatusPill>
                  </div>

                  <p className="mt-4 text-xs text-zinc-600">
                    Created {contact.createdAt.toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
