import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CheckCheck,
  Eye,
  Megaphone,
  MessageCircle,
  MessageSquareReply,
  RadioTower,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
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
import { BroadcastDraftActions } from "./_components/broadcast-draft-actions";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDateTime(date: Date | null) {
  if (!date) return "Not scheduled";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function percent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function BroadcastHeroVisual({
  delivered,
  read,
  replies,
  sent,
}: {
  delivered: number;
  read: number;
  replies: number;
  sent: number;
}) {
  const bars = [
    { label: "Sent", value: sent, color: "bg-[#128C7E]" },
    { label: "Delivered", value: delivered, color: "bg-[#2563EB]" },
    { label: "Read", value: read, color: "bg-[#22C55E]" },
    { label: "Replies", value: replies, color: "bg-[#075E54]" },
  ];
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_44px_rgba(8,27,58,0.08)]">
      <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[48px] bg-[#E7F8EF]" />
      <div className="relative grid gap-5 lg:grid-cols-[0.8fr_1fr] lg:items-center">
        <div className="rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#128C7E] text-white">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Campaign preview
                </p>
                <p className="text-xs text-[#526173]">Private WhatsApp send</p>
              </div>
            </div>
            <StatusPill tone="green">Ready</StatusPill>
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.07)]">
            <p className="text-xs font-semibold text-[#128C7E]">To Satyam</p>
            <p className="mt-2 text-sm leading-6 text-[#081B3A]">
              Hi Satyam, your order update is ready. Tap below to view details
              or reply if you need help.
            </p>
            <div className="mt-4 grid gap-2">
              <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] px-3 py-2 text-center text-xs font-semibold text-[#128C7E]">
                View order
              </div>
              <div className="rounded-xl border border-[#B9D9FF] bg-[#EEF6FF] px-3 py-2 text-center text-xs font-semibold text-[#2563EB]">
                Talk to support
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { icon: Send, label: "Sent", value: sent },
              { icon: CheckCheck, label: "Delivered", value: delivered },
              { icon: Eye, label: "Read", value: read },
              { icon: MessageSquareReply, label: "Replies", value: replies },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-3"
                >
                  <Icon className="h-4 w-4 text-[#128C7E]" />
                  <p className="mt-3 text-xl font-bold text-[#081B3A]">
                    {formatNumber(item.value)}
                  </p>
                  <p className="text-xs text-[#526173]">{item.label}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[#B9D9FF] bg-[#EEF6FF] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Live broadcast performance
                </p>
                <p className="text-xs text-[#526173]">
                  Delivery, read, and reply movement at a glance.
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-[#2563EB]" />
            </div>
            <div className="mt-5 grid gap-3">
              {bars.map((bar) => (
                <div key={bar.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[#526173]">{bar.label}</span>
                    <span className="font-semibold text-[#081B3A]">
                      {formatNumber(bar.value)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${bar.color}`}
                      style={{
                        width: `${Math.max(12, Math.round((bar.value / maxValue) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionVisual({ type }: { type: "audience" | "personalise" | "visibility" }) {
  if (type === "audience") {
    return (
      <div className="mt-5 rounded-2xl border border-[#B9D9FF] bg-[#EEF6FF] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#081B3A]">Segment builder</p>
          <Tags className="h-5 w-5 text-[#2563EB]" />
        </div>
        <div className="mt-4 grid gap-2">
          {["City: Mumbai", "Tag: repeat buyer", "Consent: opted in"].map(
            (item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#081B3A]"
              >
                {item}
                <CheckCircle2 className="h-4 w-4 text-[#128C7E]" />
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  if (type === "visibility") {
    return (
      <div className="mt-5 rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF]/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#081B3A]">Recipient timeline</p>
          <Eye className="h-5 w-5 text-[#128C7E]" />
        </div>
        <div className="mt-4 space-y-3">
          {[
            ["Sent", "09:10"],
            ["Delivered", "09:11"],
            ["Read", "09:18"],
            ["Replied", "09:22"],
          ].map(([label, time]) => (
            <div key={label} className="flex items-center gap-3">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#128C7E]">
                <CheckCheck className="h-3.5 w-3.5" />
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-xl bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-[#081B3A]">{label}</span>
                <span className="text-[#526173]">{time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#081B3A]">Dynamic variables</p>
        <Sparkles className="h-5 w-5 text-[#128C7E]" />
      </div>
      <div className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-[#081B3A]">
        Hi{" "}
        <span className="rounded-md bg-[#E7F8EF] px-2 py-1 text-xs font-bold text-[#128C7E]">
          customer_name
        </span>
        , your payment of{" "}
        <span className="rounded-md bg-[#EEF6FF] px-2 py-1 text-xs font-bold text-[#2563EB]">
          amount_due
        </span>{" "}
        is due today.
      </div>
    </div>
  );
}

export default async function BroadcastsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;

  const [campaigns, bulkBatches, launchRuns, broadcastDrafts] = await Promise.all([
    prisma.campaign.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        status: true,
        totalContacts: true,
        queuedCount: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
        template: {
          select: {
            category: true,
            language: true,
            name: true,
          },
        },
        _count: {
          select: {
            conversionEvents: true,
            replyAttributions: true,
          },
        },
      },
    }),
    prisma.bulkMessageBatch.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        templateName: true,
        contactGroupName: true,
        status: true,
        requestedCount: true,
        queuedCount: true,
        failedCount: true,
        skippedDuplicateCount: true,
        skippedBlockedCount: true,
        scheduledAt: true,
        createdAt: true,
      },
    }),
    prisma.campaignLaunchRun.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        campaignId: true,
        status: true,
        templateName: true,
        totalRecipients: true,
        validRecipients: true,
        skippedRecipients: true,
        estimatedCostPaise: true,
        reservedAmountPaise: true,
        queuedMessageCount: true,
        createdAt: true,
      },
    }),
    prisma.broadcastCampaignDraft.findMany({
      where: {
        companyId,
        status: {
          in: [
            "DRAFT",
            "READY_TO_SEND",
            "SCHEDULED",
            "PAUSED",
            "CANCELED",
            "LAUNCHED",
          ],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        name: true,
        objective: true,
        currentStep: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  const totals = campaigns.reduce(
    (accumulator, campaign) => ({
      conversions:
        accumulator.conversions + campaign._count.conversionEvents,
      delivered: accumulator.delivered + campaign.deliveredCount,
      failed: accumulator.failed + campaign.failedCount,
      queued: accumulator.queued + campaign.queuedCount,
      read: accumulator.read + campaign.readCount,
      recipients: accumulator.recipients + campaign.totalContacts,
      replies: accumulator.replies + campaign._count.replyAttributions,
      sent: accumulator.sent + campaign.sentCount,
    }),
    {
      conversions: 0,
      delivered: 0,
      failed: 0,
      queued: 0,
      read: 0,
      recipients: 0,
      replies: 0,
      sent: 0,
    },
  );

  const activeRuns = launchRuns.filter((run) =>
    ["RUNNING", "QUEUING", "WALLET_RESERVED", "DRY_RUN_CREATED"].includes(
      run.status,
    ),
  ).length;
  const scheduledBatches = bulkBatches.filter(
    (batch) => batch.status === "SCHEDULED",
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Broadcast Campaigns"
        description="Create private, personalized WhatsApp broadcasts with approved templates, consent checks, wallet validation, delivery tracking, and reply attribution."
        actions={
          <>
            <Link
              href="/dashboard/broadcasts/launch"
              className={actionButtonClass("secondary")}
            >
              <RadioTower className="mr-2 h-4 w-4" />
              Control center
            </Link>
            <Link href="/dashboard/broadcasts/new" className={actionButtonClass()}>
              <Megaphone className="mr-2 h-4 w-4" />
              Create broadcast
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.78fr_1.22fr] xl:items-stretch">
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_44px_rgba(8,27,58,0.08)] sm:p-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E7F8EF] text-[#128C7E]">
            <Megaphone className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-bold text-[#081B3A]">
            Broadcast privately, track everything.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#526173]">
            Use approved WhatsApp templates to send private one-to-one campaign
            messages, measure every delivery event, and follow up with the
            customers who engage.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Approved templates", "Opt-in audience", "Live reports"].map(
              (item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#BFE9D0] bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#128C7E]"
                >
                  {item}
                </span>
              ),
            )}
          </div>
        </div>

        <BroadcastHeroVisual
          delivered={totals.delivered}
          read={totals.read}
          replies={totals.replies}
          sent={totals.sent}
        />
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Megaphone}
          label="Broadcasts"
          value={formatNumber(campaigns.length + bulkBatches.length)}
          detail={`${formatNumber(activeRuns)} active launch run(s)`}
        />
        <MetricCard
          icon={Users}
          label="Recipients targeted"
          value={formatNumber(totals.recipients)}
          detail={`${formatNumber(scheduledBatches)} scheduled batch(es)`}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Delivered"
          value={formatNumber(totals.delivered)}
          detail={`${percent(totals.delivered, totals.recipients)} delivery rate`}
        />
        <MetricCard
          icon={MessageSquareReply}
          label="Replies tracked"
          value={formatNumber(totals.replies)}
          detail={`${formatNumber(totals.conversions)} conversion event(s)`}
        />
      </section>

      {broadcastDrafts.length > 0 ? (
        <Panel className="mb-6">
          <PanelTitle
            title="Drafts and launch controls"
            description="Resume drafts, clone campaigns, and control scheduled broadcasts before the scheduler turns them into launch runs."
          />
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {broadcastDrafts.map((draft) => (
              <div
                className="rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4 transition hover:border-[#128C7E] hover:bg-[#E7F8EF]/60"
                key={draft.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      className="font-bold text-[#081B3A] hover:text-[#128C7E]"
                      href={`/dashboard/broadcasts/${draft.id}/edit`}
                    >
                      {draft.name}
                    </Link>
                    <p className="mt-1 text-xs font-semibold uppercase text-[#128C7E]">
                      {draft.objective.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusPill tone={statusTone(draft.status)}>
                      {draft.status.replaceAll("_", " ")}
                    </StatusPill>
                    <StatusPill tone="blue">Step {draft.currentStep}</StatusPill>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#526173]">
                  Last saved {formatDateTime(draft.updatedAt)}
                </p>
                <BroadcastDraftActions
                  draftId={draft.id}
                  status={draft.status}
                />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <section className="mb-6 grid gap-4 xl:grid-cols-3">
        <Panel>
          <PanelTitle
            title="Official broadcast, not a group"
            description="Every recipient gets a private WhatsApp message from the connected business phone. Customers cannot see each other, and replies come back to your inbox."
          />
          <div className="mt-5 grid gap-3 text-sm text-[#526173]">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
              Uses approved WhatsApp templates and consent-aware contacts.
            </div>
            <div className="flex gap-3">
              <Send className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
              Queues messages through the existing worker and delivery tracking.
            </div>
            <div className="flex gap-3">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
              Connects to reports, failures, replies, and throughput controls.
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelTitle
            title="Broadcast workflow"
            description="The sender remains powered by your existing bulk and campaign backend while this page gives teams one production-ready entry point."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              "Audience and duplicate checks",
              "Template variables and preview",
              "Test send and dry run",
              "Wallet reservation",
              "Scheduled or immediate launch",
              "Live delivery and reply reports",
            ].map((item, index) => (
              <div
                key={item}
                className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF]/55 p-4"
              >
                <p className="text-xs font-semibold text-[#128C7E]">
                  STEP {index + 1}
                </p>
                <p className="mt-2 text-sm font-semibold text-[#081B3A]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel className="mb-6">
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr] xl:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
              Personalised messaging
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#081B3A]">
              Personalised Messaging at Scale
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#526173]">
              Make every customer feel like the message was created specifically
              for them while still reaching a large audience quickly.
            </p>
            <SectionVisual type="personalise" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Dynamic Personalisation",
                description:
                  "Automatically include the customer's name, order information, payment details, and other relevant fields.",
              },
              {
                title: "Private One-to-One Messages",
                description:
                  "Every recipient receives an individual WhatsApp message and cannot see other customers in the campaign.",
              },
              {
                title: "Faster Customer Outreach",
                description:
                  "Reach hundreds of customers in minutes without manually writing and sending every message.",
              },
              {
                title: "Stronger Customer Connections",
                description:
                  "Send relevant greetings, reminders, updates, and offers that help the business remain connected with customers.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF]/55 p-4"
              >
                <h3 className="font-bold text-[#081B3A]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#526173]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-6">
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr] xl:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
              Audience targeting
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#081B3A]">
              Send the Right Message to the Right Audience
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#526173]">
              Create targeted customer groups based on location, interests,
              tags, purchase activity, lead stage, consent status, or past
              campaign behaviour. Then send each segment a message designed
              around what matters most to them.
            </p>
            <SectionVisual type="audience" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Flexible Segmentation",
                description:
                  "Group contacts by city, source, tags, activity, lead stage, purchase history, consent status, or custom fields.",
              },
              {
                title: "More Relevant Campaigns",
                description:
                  "Send offers, reminders, and updates only to the customers who are most likely to find them useful.",
              },
              {
                title: "Faster Campaign Setup",
                description:
                  "Select a saved segment and launch a targeted broadcast in just a few clicks.",
              },
              {
                title: "Better Customer Engagement",
                description:
                  "Relevant messages can help improve reads, replies, conversions, and meaningful conversations.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
              >
                <h3 className="font-bold text-[#081B3A]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#526173]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-6">
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr] xl:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
              Message visibility
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#081B3A]">
              Know Who&apos;s Receiving and Reading Your Messages
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#526173]">
              Track every campaign with clear delivery and read insights. See
              which customers received your message, who opened it, and who
              engaged, so your team can follow up with better context and
              confidence.
            </p>
            <SectionVisual type="visibility" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Live Delivery Tracking",
                description:
                  "Monitor sent, delivered, read, replied, and failed messages in real time.",
              },
              {
                title: "Engagement Insights",
                description:
                  "Identify customers who have viewed or responded to your messages and prioritise them for timely follow-up.",
              },
              {
                title: "Smarter Follow-Ups",
                description:
                  "Use real-time engagement data to continue conversations with the right customers at the right moment.",
              },
              {
                title: "Better Campaign Decisions",
                description:
                  "Compare delivery, read, and reply data to improve future messages, audiences, and offers.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF]/55 p-4"
              >
                <h3 className="font-bold text-[#081B3A]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#526173]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-6 overflow-hidden p-0 sm:p-0">
        <div className="flex flex-col gap-3 border-b border-[#BFE9D0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <PanelTitle
            title="Recent broadcast campaigns"
            description="Saved campaigns and their delivery/reply progress."
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/broadcasts/replies"
              className={actionButtonClass("secondary")}
            >
              Replies
            </Link>
            <Link
              href="/dashboard/broadcasts/failures"
              className={actionButtonClass("secondary")}
            >
              Failures
            </Link>
            <Link
              href="/dashboard/broadcasts/reports"
              className={actionButtonClass("secondary")}
            >
              Reports
            </Link>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>
              No saved broadcast campaigns yet. Create a broadcast to select an
              audience, map variables, test delivery, and start tracking results.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Audience</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3">Read</th>
                  <th className="px-5 py-3">Replies</th>
                  <th className="px-5 py-3">Failed</th>
                  <th className="px-5 py-3">Schedule</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#081B3A]">
                        {campaign.name}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        Updated {formatDateTime(campaign.updatedAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      <p className="font-medium text-[#081B3A]">
                        {campaign.template.name}
                      </p>
                      <p className="text-xs">
                        {campaign.template.category} · {campaign.template.language}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(campaign.status)}>
                        {campaign.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">{formatNumber(campaign.totalContacts)}</td>
                    <td className="px-5 py-4">{formatNumber(campaign.sentCount)}</td>
                    <td className="px-5 py-4">
                      {formatNumber(campaign.deliveredCount)}
                      <p className="text-xs text-[#526173]">
                        {percent(campaign.deliveredCount, campaign.totalContacts)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {formatNumber(campaign.readCount)}
                      <p className="text-xs text-[#526173]">
                        {percent(campaign.readCount, campaign.totalContacts)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {formatNumber(campaign._count.replyAttributions)}
                    </td>
                    <td className="px-5 py-4 text-rose-700">
                      {formatNumber(campaign.failedCount)}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {formatDateTime(campaign.scheduledAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/broadcasts/${campaign.id}`}
                          className="font-semibold text-[#128C7E] hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/broadcasts/${campaign.id}/progress`}
                          className="font-semibold text-[#128C7E] hover:underline"
                        >
                          Progress
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel className="overflow-hidden p-0 sm:p-0">
          <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
            <PanelTitle
              title="Latest bulk batches"
              description="CSV, pasted-recipient, and contact-group sends using the worker queue."
            />
          </div>
          {bulkBatches.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState>No bulk batches have been queued yet.</EmptyState>
            </div>
          ) : (
            <div className="divide-y divide-[#BFE9D0]">
              {bulkBatches.slice(0, 6).map((batch) => (
                <Link
                  key={batch.id}
                  href={`/dashboard/broadcasts/${batch.id}`}
                  className="block px-5 py-4 transition hover:bg-[#E7F8EF]/55 sm:px-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#081B3A]">
                        {batch.templateName ?? "Untitled template"}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {batch.contactGroupName ?? "CSV / Manual"} ·{" "}
                        {formatDateTime(batch.createdAt)}
                      </p>
                    </div>
                    <StatusPill tone={statusTone(batch.status)}>
                      {batch.status}
                    </StatusPill>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[#526173] sm:grid-cols-4">
                    <span>Requested {formatNumber(batch.requestedCount)}</span>
                    <span>Queued {formatNumber(batch.queuedCount)}</span>
                    <span>Failed {formatNumber(batch.failedCount)}</span>
                    <span>
                      Skipped{" "}
                      {formatNumber(
                        batch.skippedDuplicateCount + batch.skippedBlockedCount,
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden p-0 sm:p-0">
          <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
            <PanelTitle
              title="Launch control"
              description="Dry runs, wallet reservations, confirmations, and queue status."
            />
          </div>
          {launchRuns.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState>No launch runs yet.</EmptyState>
            </div>
          ) : (
            <div className="divide-y divide-[#BFE9D0]">
              {launchRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/dashboard/broadcasts/${run.campaignId}`}
                  className="block px-5 py-4 transition hover:bg-[#E7F8EF]/55 sm:px-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#081B3A]">
                        {run.templateName}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {formatNumber(run.validRecipients)} valid of{" "}
                        {formatNumber(run.totalRecipients)} recipients
                      </p>
                    </div>
                    <StatusPill tone={statusTone(run.status)}>
                      {run.status}
                    </StatusPill>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[#526173] sm:grid-cols-3">
                    <span>Queued {formatNumber(run.queuedMessageCount)}</span>
                    <span>Skipped {formatNumber(run.skippedRecipients)}</span>
                    <span>
                      Reserved INR{" "}
                      {new Intl.NumberFormat("en-IN").format(
                        run.reservedAmountPaise / 100,
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel className="mt-6 border-rose-200 bg-rose-50">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-sm font-bold text-rose-800">
              Compliance guardrails
            </h2>
            <p className="mt-1 text-sm leading-6 text-rose-700">
              Broadcasts should only target opted-in contacts and approved
              templates. Use WhatsApp Groups only for internal community
              conversations; marketing broadcasts must remain private,
              consent-aware, and reportable.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
