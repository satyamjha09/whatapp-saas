import {
  CheckCircle2,
  Clock3,
  FileText,
  HelpCircle,
  KeyRound,
  LogIn,
  PhoneCall,
  RotateCcw,
  Search,
  ShieldCheck,
  Webhook,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppSettingsByCompany } from "@/server/services/whatsapp-settings.service";
import WhatsAppPhoneNumberActions from "./whatsapp-phone-number-actions";
import SubscribeWebhooksButton from "./subscribe-webhooks-button";
import WhatsAppSettingsForm from "./whatsapp-settings-form";

type WhatsAppSettingsPageProps = {
  searchParams?: Promise<{
    search?: string;
  }>;
};

function statusClass(status: string) {
  if (status === "CONNECTED") {
    return "text-sm font-bold text-green-700";
  }

  if (status === "ERROR" || status === "DISCONNECTED") {
    return "text-sm font-bold text-red-600";
  }

  return "text-sm font-bold text-yellow-700";
}

function matchesAccountSearch(
  search: string,
  value: string | null | undefined,
) {
  return value?.toLowerCase().includes(search) ?? false;
}

function formatStatusCheckDate(date: Date | string | null | undefined) {
  if (!date) return "Not checked";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(date: Date | string | null | undefined) {
  if (!date) return "Never";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasHealthySendStatus(value: string | null | undefined) {
  if (!value) return false;

  return ["AVAILABLE", "YES", "TRUE", "1"].includes(value.toUpperCase());
}

function getNumberHealthSummary(
  phoneNumbers: Array<{
    canSendMessage: string;
    lastStatusCheckAt: Date | null;
    lastStatusError: string;
  }>,
) {
  if (phoneNumbers.length === 0) {
    return {
      tone: "pending" as const,
      label: "No number connected",
      detail: "Connect or add a WhatsApp phone number first.",
    };
  }

  const errorCount = phoneNumbers.filter((phone) => phone.lastStatusError).length;
  if (errorCount > 0) {
    return {
      tone: "error" as const,
      label: `${errorCount} need attention`,
      detail: "Check the stored Meta status error before sending.",
    };
  }

  const sendReadyCount = phoneNumbers.filter((phone) =>
    hasHealthySendStatus(phone.canSendMessage),
  ).length;

  if (sendReadyCount > 0) {
    return {
      tone: "success" as const,
      label: `${sendReadyCount}/${phoneNumbers.length} send-ready`,
      detail: "Latest Meta status allows sending on connected numbers.",
    };
  }

  return {
    tone: "pending" as const,
    label: "Status check needed",
    detail: "Run Check number status to refresh Meta health.",
  };
}

function statusCardClass(tone: "success" | "pending" | "error" | "info") {
  if (tone === "success") {
    return "border-[#BFE9D0] bg-white";
  }

  if (tone === "error") {
    return "border-rose-200 bg-rose-50";
  }

  if (tone === "pending") {
    return "border-[#FED7AA] bg-[#FFF7ED]";
  }

  return "border-[#BFE9D0] bg-[#F8FFFB]";
}

export default async function WhatsAppSettingsPage({
  searchParams,
}: WhatsAppSettingsPageProps) {
  const params = await searchParams;
  const search = params?.search?.trim() ?? "";
  const normalizedSearch = search.toLowerCase();
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const [settings, templateStats, latestTemplateSync] = await Promise.all([
    getWhatsAppSettingsByCompany(context.membership.companyId),
    prisma.template.groupBy({
      by: ["status"],
      where: {
        companyId: context.membership.companyId,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.template.findFirst({
      where: {
        companyId: context.membership.companyId,
        lastSyncedAt: {
          not: null,
        },
      },
      orderBy: {
        lastSyncedAt: "desc",
      },
      select: {
        lastSyncedAt: true,
      },
    }),
  ]);
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const templateCounts = Object.fromEntries(
    templateStats.map((row) => [row.status, row._count._all]),
  ) as Record<string, number | undefined>;
  const totalTemplateCount = templateStats.reduce(
    (total, row) => total + row._count._all,
    0,
  );
  const approvedTemplateCount = templateCounts.APPROVED ?? 0;
  const pendingTemplateCount = templateCounts.PENDING_APPROVAL ?? 0;
  const rejectedTemplateCount = templateCounts.REJECTED ?? 0;
  const embeddedSignupPublicReady =
    process.env.META_EMBEDDED_SIGNUP_PUBLIC_READY === "true";
  const webhookError =
    settings.phoneNumbers.find((phoneNumber) =>
      phoneNumber.lastStatusError.toLowerCase().includes("webhook"),
    )?.lastStatusError ?? "";
  const webhookReady = Boolean(
    settings.wabaId && settings.hasAccessToken && !webhookError,
  );
  const numberHealth = getNumberHealthSummary(settings.phoneNumbers);
  const visiblePhoneNumbers = normalizedSearch
    ? settings.phoneNumbers.filter((phoneNumber) =>
        [
          phoneNumber.displayPhoneNumber,
          phoneNumber.phoneNumberId,
          phoneNumber.verifiedName,
          phoneNumber.qualityRating,
          phoneNumber.messagingLimitTier,
          phoneNumber.canSendMessage,
          phoneNumber.codeVerificationStatus,
          phoneNumber.nameStatus,
          settings.wabaId,
          settings.status,
        ].some((value) => matchesAccountSearch(normalizedSearch, value)),
      )
    : settings.phoneNumbers;
  const filteredCount = visiblePhoneNumbers.length;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Connected Accounts"
        description="Review connected WhatsApp Business Accounts, phone numbers, WABA IDs, token status, and setup actions before sending messages."
        actions={
          <>
            <Link
              href="/dashboard/whatsapp/flows"
              className={actionButtonClass("secondary")}
            >
              <Workflow className="mr-2 h-4 w-4" />
              Flows
            </Link>
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
              Connect Account
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

      <section className="mb-5 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
                  embeddedSignupPublicReady
                    ? "bg-[#22C55E]/10 text-[#15803d] ring-1 ring-[#22C55E]/25"
                    : "bg-[#FFF7ED] text-[#C2410C] ring-1 ring-[#FED7AA]",
                ].join(" ")}
              >
                {embeddedSignupPublicReady ? (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {embeddedSignupPublicReady
                  ? "Meta review approved"
                  : "Meta review pending"}
              </span>
              <span className="text-xs font-semibold text-[#526173]">
                Official Facebook Login onboarding
              </span>
            </div>

            <h2 className="mt-4 text-xl font-bold text-[#081B3A]">
              Customer Embedded Signup is being prepared for production
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526173]">
              After Meta approves the app for WhatsApp Embedded Signup,
              customers can connect their own Business Portfolio, WABA, and
              phone number through the official Facebook flow. Until then, keep
              using the Manual Cloud API setup for verified businesses.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard/whatsapp/connect"
              className="rounded-xl border border-[#BFE9D0] bg-[#F8FFFB] p-4 transition hover:bg-[#E7F8EF]"
            >
              <LogIn className="h-5 w-5 text-[#128C7E]" />
              <p className="mt-3 text-sm font-bold text-[#081B3A]">
                Official Facebook Login
              </p>
              <p className="mt-1 text-xs leading-5 text-[#526173]">
                {embeddedSignupPublicReady
                  ? "Ready for customer self-serve onboarding."
                  : "Visible for testing, unlocks publicly after Meta approval."}
              </p>
            </Link>
            <Link
              href="/dashboard/whatsapp/connect#manual-cloud-api-setup"
              className="rounded-xl border border-[#BFE9D0] bg-[#F8FFFB] p-4 transition hover:bg-[#E7F8EF]"
            >
              <KeyRound className="h-5 w-5 text-[#128C7E]" />
              <p className="mt-3 text-sm font-bold text-[#081B3A]">
                Manual Cloud API Connect
              </p>
              <p className="mt-1 text-xs leading-5 text-[#526173]">
                Working fallback for WABA ID, phone ID, and system/user token.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <form
        action="/dashboard/whatsapp"
        className="mb-5 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_12px_30px_rgba(8,27,58,0.07)]"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label htmlFor="connected-account-search" className={labelClass}>
              Search Connected Accounts
            </label>
            <input
              id="connected-account-search"
              name="search"
              defaultValue={search}
              placeholder="Search phone number, WABA ID, phone ID, name, or status"
              className={fieldClass}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={actionButtonClass()}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </button>
            <Link
              href="/dashboard/whatsapp"
              className={actionButtonClass("secondary")}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Link>
          </div>
        </div>
      </form>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div
          className={[
            "rounded-2xl border p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]",
            statusCardClass(settings.status === "CONNECTED" ? "success" : "pending"),
          ].join(" ")}
        >
          <ShieldCheck className="h-5 w-5 text-[#128C7E]" />
          <p className="mt-3 text-xs text-[#526173]">Connection</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {settings.status}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <KeyRound className="h-5 w-5 text-[#075E54]" />
          <p className="mt-3 text-xs text-[#526173]">Access token</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {settings.hasAccessToken ? "Saved securely" : "Not configured"}
          </p>
        </div>
        <div
          className={[
            "rounded-2xl border p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]",
            statusCardClass(numberHealth.tone),
          ].join(" ")}
        >
          <PhoneCall className="h-5 w-5 text-[#128C7E]" />
          <p className="mt-3 text-xs text-[#526173]">Number health</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {numberHealth.label}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-[#526173]">
            {numberHealth.detail}
          </p>
        </div>
        <div
          className={[
            "rounded-2xl border p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]",
            statusCardClass(webhookReady ? "success" : webhookError ? "error" : "pending"),
          ].join(" ")}
        >
          <Webhook className="h-5 w-5 text-[#128C7E]" />
          <p className="mt-3 text-xs text-[#526173]">Webhook status</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {webhookReady
              ? "Ready"
              : webhookError
                ? "Needs recovery"
                : "Subscribe after connect"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-[#526173]">
            {webhookError || "Inbound and delivery status webhooks use the connected WABA token."}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <FileText className="h-5 w-5 text-[#128C7E]" />
          <p className="mt-3 text-xs text-[#526173]">Template sync</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {approvedTemplateCount}/{totalTemplateCount} approved
          </p>
          <p className="mt-1 text-xs text-[#526173]">
            Last sync {formatShortDate(latestTemplateSync?.lastSyncedAt)}
          </p>
        </div>
      </section>

      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
            WABA ID
          </p>
          <p className="mt-2 break-all text-sm font-bold text-[#081B3A]">
            {settings.wabaId || "Not connected"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
            Primary display number
          </p>
          <p className="mt-2 text-sm font-bold text-[#081B3A]">
            {settings.displayPhoneNumber
              ? `+${settings.displayPhoneNumber}`
              : "Not configured"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
            Template review queue
          </p>
          <p className="mt-2 text-sm font-bold text-[#081B3A]">
            {pendingTemplateCount} pending, {rejectedTemplateCount} rejected
          </p>
        </div>
      </section>

      {settings.phoneNumbers.length > 1 ? (
        <section className="mb-5 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#081B3A]">
                Active Number
              </h2>
              <p className="mt-1 text-sm text-[#526173]">
                Choose from all connected WhatsApp numbers in this workspace.
              </p>
            </div>

            <select className="h-12 min-w-72 rounded-xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A] outline-none">
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

      {settings.phoneNumbers.length === 0 ? (
        <section className="mb-5 rounded-2xl border border-dashed border-[#BFE9D0] bg-white p-6 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#081B3A]">
                No connected WhatsApp account yet
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
                Connect a WhatsApp Business Account and phone number before
                creating templates or sending messages.
              </p>
            </div>
            <Link
              href="/dashboard/whatsapp/connect"
              className={actionButtonClass()}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Connect Account
            </Link>
          </div>
        </section>
      ) : null}

      {settings.phoneNumbers.length > 0 ? (
        <section className="mb-5 space-y-4">
          <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#081B3A]">
                  Connected phone numbers
                </h2>
                <p className="mt-1 text-sm text-[#526173]">
                  Showing {filteredCount.toLocaleString("en-IN")} of{" "}
                  {settings.phoneNumbers.length.toLocaleString("en-IN")} phone
                  number{settings.phoneNumbers.length === 1 ? "" : "s"}.
                </p>
              </div>
              <Link
                href="/dashboard/whatsapp/connect"
                className={actionButtonClass("secondary")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Add / Update Account
              </Link>
            </div>
          </div>

          {visiblePhoneNumbers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#BFE9D0] bg-white p-6 text-sm text-[#526173]">
              No connected phone numbers match this search.
            </div>
          ) : null}

          {visiblePhoneNumbers.map((phoneNumber) => {
            const displayPhoneNumber =
              phoneNumber.displayPhoneNumber || settings.displayPhoneNumber;
            const phoneNumberId =
              phoneNumber.phoneNumberId || settings.phoneNumberId;

            return (
              <article
                key={phoneNumber.id}
                className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_12px_30px_rgba(8,27,58,0.07)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#BFE9D0] pb-5">
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
                      Can Send
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {phoneNumber.canSendMessage || "UNKNOWN"}
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

                <div className="mt-6 grid gap-5 border-t border-[#BFE9D0] pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Code Verification
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {phoneNumber.codeVerificationStatus || "UNKNOWN"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Name Status
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {phoneNumber.nameStatus || "UNKNOWN"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Last Status Check
                    </p>
                    <p className="mt-2 font-bold text-[#081B3A]">
                      {formatStatusCheckDate(phoneNumber.lastStatusCheckAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-[#526173]">
                      Last Error
                    </p>
                    <p className="mt-2 break-words font-bold text-[#081B3A]">
                      {phoneNumber.lastStatusError || "None"}
                    </p>
                  </div>
                </div>

                <WhatsAppPhoneNumberActions
                  canManage={canManage}
                  displayPhoneNumber={displayPhoneNumber ?? ""}
                  phoneNumberId={phoneNumberId ?? ""}
                  wabaId={settings.wabaId}
                />
              </article>
            );
          })}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
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
