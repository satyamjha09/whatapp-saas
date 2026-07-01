import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertUserPermission } from "@/server/services/rbac-v2.service";
import { getContactImportDashboard } from "@/server/services/contact-import.service";
import { ContactImportForm } from "./contact-import-form";

function statusClass(status: string) {
  if (status === "COMPLETED") return "bg-green-50 text-green-700";
  if (status === "FAILED") return "bg-red-50 text-red-700";
  if (status === "IMPORTING") return "bg-emerald-50 text-emerald-700";

  return "bg-gray-100 text-gray-700";
}

export default async function ContactImportPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  // Check contact view permission
  await assertUserPermission({
    companyId: context.membership.companyId,
    userId: context.user.id,
    permission: "CONTACT_VIEW",
  });

  const dashboard = await getContactImportDashboard(context.membership.companyId);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Contacts</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Import Contacts
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload contacts with WhatsApp marketing consent proof.
        </p>
      </div>

      <div className="mt-6">
        <ContactImportForm />
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent imports
          </h2>
        </div>

        <div className="divide-y text-gray-700">
          {dashboard.jobs.map((job) => (
            <article key={job.id} className="px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                      job.status,
                    )}`}
                  >
                    {job.status}
                  </span>

                  <h3 className="mt-3 font-semibold text-gray-900">
                    {job.fileName ?? "CSV import"}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Total {job.totalRows} · Ready {job.readyRows} · Imported{" "}
                    {job.importedRows} · Failed {job.failedRows}
                  </p>

                  {job.errorMessage && (
                    <p className="mt-2 text-sm text-red-600">
                      {job.errorMessage}
                    </p>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  {job.createdAt.toLocaleString()}
                </p>
              </div>
            </article>
          ))}

          {dashboard.jobs.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No imports yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
