import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertUserPermission } from "@/server/services/rbac-v2.service";
import { listContactLists } from "@/server/services/contact-list.service";
import { ContactListTable } from "@/components/contacts/lists/contact-list-table";

export default async function ContactListsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  await assertUserPermission({
    companyId: context.membership.companyId,
    userId: context.user.id,
    permission: "CONTACT_VIEW",
  });

  const lists = await listContactLists({
    companyId: context.membership.companyId,
  });

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Contact lists"
        description="Static lists of contacts for broadcasting - add contacts manually or assign a list during import."
      />

      <Panel>
        <ContactListTable
          lists={lists.map((list) => ({
            id: list.id,
            name: list.name,
            description: list.description,
            contactsCount: list.contactsCount,
            createdAt: list.createdAt.toISOString(),
          }))}
        />
      </Panel>
    </div>
  );
}
