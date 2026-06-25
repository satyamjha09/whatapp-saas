import { getCurrentAppUser } from "@/server/tenant/tenant-context";
import { listUserCompanies } from "@/server/services/company-onboarding.service";
import { CompanyOnboardingForm } from "./company-onboarding-form";

export default async function CompanyOnboardingPage() {
  const user = await getCurrentAppUser();
  const memberships = await listUserCompanies(user.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <p className="text-sm font-medium text-gray-500">TallyKonnect</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Create your company workspace
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Your company workspace keeps WhatsApp accounts, contacts, campaigns,
          CRM, billing, and reports separate.
        </p>
      </div>

      <div className="mt-8">
        <CompanyOnboardingForm
          defaultPersonalName={user.name ?? ""}
          defaultEmail={user.email}
          defaultMobile={user.mobile ?? ""}
        />
      </div>

      {memberships.length > 0 && (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Your workspaces
          </h2>

          <div className="mt-4 space-y-3">
            {memberships.map((membership) => (
              <a
                key={membership.id}
                href="/dashboard"
                className="block rounded-xl border p-4 hover:bg-gray-50"
              >
                <p className="font-semibold text-gray-900">
                  {membership.company.name}
                </p>
                <p className="text-sm text-gray-500">
                  {membership.role} / {membership.company.type} /{" "}
                  {membership.company.status}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
