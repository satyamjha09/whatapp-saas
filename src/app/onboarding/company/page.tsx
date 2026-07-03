import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listUserCompanies } from "@/server/services/company-onboarding.service";
import { getUserByClerkId } from "@/server/services/auth.service";
import { CompanyOnboardingForm } from "./company-onboarding-form";

export default async function CompanyOnboardingPage() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(clerkUser.id);
  const primaryEmail =
    clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  const memberships = user ? await listUserCompanies(user.id) : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <p className="text-sm font-medium text-gray-500">metawhat</p>
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
          defaultPersonalName={user?.name ?? clerkUser.fullName ?? ""}
          defaultEmail={user?.email ?? primaryEmail ?? ""}
          defaultMobile={user?.mobile ?? ""}
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
