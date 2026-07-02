import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactCrmProfile } from "@/server/services/contact-crm.service";
import { PageHeader } from "@/app/dashboard/dashboard-ui";
import CustomerJourneyTimeline from "@/components/customer-journey/customer-journey-timeline";

type PageProps = {
  params: Promise<{
    contactId: string;
  }>;
};

export default async function ContactTimelinePage({ params }: PageProps) {
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

  const contact = await getContactCrmProfile({
    companyId: context.membership.companyId,
    contactId,
  });

  if (!contact) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/contacts/${contact.id}/crm`}
          className="flex items-center gap-2 text-sm font-semibold text-[#526173] hover:text-[#081B3A] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Customer CRM</span>
        </Link>

        <Link
          href={`/dashboard/inbox/${contact.id}`}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#128C7E] text-white hover:bg-[#075E54] transition"
        >
          Open Chat in Inbox
        </Link>
      </div>

      <PageHeader
        title={`Customer Journey: ${contact.name ?? contact.phoneNumber}`}
        description={`Full chronological event history for +${contact.countryCode} ${contact.phoneNumber}`}
        eyebrow="Contacts Timeline"
      />

      <CustomerJourneyTimeline contactId={contact.id} showSummary={true} />
    </div>
  );
}
