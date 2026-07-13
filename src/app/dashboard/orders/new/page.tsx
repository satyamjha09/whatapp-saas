import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  EmptyState,
  PageHeader,
  Panel,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import NewOrderForm from "./new-order-form";

export default async function NewOrderPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const contacts = await prisma.contact.findMany({
    where: { companyId: context.membership.companyId },
    orderBy: [{ name: "asc" }, { phoneNumber: "asc" }],
    select: {
      countryCode: true,
      id: true,
      name: true,
      phoneNumber: true,
    },
    take: 500,
  });

  return (
    <div>
      <PageHeader
        actions={
          <Link className={actionButtonClass("secondary")} href="/dashboard/orders">
            Back to Orders
          </Link>
        }
        description="Create a manual order with item snapshots. Tally/API/Catalog imports can plug into the same order model later."
        eyebrow={context.membership.company.name}
        title="Create Order"
      />

      <Panel>
        {contacts.length === 0 ? (
          <EmptyState>
            Create a contact first. Every order must belong to a workspace-owned
            contact so WhatsApp updates can be sent safely later.
          </EmptyState>
        ) : (
          <NewOrderForm
            contacts={contacts.map((contact) => ({
              id: contact.id,
              label: contact.name || contact.phoneNumber,
              phone: `+${contact.countryCode}${contact.phoneNumber}`,
            }))}
          />
        )}
      </Panel>
    </div>
  );
}
