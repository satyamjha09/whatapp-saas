import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  Coins,
  Database,
  FileText,
  IndianRupee,
  MessageSquareText,
  NotebookTabs,
  ReceiptText,
  Reply,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import CustomerJourneyTimeline from "@/components/customer-journey/customer-journey-timeline";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactConsentTimeline } from "@/server/services/contact-consent.service";
import { getContactCrmProfile } from "@/server/services/contact-crm.service";
import ContactConsentPanel from "./contact-consent-panel";
import ContactCrmProfileForm from "./contact-crm-profile-form";
import { PrivacyRequestButtons } from "./privacy-request-buttons";

type PageProps = {
  params: Promise<{
    contactId: string;
  }>;
};

type ContactCrmProfile = NonNullable<
  Awaited<ReturnType<typeof getContactCrmProfile>>
>;

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMoney(paise: number) {
  return moneyFormatter.format(paise / 100);
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "Not recorded";
  return dateFormatter.format(new Date(date));
}

function pretty(value: string | null | undefined) {
  if (!value) return "Not added";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initials(contact: ContactCrmProfile) {
  const label = contact.name ?? contact.companyName ?? contact.phoneNumber;
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  helper?: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-4 shadow-[0_16px_40px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#526173]">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-black text-[#081B3A]">
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-sm leading-5 text-[#526173]">{helper}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "amber" | "blue" | "green" | "red" | "slate";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-[#E7F8EF] text-[#128C7E] ring-[#BFE9D0]",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-100 text-[#526173] ring-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function SectionCard({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  description?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="rounded-[20px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F2FBF7] px-4 py-8 text-center text-sm font-semibold text-[#526173]">
      {label}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-[#F8FFFB] px-3 py-2 text-sm">
      <span className="font-bold text-[#526173]">{label}</span>
      <span className="min-w-0 text-right font-semibold text-[#081B3A]">
        {value}
      </span>
    </div>
  );
}

function previewText(value: string | null | undefined, fallback = "No text") {
  if (!value) return fallback;
  return value.length > 140 ? `${value.slice(0, 140)}...` : value;
}

function CustomerHeader({
  contact,
  canManagePrivacy,
}: {
  canManagePrivacy: boolean;
  contact: ContactCrmProfile;
}) {
  const action = contact.customer360.nextRecommendedAction;

  return (
    <section className="rounded-[24px] border border-[#BFE9D0] bg-gradient-to-br from-white via-[#F8FFFB] to-[#EAF7FF] p-6 shadow-[0_24px_70px_rgba(8,27,58,0.08)]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#128C7E] to-[#2563EB] text-2xl font-black text-white shadow-[0_18px_40px_rgba(18,140,126,0.22)]">
            {initials(contact)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="green">{pretty(contact.lifecycleStage)}</StatusBadge>
              <StatusBadge
                tone={
                  contact.marketingConsentStatus === "GRANTED"
                    ? "green"
                    : contact.marketingConsentStatus === "REVOKED"
                      ? "red"
                      : "amber"
                }
              >
                Marketing {pretty(contact.marketingConsentStatus)}
              </StatusBadge>
              {contact.isBlocked ? (
                <StatusBadge tone="red">Blocked</StatusBadge>
              ) : null}
              {contact.optedOutAt ? (
                <StatusBadge tone="red">Opted out</StatusBadge>
              ) : null}
              <StatusBadge tone="blue">
                Last activity {formatDate(contact.customer360.lastActivityAt)}
              </StatusBadge>
            </div>

            <h1 className="mt-3 truncate text-3xl font-black tracking-tight text-[#081B3A]">
              {contact.name ?? contact.phoneNumber}
            </h1>
            <p className="mt-1 font-mono text-sm font-semibold text-[#526173]">
              +{contact.countryCode} {contact.phoneNumber}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#526173]">
              {contact.email ?? "No email added"} -{" "}
              {contact.companyName ?? "No company added"} - Source{" "}
              {pretty(contact.source)}
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#BFE9D0] bg-white/85 p-4 xl:w-[380px]">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-[#081B3A]">
                Next recommended action
              </p>
              <p className="mt-1 text-lg font-black text-[#128C7E]">
                {action.action}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#526173]">
                {action.reason}
              </p>
              <div className="mt-3">
                <StatusBadge
                  tone={action.priority === "High" ? "amber" : "blue"}
                >
                  {action.priority} priority
                </StatusBadge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          className="rounded-2xl bg-[#128C7E] px-4 py-2 text-sm font-black text-white transition hover:-translate-y-0.5"
          href={`/dashboard/inbox/${contact.id}`}
        >
          Open inbox
        </Link>
        <Link
          className="rounded-2xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-black text-[#128C7E] transition hover:-translate-y-0.5 hover:bg-[#F2FBF7]"
          href={`/dashboard/contacts/${contact.id}/timeline`}
        >
          Full timeline
        </Link>
        {canManagePrivacy ? <PrivacyRequestButtons contactId={contact.id} /> : null}
      </div>
    </section>
  );
}

export default async function ContactCrmPage({ params }: PageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { contactId } = await params;

  await assertTenantEntityAccess({
    companyId: context.membership.companyId,
    entityId: contactId,
    entityType: "Contact",
  });

  const [contact, consentEvents] = await Promise.all([
    getContactCrmProfile({
      companyId: context.membership.companyId,
      contactId,
    }),
    getContactConsentTimeline({
      companyId: context.membership.companyId,
      contactId,
    }),
  ]);

  if (!contact) {
    notFound();
  }

  const canManagePrivacy = ["OWNER", "ADMIN"].includes(context.membership.role);
  const customer360 = contact.customer360;
  const tags = contact.inboxTags.map((item) => item.tag.name);
  const customAttributes =
    contact.customAttributes && typeof contact.customAttributes === "object"
      ? Object.entries(contact.customAttributes as Record<string, unknown>)
      : [];

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F8FFFB] via-white to-[#DDFBEA] px-5 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex items-center gap-2 text-sm font-bold text-[#526173] transition hover:text-[#081B3A]"
            href="/dashboard/contacts"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to contacts
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#128C7E]">
            Customer 360 CRM
          </p>
        </div>

        <CustomerHeader contact={contact} canManagePrivacy={canManagePrivacy} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            helper={`${customer360.engagement.inboundMessages.toLocaleString(
              "en-IN",
            )} inbound, ${customer360.engagement.outboundMessages.toLocaleString(
              "en-IN",
            )} outbound`}
            icon={MessageSquareText}
            label="Messages"
            value={contact._count.messages.toLocaleString("en-IN")}
          />
          <StatCard
            helper={`${customer360.orders.openOrderCount.toLocaleString(
              "en-IN",
            )} active orders`}
            icon={ShoppingBag}
            label="Orders"
            value={customer360.orders.totalOrders.toLocaleString("en-IN")}
          />
          <StatCard
            helper={`${customer360.campaigns.totalReceived.toLocaleString(
              "en-IN",
            )} campaigns received`}
            icon={Target}
            label="Conversions"
            value={customer360.campaigns.totalConversions.toLocaleString(
              "en-IN",
            )}
          />
          <StatCard
            helper={`${formatMoney(
              customer360.money.orderValuePaise,
            )} order value, ${formatMoney(
              customer360.money.trackedConversionValuePaise,
            )} conversion value`}
            icon={Coins}
            label="Customer value"
            value={formatMoney(customer360.money.customerLifetimeValuePaise)}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-6">
            <SectionCard
              description="Editable profile data, lifecycle stage, and identifiers."
              icon={UserRound}
              title="Contact details"
            >
              <ContactCrmProfileForm contact={contact} />
            </SectionCard>

            <SectionCard
              description="Lead score, owner, tags, lists, and custom fields."
              icon={BadgeCheck}
              title="CRM intelligence"
            >
              <div className="grid gap-3">
                <div className="rounded-2xl bg-[#F8FFFB] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#526173]">
                    Lead score
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <p className="text-4xl font-black text-[#081B3A]">
                      {customer360.crm.leadScore}
                    </p>
                    <StatusBadge tone="blue">
                      {pretty(customer360.crm.leadScorePriority ?? "Normal")}
                    </StatusBadge>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F8FFFB] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#526173]">
                    Assigned agent
                  </p>
                  <p className="mt-2 font-black text-[#081B3A]">
                    {customer360.crm.assignedTo?.name ??
                      customer360.crm.assignedTo?.email ??
                      "Unassigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#526173]">
                    Tags
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tag) => (
                        <StatusBadge key={tag} tone="green">
                          {tag}
                        </StatusBadge>
                      ))
                    ) : (
                      <StatusBadge tone="slate">No tags</StatusBadge>
                    )}
                  </div>
                </div>

                {customAttributes.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#526173]">
                      Custom fields
                    </p>
                    <div className="mt-2 grid gap-2">
                      {customAttributes.slice(0, 6).map(([key, value]) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-xl bg-[#F8FFFB] px-3 py-2 text-sm"
                          key={key}
                        >
                          <span className="font-bold text-[#526173]">{key}</span>
                          <span className="truncate font-semibold text-[#081B3A]">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {canManagePrivacy ? (
              <ContactConsentPanel
                contactId={contact.id}
                marketingConsentStatus={contact.marketingConsentStatus}
                utilityConsentStatus={contact.utilityConsentStatus}
              />
            ) : null}
          </div>

          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard
                helper={`${customer360.engagement.failedMessages.toLocaleString(
                  "en-IN",
                )} failed`}
                icon={MessageSquareText}
                label="Read messages"
                value={customer360.engagement.readMessages.toLocaleString(
                  "en-IN",
                )}
              />
              <StatCard
                helper="WhatsApp Flow submissions"
                icon={FileText}
                label="Forms"
                value={customer360.forms.totalResponses.toLocaleString("en-IN")}
              />
              <StatCard
                helper={`${contact._count.inboxNotes.toLocaleString(
                  "en-IN",
                )} internal notes`}
                icon={NotebookTabs}
                label="Open tasks"
                value={customer360.crm.openTasks.length.toLocaleString("en-IN")}
              />
            </section>

            <section className="grid gap-6 2xl:grid-cols-2">
              <SectionCard
                description="Latest inbound and outbound WhatsApp messages with campaign context."
                icon={MessageSquareText}
                title="Conversation history"
              >
                {customer360.engagement.recentMessages.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.engagement.recentMessages.map((message) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={message.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {pretty(message.direction)}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[#526173]">
                              {previewText(message.body)}
                            </p>
                          </div>
                          <StatusBadge
                            tone={
                              message.status === "READ" ||
                              message.status === "DELIVERED" ||
                              message.status === "SENT"
                                ? "green"
                                : message.status === "FAILED"
                                  ? "red"
                                  : "blue"
                            }
                          >
                            {pretty(message.status)}
                          </StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {formatDate(message.createdAt)}
                          {message.campaign?.name
                            ? ` - ${message.campaign.name}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No WhatsApp conversation history yet." />
                )}
              </SectionCard>

              <SectionCard
                description="Reply intent and response timing from campaign attribution."
                icon={Reply}
                title="Replies and intent"
              >
                {customer360.engagement.replies.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.engagement.replies.map((reply) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={reply.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {pretty(reply.intent)}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[#526173]">
                              {previewText(reply.replyBodyPreview)}
                            </p>
                          </div>
                          <StatusBadge tone="blue">
                            {reply.responseTimeMinutes ?? 0} min
                          </StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {formatDate(reply.repliedAt)}
                          {reply.campaign?.name
                            ? ` - ${reply.campaign.name}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No attributed replies or intent signals yet." />
                )}
              </SectionCard>
            </section>

            <section className="grid gap-6 2xl:grid-cols-2">
              <SectionCard
                description="Payments, conversion value, and active order outstanding value."
                icon={IndianRupee}
                title="Payments and value"
              >
                <div className="grid gap-2">
                  <InfoRow
                    label="Lifetime value"
                    value={formatMoney(
                      customer360.money.customerLifetimeValuePaise,
                    )}
                  />
                  <InfoRow
                    label="Order value"
                    value={formatMoney(customer360.money.orderValuePaise)}
                  />
                  <InfoRow
                    label="Outstanding amount"
                    value={formatMoney(
                      customer360.money.outstandingAmountPaise,
                    )}
                  />
                  <InfoRow
                    label="Tracked payments"
                    value={formatMoney(customer360.money.paymentReceivedPaise)}
                  />
                </div>

                {customer360.campaigns.conversions.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {customer360.campaigns.conversions.slice(0, 4).map((item) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={item.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {pretty(item.type)}
                            </p>
                            <p className="mt-1 text-sm text-[#526173]">
                              {item.campaign?.name ?? "Manual conversion"}
                            </p>
                          </div>
                          <p className="font-black text-[#128C7E]">
                            {formatMoney(item.valuePaise ?? 0)}
                          </p>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {formatDate(item.occurredAt)}
                          {item.note ? ` - ${item.note}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <EmptyPanel label="No payment or conversion events have been tracked yet." />
                  </div>
                )}
              </SectionCard>

              <SectionCard
                description="Tally ledger mapping and accounting context for this customer."
                icon={Database}
                title="Tally ledger"
              >
                {customer360.tally.primaryLedger ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-[#081B3A]">
                            {customer360.tally.primaryLedger.tallyLedgerName}
                          </p>
                          <p className="mt-1 font-mono text-xs font-semibold text-[#526173]">
                            {customer360.tally.primaryLedger.tallyLedgerId}
                          </p>
                        </div>
                        <StatusBadge tone="green">
                          {customer360.tally.primaryLedger.confidence}% match
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <InfoRow
                        label="Match source"
                        value={pretty(
                          customer360.tally.primaryLedger.matchSource,
                        )}
                      />
                      <InfoRow
                        label="Last synced"
                        value={formatDate(
                          customer360.tally.primaryLedger.lastSyncedAt,
                        )}
                      />
                      <InfoRow
                        label="Mapped ledgers"
                        value={customer360.tally.mappings.length}
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyPanel label="No Tally ledger is mapped to this customer yet." />
                )}
              </SectionCard>
            </section>

            <section className="grid gap-6 2xl:grid-cols-2">
              <SectionCard
                description="Recent customer campaign delivery and reply context."
                icon={Target}
                title="Campaign history"
              >
                {customer360.campaigns.recentCampaigns.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.campaigns.recentCampaigns.map((item) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={item.id}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {item.campaign.name}
                            </p>
                            <p className="mt-1 text-sm text-[#526173]">
                              Template {item.campaign.template?.name ?? "Unknown"}
                            </p>
                          </div>
                          <StatusBadge
                            tone={
                              item.status === "READ" ||
                              item.status === "DELIVERED"
                                ? "green"
                                : item.status === "FAILED"
                                  ? "red"
                                  : "blue"
                            }
                          >
                            {pretty(item.status)}
                          </StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No campaign history for this customer yet." />
                )}
              </SectionCard>

              <SectionCard
                description="Real orders attached to this contact."
                icon={ShoppingBag}
                title="Orders"
              >
                {customer360.orders.recentOrders.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.orders.recentOrders.map((order) => (
                      <Link
                        className="block rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4 transition hover:-translate-y-0.5 hover:bg-white"
                        href={`/dashboard/orders/${order.id}`}
                        key={order.id}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {order.orderNumber}
                            </p>
                            <p className="mt-1 text-sm text-[#526173]">
                              {order.itemCount} items - {pretty(order.source)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-[#081B3A]">
                              {formatMoney(order.totalPaise)}
                            </p>
                            <StatusBadge tone="blue">
                              {pretty(order.status)}
                            </StatusBadge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No orders are linked with this contact yet." />
                )}
              </SectionCard>
            </section>

            <section className="grid gap-6 2xl:grid-cols-2">
              <SectionCard
                description="Open reminders and sales/service actions for the team."
                icon={CalendarClock}
                title="Tasks and reminders"
              >
                {customer360.crm.openTasks.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.crm.openTasks.map((task) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={task.id}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {task.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[#526173]">
                              {task.description ?? task.campaign.name}
                            </p>
                          </div>
                          <StatusBadge
                            tone={task.priority === "HIGH" ? "amber" : "blue"}
                          >
                            {pretty(task.priority)}
                          </StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          Due {formatDate(task.dueAt)} -{" "}
                          {task.assignedToUser?.name ??
                            task.assignedToUser?.email ??
                            "Unassigned"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No open follow-up tasks for this customer." />
                )}
              </SectionCard>

              <SectionCard
                description="Form and WhatsApp Flow submissions by this customer."
                icon={ClipboardList}
                title="Form submissions"
              >
                {customer360.forms.responses.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.forms.responses.map((response) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={response.id}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {response.flow.name}
                            </p>
                            <p className="mt-1 text-sm text-[#526173]">
                              Screen {response.screenId ?? "Unknown"}
                            </p>
                          </div>
                          <StatusBadge tone="green">
                            {pretty(response.status)}
                          </StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {formatDate(response.submittedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No WhatsApp Form submissions yet." />
                )}
              </SectionCard>
            </section>

            <section className="grid gap-6 2xl:grid-cols-2">
              <SectionCard
                description="Private team notes recorded from inbox and CRM work."
                icon={NotebookTabs}
                title="Internal notes"
              >
                {customer360.crm.notes.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.crm.notes.map((note) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={note.id}
                      >
                        <p className="text-sm leading-6 text-[#526173]">
                          {note.body}
                        </p>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {note.author.name ?? note.author.email} -{" "}
                          {formatDate(note.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No internal notes have been added yet." />
                )}
              </SectionCard>

              <SectionCard
                description="Recent CRM events such as assignment, tags, consent, and profile changes."
                icon={Activity}
                title="Activity trail"
              >
                {customer360.crm.activities.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.crm.activities.map((activity) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={activity.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {activity.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[#526173]">
                              {activity.description ?? pretty(activity.type)}
                            </p>
                          </div>
                          <StatusBadge tone="slate">
                            {pretty(activity.type)}
                          </StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {activity.actor?.name ??
                            activity.actor?.email ??
                            "System"}{" "}
                          - {formatDate(activity.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No CRM activity has been recorded yet." />
                )}
              </SectionCard>
            </section>

            <section className="grid gap-6 2xl:grid-cols-2">
              <SectionCard
                description="Booking and appointment signals captured from WhatsApp Flows."
                icon={CalendarClock}
                title="Appointment history"
              >
                {customer360.appointments.responses.length > 0 ? (
                  <div className="space-y-3">
                    {customer360.appointments.responses.map((response) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                        key={response.id}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-[#081B3A]">
                              {response.flow.name}
                            </p>
                            <p className="mt-1 text-sm text-[#526173]">
                              Screen {response.screenId ?? "Unknown"}
                            </p>
                          </div>
                          <StatusBadge tone="green">
                            {pretty(response.status)}
                          </StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-[#526173]">
                          {formatDate(response.submittedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No appointment Flow submission is linked yet." />
                )}
              </SectionCard>

              <SectionCard
                description="Invoice/payment ledger status for customer accounting."
                icon={ReceiptText}
                title="Invoices and ledger status"
              >
                <div className="grid gap-2">
                  <InfoRow
                    label="Customer invoices"
                    value="Not connected yet"
                  />
                  <InfoRow
                    label="Tracked payments"
                    value={formatMoney(customer360.money.paymentReceivedPaise)}
                  />
                  <InfoRow
                    label="Outstanding"
                    value={formatMoney(
                      customer360.money.outstandingAmountPaise,
                    )}
                  />
                  <InfoRow
                    label="Ledger source"
                    value={
                      customer360.tally.isMapped
                        ? "Tally mapping available"
                        : "No ledger mapping"
                    }
                  />
                </div>
                <p className="mt-4 rounded-2xl bg-[#F2FBF7] p-4 text-sm leading-6 text-[#526173]">
                  Customer invoice and payment tables are not connected to this
                  contact yet. This panel uses order outstanding value, campaign
                  payment conversions, and Tally ledger mapping where available.
                </p>
              </SectionCard>
            </section>

            <SectionCard
              description="Consent, opt-out, and privacy-relevant changes."
              icon={ShieldCheck}
              title="Consent and opt-out history"
            >
              <div className="space-y-3">
                {consentEvents.map((event) => (
                  <div
                    className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
                    key={event.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[#081B3A]">
                          {pretty(event.type)} - {pretty(event.status)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#526173]">
                          {pretty(event.source)} - {formatDate(event.createdAt)}
                          {event.actor?.email ? ` - ${event.actor.email}` : ""}
                        </p>
                      </div>
                      <StatusBadge
                        tone={event.status === "GRANTED" ? "green" : "red"}
                      >
                        {pretty(event.status)}
                      </StatusBadge>
                    </div>
                    {event.evidenceText ? (
                      <p className="mt-3 text-sm leading-6 text-[#526173]">
                        {event.evidenceText}
                      </p>
                    ) : null}
                  </div>
                ))}

                {consentEvents.length === 0 ? (
                  <EmptyPanel label="No consent ledger events yet." />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              description="Recent timeline across messages, campaigns, notes, automations, and payments."
              icon={NotebookTabs}
              title="Customer journey"
            >
              <CustomerJourneyTimeline contactId={contact.id} />
            </SectionCard>
          </div>
        </section>
      </div>
    </main>
  );
}
