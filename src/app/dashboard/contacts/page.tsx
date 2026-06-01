import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactsByCompany } from "@/server/services/contact.service";
import ContactForm from "./contact-form";

export default async function ContactsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const contacts = await getContactsByCompany(context.membership.companyId);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to dashboard
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">Contacts</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <ContactForm />

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Saved Contacts
            </h2>

            {contacts.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No contacts created yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {contact.name ?? "Unnamed Contact"}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          +{contact.countryCode} {contact.phoneNumber}
                        </p>
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        Contact
                      </span>
                    </div>

                    <p className="mt-4 text-xs text-gray-500">
                      Created: {contact.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
