import {
  CheckCircle2,
  KeyRound,
  LogIn,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppSettingsByCompany } from "@/server/services/whatsapp-settings.service";
import SubscribeWebhooksButton from "./subscribe-webhooks-button";
import WhatsAppSettingsForm from "./whatsapp-settings-form";

export default async function WhatsAppSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const settings = await getWhatsAppSettingsByCompany(
    context.membership.companyId,
  );
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="WhatsApp Settings"
        description="Manage your Meta WhatsApp Cloud API connection without exposing stored access tokens."
        actions={
          <>
            <Link
              href="/dashboard/whatsapp/connect"
              className={actionButtonClass()}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login with Facebook
            </Link>
            <Link
              href="/dashboard/production-checklist"
              className={actionButtonClass("secondary")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Production Checklist
            </Link>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <ShieldCheck className="h-5 w-5 text-[#0052CC]" />
          <p className="mt-3 text-xs text-[#526173]">Connection</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {settings.status}
          </p>
        </div>
        <div className="rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <KeyRound className="h-5 w-5 text-[#384080]" />
          <p className="mt-3 text-xs text-[#526173]">Access token</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {settings.hasAccessToken ? "Saved securely" : "Not configured"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <PhoneCall className="h-5 w-5 text-[#2070B0]" />
          <p className="mt-3 text-xs text-[#526173]">Display number</p>
          <p className="mt-1 truncate text-sm font-bold text-[#081B3A]">
            {settings.displayPhoneNumber || "Not configured"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <CheckCircle2 className="h-5 w-5 text-[#22C55E]" />
          <p className="mt-3 text-xs text-[#526173]">Verified name</p>
          <p className="mt-1 truncate text-sm font-bold text-[#081B3A]">
            {settings.verifiedName || "Test connection to verify"}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
        <h2 className="text-lg font-bold text-[#081B3A]">
          Cloud API Credentials
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#526173]">
          Access tokens are encrypted before storage and are never returned by
          the API or rendered back into this page.
        </p>

        <div className="mt-6">
          <WhatsAppSettingsForm settings={settings} canManage={canManage} />
        </div>
      </section>

      <SubscribeWebhooksButton
        canManage={canManage}
        isConnected={Boolean(settings.wabaId && settings.hasAccessToken)}
      />
    </div>
  );
}
