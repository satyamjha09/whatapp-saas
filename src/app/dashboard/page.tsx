import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

export default async function DashboardPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { user, membership } = context;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {membership.company.name}
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Welcome back, {user.name ?? user.email}
            </p>
          </div>

          <UserButton />
        </header>

        <section className="rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-green-700">
            Workspace connected successfully
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Company</p>

              <p className="mt-1 text-lg font-semibold text-gray-900">
                {membership.company.name}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Your Role</p>

              <p className="mt-1 text-lg font-semibold text-gray-900">
                {membership.role}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard/settings/whatsapp"
              className="inline-flex rounded-lg bg-black px-5 py-3 font-medium text-white"
            >
              Manage WhatsApp Connection
            </Link>

            <Link
              href="/dashboard/templates"
              className="inline-flex rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-900"
            >
              Manage Templates
            </Link>

            <Link
              href="/dashboard/contacts"
              className="inline-flex rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-900"
            >
              Manage Contacts
            </Link>

            <Link
              href="/dashboard/messages"
              className="inline-flex rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-900"
            >
              Send Messages
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
