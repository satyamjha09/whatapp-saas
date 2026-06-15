import { PhoneCall, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import {
  MetricCard,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
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
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="WhatsApp settings"
        description="Connect and monitor the real WhatsApp Business account attached to this workspace."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <MetricCard
          icon={ShieldCheck}
          label="Connection status"
          value={account?.status ?? "Not started"}
          detail="Current stored WhatsApp setup state"
        />
        <MetricCard
          icon={PhoneCall}
          label="Phone numbers"
          value={(account?.phoneNumbers.length ?? 0).toLocaleString("en-IN")}
          detail="Numbers attached to this account"
        />
      </section>

      <div className="max-w-3xl">
        <WhatsAppSetupForm initialAccount={initialAccount} />
      </div>
    </div>
  );
}
