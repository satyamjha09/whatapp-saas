import Link from "next/link";
import {
  LayoutTemplate,
  Megaphone,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  MetricCard,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
import { BroadcastWizard } from "@/app/dashboard/broadcasts/_components/broadcast-wizard";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatMoneyPaise(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value / 100);
}

export default async function NewBroadcastPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;

  const [
    connectedWhatsAppAccounts,
    approvedTemplates,
    contacts,
    wallet,
  ] = await Promise.all([
    prisma.whatsAppAccount.count({
      where: {
        companyId,
        status: "CONNECTED",
      },
    }),
    prisma.template.count({
      where: {
        companyId,
        status: "APPROVED",
      },
    }),
    prisma.contact.count({
      where: {
        companyId,
      },
    }),
    prisma.wallet.findUnique({
      where: { companyId },
      select: { balancePaise: true },
    }),
  ]);

  const readiness = [
    {
      complete: connectedWhatsAppAccounts > 0,
      label: "WhatsApp",
      value:
        connectedWhatsAppAccounts > 0
          ? `${connectedWhatsAppAccounts} connected`
          : "Needed",
    },
    {
      complete: approvedTemplates > 0,
      label: "Templates",
      value:
        approvedTemplates > 0 ? `${approvedTemplates} approved` : "Needed",
    },
    {
      complete: contacts > 0,
      label: "Contacts",
      value: contacts > 0 ? `${contacts} contacts` : "Needed",
    },
    {
      complete: (wallet?.balancePaise ?? 0) > 0,
      label: "Wallet",
      value: formatMoneyPaise(wallet?.balancePaise ?? 0),
    },
  ];

  return (
    <div>
      <PageHeader
        actions={
          <Link href="/dashboard/broadcasts" className={actionButtonClass("secondary")}>
            Back to broadcasts
          </Link>
        }
        description="Start a saved six-step campaign draft, then add audience, template, personalisation, schedule, validation, and launch controls in the next phases."
        eyebrow={context.membership.company.name}
        title="Create broadcast campaign"
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Connected Cloud API numbers"
          icon={ShieldCheck}
          label="WhatsApp accounts"
          value={formatNumber(connectedWhatsAppAccounts)}
        />
        <MetricCard
          detail="Only approved templates can launch"
          icon={LayoutTemplate}
          label="Approved templates"
          value={formatNumber(approvedTemplates)}
        />
        <MetricCard
          detail="Audience pool available now"
          icon={Users}
          label="Contacts"
          value={formatNumber(contacts)}
        />
        <MetricCard
          detail="Reserved before launch"
          icon={Wallet}
          label="Wallet"
          value={formatMoneyPaise(wallet?.balancePaise ?? 0)}
        />
      </section>

      <BroadcastWizard initialDraft={null} readiness={readiness} />

      <div className="mt-6 rounded-[24px] border border-[#BFE9D0] bg-[#E7F8EF]/55 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#128C7E]">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-[#081B3A]">
                Phase 1 creates a safe draft, not a live send.
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#526173]">
                The production sender remains protected by approved templates,
                consent, wallet checks, dry-run validation, and queue controls.
              </p>
            </div>
          </div>
          <Link href="/dashboard/messages/bulk" className={actionButtonClass("secondary")}>
            Existing sender
          </Link>
        </div>
      </div>
    </div>
  );
}
