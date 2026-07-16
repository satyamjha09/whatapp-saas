import { PlatformUserActions } from "@/app/platform/users/platform-user-actions";
import type { PlatformRole } from "@/generated/prisma/client";
import { getPlatformUsersDashboard } from "@/server/services/platform-user-management.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

const ROLE_BADGE_CLASS: Record<PlatformRole, string> = {
  NONE: "bg-slate-100 text-slate-600",
  SUPPORT: "bg-blue-50 text-blue-700",
  FINANCE: "bg-amber-50 text-amber-700",
  ADMIN: "bg-purple-50 text-purple-700",
  SUPER_ADMIN: "bg-emerald-50 text-emerald-700",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default async function PlatformUsersPage() {
  const platform = await requirePlatformPermission("PLATFORM_USER_MANAGE");
  const dashboard = await getPlatformUsersDashboard();
  const { counts, users } = dashboard;
  const superAdminCount = counts.roles.SUPER_ADMIN ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Platform Admin
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Platform Users
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Grant support, finance, admin, or super-admin access to existing
              MetaWhat users. Only super admins can change these roles.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-black">Access rule</p>
            <p className="mt-1 text-xs leading-5">
              A user must first sign up once, then they can be promoted here.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total users</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Platform enabled</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {counts.platformEnabled}
          </p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Admins</p>
          <p className="mt-2 text-3xl font-black text-purple-700">
            {(counts.roles.ADMIN ?? 0) + superAdminCount}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Support / finance</p>
          <p className="mt-2 text-3xl font-black text-blue-700">
            {(counts.roles.SUPPORT ?? 0) + (counts.roles.FINANCE ?? 0)}
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">All users</h2>
            <p className="mt-1 text-sm text-slate-500">
              Promote an existing account after the user has completed signup.
            </p>
          </div>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white">
            {superAdminCount} super admin{superAdminCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Current role</th>
                <th className="px-5 py-4">Workspaces</th>
                <th className="px-5 py-4">Joined</th>
                <th className="px-5 py-4">Access control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="px-5 py-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 text-sm font-black text-emerald-800">
                        {getInitials(user.name, user.email)}
                      </div>
                      <div>
                        <p className="font-black text-slate-950">
                          {user.name ?? "Unnamed user"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                        {user.mobile ? (
                          <p className="mt-1 text-xs text-slate-500">{user.mobile}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                        ROLE_BADGE_CLASS[user.platformRole]
                      }`}
                    >
                      {user.platformRole.replace("_", " ")}
                    </span>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {user.platformAccessEnabled ? "Enabled" : "Disabled"}
                    </p>
                  </td>

                  <td className="px-5 py-5">
                    <div className="space-y-2">
                      {user.companies.map((membership) => (
                        <div
                          key={`${user.id}-${membership.company.id}`}
                          className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <p className="font-semibold text-slate-900">
                            {membership.company.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {membership.role} · {membership.company.type} ·{" "}
                            {membership.company.status}
                          </p>
                        </div>
                      ))}
                      {user.companies.length === 0 ? (
                        <p className="text-sm text-slate-500">No workspace yet.</p>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-5 py-5 text-sm text-slate-600">
                    {formatDate(user.createdAt)}
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {formatDate(user.updatedAt)}
                    </p>
                  </td>

                  <td className="px-5 py-5">
                    <PlatformUserActions
                      currentUserId={platform.user.id}
                      isCurrentUser={platform.user.id === user.id}
                      platformAccessEnabled={user.platformAccessEnabled}
                      platformRole={user.platformRole}
                      superAdminCount={superAdminCount}
                      userEmail={user.email}
                      userId={user.id}
                    />
                  </td>
                </tr>
              ))}

              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No users found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
