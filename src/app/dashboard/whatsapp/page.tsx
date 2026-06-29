import {
  CheckCircle2,
  HelpCircle,
  KeyRound,
  Link2,
  LogIn,
  PhoneCall,
  RefreshCw,
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

function statusClass(status: string) {
  if (status === "CONNECTED") {
    return "text-sm font-bold text-green-700";
  }

  if (status === "ERROR" || status === "DISCONNECTED") {
    return "text-sm font-bold text-red-600";
  }

  return "text-sm font-bold text-yellow-700";
}

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
              href="/dashboard/whatsapp/onboarding-guide"
              className={actionButtonClass("secondary")}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Onboarding Guide
            </Link>
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

      {settings.phoneNumbers.length > 1 ? (
        <section className="mb-5 rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#081B3A]">
                Active Number
              </h2>
              <p className="mt-1 text-sm text-[#526173]">
                Choose from all connected WhatsApp numbers in this workspace.
              </p>
            </div>

            <select className="h-12 min-w-72 rounded-xl border border-[#D8E6F3] bg-white px-4 text-sm font-semibold text-[#081B3A] outline-none">
              {settings.phoneNumbers.map((phoneNumber) => (
                <option key={phoneNumber.id} value={phoneNumber.id}>
                  {phoneNumber.displayPhoneNumber
                    ? `+${phoneNumber.displayPhoneNumber}`
                    : "WhatsApp Number"}{" "}
                  - {phoneNumber.phoneNumberId || "No phone ID"}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      {settings.phoneNumbers.length > 0 ? (
        <section className="mb-5 space-y-4">
          {settings.phoneNumbers.map((phoneNumber) => {
            const displayPhoneNumber =
              phoneNumber.displayPhoneNumber || settings.displayPhoneNumber;
            const phoneNumberId =
              phoneNumber.phoneNumberId || settings.phoneNumberId;

            return (
              <article
                key={phoneNumber.id}
                className="rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_12px_30px_rgba(8,27,58,0.07)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#D8E6F3] pb-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-[#081B3A]">
                        {displayPhoneNumber
                          ? `+${displayPhoneNumber}`
                          : "WhatsApp Number"}
                      </h2>
                      <span className={statusClass(settings.status)}>
                        {settings.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#526173]">
                      Phone ID: {phoneNumberId || "Not configured"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-green-700">
                      {settings.status === "CONNECTED"
                        ? "Basic Plan"
                        : "Setup Required"}
                    </p>
                    <p className="mt-2 text-sm text-[#526173]">
                      WABA ID: {settings.wabaId || "Not configured"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Name
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {phoneNumber.verifiedName ||
                        settings.verifiedName ||
                        "Not verified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Quality Rating
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {phoneNumber.qualityRating ||
                        settings.qualityRating ||
                        "UNKNOWN"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Mode
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {settings.status === "CONNECTED" ? "LIVE" : "SETUP"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Daily Limit
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {phoneNumber.messagingLimitTier || "UNKNOWN"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Number Type
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {phoneNumber.numberType || "Cloud"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] hover:bg-[#F0F8FF]"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check number status
                  </button>
                  <Link
                    href="/dashboard/whatsapp/connect"
                    className="rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] hover:bg-[#F0F8FF]"
                  >
                    Activation
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-xl border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#081B3A] hover:bg-[#F0F8FF]"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect CRM
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

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
