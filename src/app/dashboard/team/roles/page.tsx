import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/authorization";
import { listCompanyRoles } from "@/server/services/rbac-v2.service";
import { listCompanyTeamMembers } from "@/server/services/team-members.service";
import { RoleAssignmentForm } from "./role-assignment-form";

export default async function TeamRolesPage() {
  const context = await requireAdmin();
  const companyId = context.membership.companyId;
  const roles = await listCompanyRoles({ companyId });
  const [members, assignments] = await Promise.all([
    listCompanyTeamMembers({ companyId }),
    prisma.companyAccessRoleAssignment.findMany({
      where: { companyId },
      include: { role: true },
    }),
  ]);
  const assignmentByUserId = new Map(
    assignments.map((assignment) => [assignment.userId, assignment]),
  );
  const roleOptions = roles
    .filter((role) => role.status === "ACTIVE")
    .map(({ id, name, slug }) => ({ id, name, slug }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Team</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Roles & Permissions</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage company roles, permissions, and team assignments.
        </p>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Team Role Assignments</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">User</th><th className="px-5 py-3">Legacy Role</th>
                <th className="px-5 py-3">RBAC v2 Role</th><th className="px-5 py-3">Assign</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => {
                const assignment = assignmentByUserId.get(member.userId);
                return (
                  <tr key={member.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{member.user.name ?? member.user.email}</p>
                      <p className="text-xs text-gray-500">{member.user.email}</p>
                    </td>
                    <td className="px-5 py-4">{member.role}</td>
                    <td className="px-5 py-4">{assignment?.role.name ?? "No RBAC v2 role"}</td>
                    <td className="px-5 py-4">
                      <RoleAssignmentForm
                        userId={member.userId}
                        currentRoleId={assignment?.roleId}
                        roles={roleOptions}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
        </div>
        <div className="divide-y">
          {roles.map((role) => (
            <article key={role.id} className="px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{role.name}</p>
                  <p className="mt-1 text-sm text-gray-500">{role.description ?? "No description"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {role.isSystem ? "System role" : "Custom role"} · {role._count.assignments} user(s)
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  role.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"
                }`}>{role.status}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {role.permissions.map((permission) => (
                  <span key={permission} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {permission}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
