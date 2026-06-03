import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import CompanySettingsForm from "./company-settings-form";

export default async function CompanySettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const canEditCompany = context.membership.role === "OWNER";

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Company Settings
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        {canEditCompany ? (
          <CompanySettingsForm companyName={context.membership.company.name} />
        ) : (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Workspace Details
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Only the company owner can update company settings.
            </p>

            <div className="mt-6 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Company name</p>

              <p className="mt-1 font-semibold text-gray-900">
                {context.membership.company.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
