import Link from "next/link";
import {
  BarChart3,
  CalendarClock,
  LayoutTemplate,
  Megaphone,
  Send,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
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
    contactGroups,
    wallet,
    recentCampaigns,
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
    prisma.contactGroup.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    }),
    prisma.wallet.findUnique({
      where: { companyId },
      select: { balancePaise: true },
    }),
    prisma.campaign.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        totalContacts: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        createdAt: true,
      },
    }),
  ]);

  const readiness = [
    {
      complete: connectedWhatsAppAccounts > 0,
      cta: "Connect WhatsApp",
      href: "/dashboard/whatsapp",
      label: "Connected WhatsApp number",
      value:
        connectedWhatsAppAccounts > 0
          ? `${connectedWhatsAppAccounts} connected`
          : "Required before launch",
    },
    {
      complete: approvedTemplates > 0,
      cta: "Open templates",
      href: "/dashboard/templates",
      label: "Approved template",
      value:
        approvedTemplates > 0
          ? `${approvedTemplates} approved`
          : "Create or sync one approved template",
    },
    {
      complete: contacts > 0,
      cta: "Import contacts",
      href: "/dashboard/contacts/import",
      label: "Audience contacts",
      value: contacts > 0 ? `${contacts} contacts` : "Import opted-in contacts",
    },
    {
      complete: (wallet?.balancePaise ?? 0) > 0,
      cta: "Recharge wallet",
      href: "/dashboard/billing",
      label: "Wallet balance",
      value: formatMoneyPaise(wallet?.balancePaise ?? 0),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Broadcast builder"
        title="Create WhatsApp broadcast"
        description="Use this guided launch path to prepare audience, approved template, variable mapping, test send, schedule, and live tracking."
        actions={
          <>
            <Link
              href="/dashboard/broadcasts"
              className={actionButtonClass("secondary")}
            >
              Back to broadcasts
            </Link>
            <Link href="/dashboard/messages/bulk" className={actionButtonClass()}>
              <Send className="mr-2 h-4 w-4" />
              Open broadcast sender
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ShieldCheck}
          label="WhatsApp accounts"
          value={formatNumber(connectedWhatsAppAccounts)}
          detail="Connected Cloud API numbers"
        />
        <MetricCard
          icon={LayoutTemplate}
          label="Approved templates"
          value={formatNumber(approvedTemplates)}
          detail="Only approved templates can launch"
        />
        <MetricCard
          icon={Users}
          label="Contacts"
          value={formatNumber(contacts)}
          detail={`${formatNumber(contactGroups.length)} recent group(s)`}
        />
        <MetricCard
          icon={Wallet}
          label="Wallet"
          value={formatMoneyPaise(wallet?.balancePaise ?? 0)}
          detail="Reserved before launch"
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <PanelTitle
            title="Six-step launch path"
            description="The full campaign backend is already available; this page gives teams a safe way into it."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: Users,
                title: "Choose audience",
                description:
                  "Select a contact group or paste/import recipients with duplicate and opt-out checks.",
              },
              {
                icon: LayoutTemplate,
                title: "Map template",
                description:
                  "Pick an approved template and resolve every variable before queueing.",
              },
              {
                icon: Send,
                title: "Preview and test",
                description:
                  "Review final message output and send a small test before launch.",
              },
              {
                icon: ShieldCheck,
                title: "Validate compliance",
                description:
                  "Block missing WhatsApp account, no template, blocked contacts, or empty wallet.",
              },
              {
                icon: CalendarClock,
                title: "Schedule or send",
                description:
                  "Launch immediately or schedule through the existing worker queue.",
              },
              {
                icon: BarChart3,
                title: "Track results",
                description:
                  "Monitor sent, delivered, read, failed, replied, and conversion events.",
              },
            ].map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.title}
                  className="rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF]/55 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#128C7E]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#128C7E]">
                        STEP {index + 1}
                      </p>
                      <h2 className="mt-1 font-bold text-[#081B3A]">
                        {step.title}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-[#526173]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Launch readiness"
            description="Fix these before sending a production broadcast."
          />
          <div className="mt-5 grid gap-3">
            {readiness.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#BFE9D0] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#081B3A]">{item.label}</p>
                    <p className="mt-1 text-sm text-[#526173]">{item.value}</p>
                  </div>
                  <StatusPill tone={item.complete ? "green" : "amber"}>
                    {item.complete ? "Ready" : "Needed"}
                  </StatusPill>
                </div>
                {!item.complete ? (
                  <Link
                    href={item.href}
                    className="mt-3 inline-flex text-sm font-semibold text-[#128C7E] hover:underline"
                  >
                    {item.cta}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Start from an audience"
            description="Contact groups are the best production path because they keep consent, duplicates, and segmentation reusable."
          />
          {contactGroups.length === 0 ? (
            <div className="mt-5">
              <EmptyState>
                No contact groups yet. You can still paste recipients in the
                sender, but groups make broadcasts easier to repeat and audit.
              </EmptyState>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-[#BFE9D0] overflow-hidden rounded-xl border border-[#BFE9D0]">
              {contactGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/dashboard/messages/bulk?groupId=${group.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#E7F8EF]/55"
                >
                  <div>
                    <p className="font-semibold text-[#081B3A]">{group.name}</p>
                    <p className="text-xs text-[#526173]">
                      {formatNumber(group._count.members)} contact(s)
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#128C7E]">
                    Use group
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Recent campaigns"
            description="Use previous campaigns as a quick check before launching another broadcast."
          />
          {recentCampaigns.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No campaign history yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-[#BFE9D0] overflow-hidden rounded-xl border border-[#BFE9D0]">
              {recentCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/dashboard/broadcasts/${campaign.id}`}
                  className="block px-4 py-3 transition hover:bg-[#E7F8EF]/55"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#081B3A]">
                        {campaign.name}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {formatNumber(campaign.totalContacts)} recipient(s)
                      </p>
                    </div>
                    <StatusPill tone={statusTone(campaign.status)}>
                      {campaign.status}
                    </StatusPill>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-[#526173] sm:grid-cols-3">
                    <span>Delivered {formatNumber(campaign.deliveredCount)}</span>
                    <span>Read {formatNumber(campaign.readCount)}</span>
                    <span>Failed {formatNumber(campaign.failedCount)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#081B3A]">
              Ready to queue messages?
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              The current production sender supports immediate send, scheduling,
              approved template parameters, wallet checks, duplicate skipping,
              and tracked recipients.
            </p>
          </div>
          <Link href="/dashboard/messages/bulk" className={actionButtonClass()}>
            <Megaphone className="mr-2 h-4 w-4" />
            Continue to sender
          </Link>
        </div>
      </Panel>
    </div>
  );
}
