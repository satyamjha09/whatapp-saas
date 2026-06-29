import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCompanyInvites } from "@/server/services/invite.service";
import { getCompanyMembers } from "@/server/services/team.service";
import { getTeamMemberPlanUsage } from "@/server/services/plan-limit.service";
import InviteMemberForm from "./invite-member-form";
import MemberRoleSelect from "./member-role-select";
import RemoveMemberButton from "./remove-member-button";
import RevokeInviteButton from "./revoke-invite-button";
import TeamPlanLimitCard from "./team-plan-limit-card";

function formatDate(value: Date | string | number | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString();
}

export default async function TeamSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const [members, invites, teamUsage] = await Promise.all([
    getCompanyMembers(context.membership.companyId),
    getCompanyInvites(context.membership.companyId),
    getTeamMemberPlanUsage(context.membership.companyId),
  ]);

  const canManageRoles = context.membership.role === "OWNER";
  const canInviteMembers =
    context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  const canManageInvites = canInviteMembers;

  return (
    <main className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Team Settings</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <TeamPlanLimitCard usage={teamUsage} />

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Members</h2>

              <p className="mt-1 text-sm text-gray-600">
                Manage users and roles inside this workspace.
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {members.length} member(s)
            </span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Joined</th>
                  <th className="py-3 pr-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {members.map((member) => {
                  const isCurrentUser = member.userId === context.user.id;

                  return (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {member.user.name ?? "Unnamed User"}

                        {isCurrentUser && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            You
                          </span>
                        )}
                      </td>

                      <td className="py-3 pr-4 text-gray-600">
                        {member.user.email}
                      </td>

                      <td className="py-3 pr-4">
                        <MemberRoleSelect
                          companyUserId={member.id}
                          currentRole={member.role}
                          disabled={!canManageRoles || isCurrentUser}
                        />
                      </td>

                      <td className="py-3 pr-4 text-gray-600">
                        {formatDate(member.createdAt)}
                      </td>

                      <td className="py-3 pr-4">
                        {canManageRoles ? (
                          <RemoveMemberButton
                            companyUserId={member.id}
                            disabled={isCurrentUser}
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!canManageRoles && (
            <p className="mt-6 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              Only workspace owners can update team roles.
            </p>
          )}

          {canManageRoles && members.length === 1 && (
            <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              Use the invite form below to add more workspace members.
            </p>
          )}
        </section>

        {canInviteMembers && (
          <section className="mt-6">
            <InviteMemberForm
              canInvite={teamUsage.canInvite}
              remainingSeats={teamUsage.remainingSeats}
            />
          </section>
        )}

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Invites</h2>

              <p className="mt-1 text-sm text-gray-600">
                Pending and accepted workspace invitations.
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {invites.length} invite(s)
            </span>
          </div>

          {invites.length === 0 ? (
            <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              No invites created yet.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Role</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Invited By</th>
                    <th className="py-3 pr-4">Expires</th>
                    <th className="py-3 pr-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {invite.email}
                      </td>

                      <td className="py-3 pr-4">{invite.role}</td>

                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {invite.status}
                        </span>
                      </td>

                      <td className="py-3 pr-4 text-gray-600">
                        {invite.invitedBy.name ?? invite.invitedBy.email}
                      </td>

                      <td className="py-3 pr-4 text-gray-600">
                        {formatDate(invite.expiresAt)}
                      </td>

                      <td className="py-3 pr-4">
                        {canManageInvites && invite.status === "PENDING" ? (
                          <RevokeInviteButton inviteId={invite.id} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
