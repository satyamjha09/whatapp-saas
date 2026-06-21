import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import MetaEmbeddedSignupButton from "./meta-embedded-signup-button";

export default async function WhatsAppConnectPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const graphVersion = process.env.WHATSAPP_API_VERSION ?? "v25.0";

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Connect WhatsApp"
        description="Use Meta Embedded Signup to select a Business Portfolio, WhatsApp Business Account, and phone number."
        actions={
          <Link
            href="/dashboard/whatsapp"
            className={actionButtonClass("secondary")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to settings
          </Link>
        }
      />

      <Panel>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#F0F8FF] text-[#0052CC]">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#081B3A]">
              Meta Embedded Signup
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
              Meta will guide you through business and phone-number selection.
              The resulting access token is encrypted before storage and is
              never rendered back to the browser.
            </p>
          </div>

          {canManage ? (
            <MetaEmbeddedSignupButton graphVersion={graphVersion} />
          ) : (
            <div className="max-w-sm rounded-xl bg-[#F0F8FF] p-4 text-sm text-[#526173] ring-1 ring-[#D8E6F3]">
              Only workspace owners and admins can connect WhatsApp accounts.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
