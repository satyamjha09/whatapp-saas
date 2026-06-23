import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listInboxSavedViews } from "@/server/services/inbox-saved-view.service";

export default async function InboxSavedViewsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const views = await listInboxSavedViews({
    companyId: context.membership.companyId,
    userId: context.user.id,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Inbox</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Saved Views
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Reusable inbox filters for agents, admins, and teams.
          </p>
        </div>

        <Link
          href="/dashboard/inbox"
          className="rounded-lg border px-3 py-2 text-sm font-medium"
        >
          Back to inbox
        </Link>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Visibility</th>
              <th className="px-5 py-3">Sort</th>
              <th className="px-5 py-3">Default</th>
              <th className="px-5 py-3">Updated</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {views.map((view) => (
              <tr key={view.id}>
                <td className="px-5 py-4 font-semibold text-gray-900">
                  {view.name}
                </td>
                <td className="px-5 py-4">{view.visibility}</td>
                <td className="px-5 py-4">{view.sortBy}</td>
                <td className="px-5 py-4">{view.isDefault ? "Yes" : "No"}</td>
                <td className="px-5 py-4">
                  {view.updatedAt.toLocaleString()}
                </td>
              </tr>
            ))}

            {views.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-sm text-gray-600" colSpan={5}>
                  No saved views yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
