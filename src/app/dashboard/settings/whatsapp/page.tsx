import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppAccountByCompany } from "@/server/services/whatsapp.service";
import WhatsAppSetupForm from "./whatsapp-setup-form";

export default async function WhatsAppSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const account = await getWhatsAppAccountByCompany(
    context.membership.companyId,
  );

  const initialAccount = account
    ? {
        id: account.id,
        businessName: account.businessName,
        status: account.status,
        wabaId: account.wabaId,
      }
    : null;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to dashboard
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">
            WhatsApp Settings
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <WhatsAppSetupForm initialAccount={initialAccount} />
      </div>
    </main>
  );
}
