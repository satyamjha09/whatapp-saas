import { Calendar, Phone, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import ContactForm from "./contact-form";
import { ContactsExplorer } from "@/components/contacts/contacts-explorer";

export default async function ContactsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const companyId = context.membership.companyId;

  const [totalContacts, namedContacts, latestContact, lists, segments] =
    await Promise.all([
      prisma.contact.count({ where: { companyId } }),
      prisma.contact.count({ where: { companyId, name: { not: null } } }),
      prisma.contact.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.contactGroup.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 200,
      }),
      prisma.contactSegment.findMany({
        where: { companyId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 100,
      }),
    ]);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Contacts"
        description="Maintain the real customer phonebook used for inbox threads, campaigns, and template message delivery."
        actions={
          <>
            <Link
              href="/dashboard/contacts/lists"
              className={actionButtonClass("secondary")}
            >
              Lists
            </Link>
            <Link
              href="/dashboard/contacts/segments"
              className={actionButtonClass("secondary")}
            >
              Segments
            </Link>
            <Link
              href="/dashboard/contacts/import"
              className={actionButtonClass("primary")}
            >
              Import contacts
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Total contacts"
          value={totalContacts.toLocaleString("en-IN")}
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
          value={latestContact?.createdAt.toLocaleDateString() ?? "-"}
          detail="Most recent record"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <ContactForm />

        <Panel>
          <PanelTitle
            title="All contacts"
            description="Filter by list, segment, tag, or opt-out status. Select contacts to apply bulk actions."
          />

          <div className="mt-5">
            <ContactsExplorer lists={lists} segments={segments} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
