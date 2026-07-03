import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertUserPermission } from "@/server/services/rbac-v2.service";
import {
  ContactListError,
  getContactList,
} from "@/server/services/contact-list.service";
import { ContactListMembersTable } from "@/components/contacts/lists/contact-list-members-table";

export default async function ContactListDetailPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
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

  const { listId } = await params;

  let list;

  try {
    list = await getContactList({
      companyId: context.membership.companyId,
      listId,
    });
  } catch (error) {
    if (error instanceof ContactListError) {
      notFound();
    }

    throw error;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Contacts · Lists"
        title={list.name}
        description={
          list.description ??
          `${list.contactsCount.toLocaleString("en-IN")} contact(s) in this list.`
        }
        actions={
          <Link
            href="/dashboard/contacts/lists"
            className={actionButtonClass("secondary")}
          >
            Back to lists
          </Link>
        }
      />

      <Panel>
        <ContactListMembersTable listId={list.id} />
      </Panel>
    </div>
  );
}
