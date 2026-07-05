import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ClipboardCheck,
  KeyRound,
  LockKeyhole,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppSettingsByCompany } from "@/server/services/whatsapp-settings.service";
import WhatsAppSettingsForm from "../whatsapp-settings-form";
import MetaEmbeddedSignupButton from "./meta-embedded-signup-button";

const embeddedSignupPreview = [
  {
    title: "Business portfolio",
    description: "Customer selects or creates the Meta Business Portfolio.",
    icon: Building2,
  },
  {
    title: "Business details",
    description: "Meta collects business category, country, website, and time zone.",
    icon: ClipboardCheck,
  },
  {
    title: "WhatsApp phone",
    description: "Customer chooses an existing number or verifies a new number.",
    icon: PhoneCall,
  },
  {
    title: "Secure access",
    description: "metawhat encrypts the token, stores phone IDs, and subscribes webhooks.",
    icon: ShieldCheck,
  },
];

export default async function WhatsAppConnectPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const graphVersion = process.env.WHATSAPP_API_VERSION ?? "v25.0";
  const settings = await getWhatsAppSettingsByCompany(
    context.membership.companyId,
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Connect WhatsApp Account"
        description="Use Meta Embedded Signup to select a Business Portfolio, WhatsApp Business Account, and phone number."
        actions={
          <Link
            href="/dashboard/whatsapp"
            className={actionButtonClass("secondary")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to connected accounts
          </Link>
        }
      />

      <Panel>
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr] xl:items-start">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#081B3A]">
              Official Meta Embedded Signup
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
              Customers complete the Facebook-hosted onboarding flow. Our app
              only starts the secure popup, records safe diagnostics, and saves
              the account after Meta returns the authorization code and phone
              details.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {embeddedSignupPreview.map((step, index) => {
                const Icon = step.icon;

                return (
                  <article
                    key={step.title}
                    className="rounded-xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                  >
                    <div className="flex gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-normal text-[#128C7E]">
                          Step {index + 1}
                        </p>
                        <h3 className="mt-1 text-sm font-bold text-[#081B3A]">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[#526173]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {canManage ? (
            <MetaEmbeddedSignupButton
              graphVersion={graphVersion}
              returnToOnboarding={
                context.membership.company.status === "PENDING_ONBOARDING"
              }
            />
          ) : (
            <div className="max-w-sm rounded-xl bg-[#E7F8EF] p-4 text-sm text-[#526173] ring-1 ring-[#BFE9D0]">
              Only workspace owners and admins can connect WhatsApp accounts.
            </div>
          )}
        </div>
      </Panel>

      {canManage ? (
        <Panel>
          <div
            id="manual-cloud-api-setup"
            className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr] xl:items-start"
          >
            <div>
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FFF7ED] text-[#C2410C]">
                <KeyRound className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-[#081B3A]">
                Manual Cloud API setup
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
                Use this fallback when Meta blocks Embedded Signup with a BSP or
                Tech Provider message. Save the customer&apos;s numeric WABA ID,
                phone number ID, display number, and a valid Cloud API access
                token.
              </p>
              <div className="mt-5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-4 text-sm leading-6 text-[#9A3412]">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    This does not remove Meta&apos;s partner gate for the
                    official popup. It lets verified businesses connect manually
                    while your metawhat app completes Meta Tech Provider access.
                  </p>
                </div>
              </div>
            </div>

            <WhatsAppSettingsForm settings={settings} canManage={canManage} />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
