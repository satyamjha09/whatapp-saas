import { Calendar, Clock3, Send, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactGroupDetail } from "@/server/services/contact-group.service";
import GroupMembersImportCard from "./group-members-import-card";
import RemoveGroupMemberButton from "./remove-group-member-button";

export default async function ContactGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const group = await getContactGroupDetail(
    context.membership.companyId,
    groupId,
  );
  if (!group) notFound();

  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title={group.name}
        description={group.description || "Contact group"}
        actions={
          <>
            <Link
              href={`/dashboard/messages/bulk?groupId=${group.id}`}
              className={actionButtonClass()}
            >
              <Send className="mr-2 h-4 w-4" />
              Bulk Message
            </Link>
            <Link
              href="/dashboard/contacts/groups"
              className={actionButtonClass("secondary")}
            >
              Back to Groups
            </Link>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-2 text-sm text-[#526173]">
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: group.color ?? "#0052CC" }}
        />
        Group color
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Total Members"
          value={group._count.members.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Calendar}
          label="Created"
          value={group.createdAt.toLocaleDateString()}
          detail={group.createdAt.toLocaleTimeString()}
        />
        <MetricCard
          icon={Clock3}
          label="Updated"
          value={group.updatedAt.toLocaleDateString()}
          detail={group.updatedAt.toLocaleTimeString()}
        />
      </section>

      {canManage ? <GroupMembersImportCard groupId={group.id} /> : null}

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#D8E6F3] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Group members"
            description="Contacts in this reusable audience list."
          />
        </div>
        {group.members.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No contacts in this group yet.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#F0F8FF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Blocked</th>
                  <th className="px-5 py-3">Added</th>
                  {canManage ? <th className="px-5 py-3">Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6F3]">
                {group.members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-4 font-semibold text-[#081B3A]">
                      {member.contact.name ?? "Unnamed contact"}
                    </td>
                    <td className="px-5 py-4">
                      +{member.contact.countryCode} {member.contact.phoneNumber}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {member.contact.source}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={member.contact.isBlocked ? "red" : "green"}>
                        {member.contact.isBlocked ? "Blocked" : "Active"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {member.createdAt.toLocaleString()}
                    </td>
                    {canManage ? (
                      <td className="px-5 py-4">
                        <RemoveGroupMemberButton
                          groupId={group.id}
                          memberId={member.id}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
