import { Calendar, Columns3, Phone, Plus, Upload, Users } from "lucide-react";
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
        description={`Manage customers, leads, attributes, labels, and WhatsApp activity. ${totalContacts.toLocaleString("en-IN")} contacts in this workspace.`}
        actions={
          <>
            <button
              type="button"
              className={actionButtonClass("secondary")}
              title="Column controls are coming next"
            >
              <Columns3 className="mr-2 h-4 w-4" />
              Columns
            </button>
            <a href="#create-contact" className={actionButtonClass("secondary")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Contact
            </a>
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
              <Upload className="mr-2 h-4 w-4" />
              Import Contacts
            </Link>
          </>
        }
      />

      <details className="group mb-6 rounded-2xl border border-[#BFE9D0] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-semibold text-[#081B3A]">
          <span className="transition group-open:rotate-90">›</span>
          How to use Contacts
        </summary>
        <div className="border-t border-[#E7F8EF] px-5 py-4 text-sm leading-6 text-[#526173]">
          <ul className="list-inside list-disc space-y-1">
            <li>Create contacts manually or import them using CSV.</li>
            <li>Add labels to organise contacts.</li>
            <li>Use attributes for custom customer information.</li>
            <li>Click a contact to view its full profile without leaving the table.</li>
          </ul>
        </div>
      </details>

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

      <details
        id="create-contact"
        className="group mb-6 rounded-2xl border border-[#BFE9D0] bg-white"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-semibold text-[#081B3A]">
          <span className="transition group-open:rotate-90">›</span>
          Create contact
        </summary>
        <div className="border-t border-[#E7F8EF] p-5">
          <ContactForm />
        </div>
      </details>

      <Panel>
        <PanelTitle
          title="All contacts"
          description="Filter by list, segment, label, source, status, or consent. Click any contact row to view the profile drawer."
        />

        <div className="mt-5">
          <ContactsExplorer lists={lists} segments={segments} />
        </div>
      </Panel>
    </div>
  );
}
