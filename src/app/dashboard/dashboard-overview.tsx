"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageCircle,
  MousePointer2,
  Plus,
  Send,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "indigo" | "emerald" | "violet" | "amber" | "cyan";
  icon: "send" | "check" | "users" | "message" | "wallet";
};

export type DashboardOverviewData = {
  metrics: DashboardMetric[];
  messageVolume: Array<{
    day: string;
    sent: number;
    delivered: number;
    inbound: number;
  }>;
  channelMix: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  campaignPerformance: Array<{
    name: string;
    delivered: number;
    read: number;
  }>;
  activities: Array<{
    title: string;
    detail: string;
    time: string;
    type: "message" | "campaign" | "wallet";
  }>;
  summary: {
    queuedMessages: number;
    unreadInbound: number;
    previousWalletNetPaise: number;
  };
};

type DashboardOverviewProps = {
  companyName: string;
  data: DashboardOverviewData;
  userName: string;
  userRole: string;
};

const metricIcons = {
  check: CheckCircle2,
  message: MessageCircle,
  send: Send,
  users: Users,
  wallet: Wallet,
};

const activityIcons = {
  campaign: TrendingUp,
  message: MessageCircle,
  wallet: CreditCard,
};

const quickActions = [
  {
    label: "New campaign",
    href: "/dashboard/campaigns",
    icon: Plus,
    description: "Queue a targeted WhatsApp blast",
  },
  {
    label: "Send message",
    href: "/dashboard/messages",
    icon: Send,
    description: "Start a template conversation",
  },
  {
    label: "Review inbox",
    href: "/dashboard/inbox",
    icon: MessageCircle,
    description: "Prioritize open customer threads",
  },
  {
    label: "Top up wallet",
    href: "/dashboard/wallet",
    icon: Wallet,
    description: "Keep campaigns moving smoothly",
  },
];

function cardTone(tone: DashboardMetric["tone"]) {
  const tones: Record<DashboardMetric["tone"], string> = {
    amber: "bg-[#F8C830]/20 text-[#081B3A] ring-[#F8C830]/35",
    cyan: "bg-[#2070B0]/10 text-[#2070B0] ring-[#2070B0]/20",
    emerald: "bg-[#22C55E]/10 text-[#15803d] ring-[#22C55E]/25",
    indigo: "bg-[#0052CC]/10 text-[#0052CC] ring-[#0052CC]/20",
    violet: "bg-[#384080]/10 text-[#384080] ring-[#384080]/20",
  };

  return tones[tone];
}

function hasChartData(data: Array<Record<string, number | string>>) {
  return data.some((item) =>
    Object.entries(item).some(
      ([key, value]) => key !== "day" && key !== "name" && Number(value) > 0,
    ),
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[#D8E6F3] bg-white px-3 py-2 text-xs shadow-[0_16px_40px_rgba(8,27,58,0.14)]">
      {label && <p className="mb-1 font-semibold text-[#081B3A]">{label}</p>}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-[#526173]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}</span>
            <span className="ml-auto font-semibold text-[#102040]">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-dashed border-[#D8E6F3] bg-[#F0F8FF] p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-[#081B3A]">No real data yet</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#526173]">
          {message}
        </p>
      </div>
    </div>
  );
}

export function DashboardOverview({
  companyName,
  data,
  userName,
  userRole,
}: DashboardOverviewProps) {
  const hasMessageVolume = hasChartData(data.messageVolume);
  const hasCampaignPerformance = hasChartData(data.campaignPerformance);
  const hasChannelMix = data.channelMix.some((item) => item.value > 0);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.75rem] border border-[#D8E6F3] bg-[linear-gradient(135deg,#FFFFFF,#F0F8FF_62%,rgba(216,230,243,0.72))] p-6 shadow-[0_18px_48px_rgba(8,27,58,0.10)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D8E6F3] bg-white px-3 py-1 text-xs font-semibold text-[#0052CC]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {userRole} workspace
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-extrabold tracking-normal text-[#081B3A] sm:text-5xl">
              Command center for {companyName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#526173] sm:text-base">
              These dashboard numbers are calculated from your real workspace
              data: messages, contacts, wallet transactions, campaigns, and
              inbox records.
            </p>
          </div>

          <div className="rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-[#526173]">Signed in as</p>
                <p className="mt-1 truncate text-sm font-bold text-[#081B3A]">
                  {userName}
                </p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F0F8FF] text-[#0052CC]">
                <MousePointer2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#D8E6F3] bg-[#F0F8FF] p-3">
                <p className="text-[11px] text-[#526173]">Queued messages</p>
                <p className="mt-1 text-lg font-bold text-[#081B3A]">
                  {data.summary.queuedMessages.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-2xl border border-[#D8E6F3] bg-[#F0F8FF] p-3">
                <p className="text-[11px] text-[#526173]">Unread inbound</p>
                <p className="mt-1 text-lg font-bold text-[#081B3A]">
                  {data.summary.unreadInbound.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {data.metrics.map((stat) => {
          const Icon = metricIcons[stat.icon];

          return (
            <div
              key={stat.label}
              className="group rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-[#0052CC]/30 hover:shadow-[0_18px_42px_rgba(8,27,58,0.11)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={[
                    "grid h-12 w-12 place-items-center rounded-2xl ring-1",
                    cardTone(stat.tone),
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F0F8FF] text-[#526173]">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-5 text-sm text-[#526173]">{stat.label}</p>
              <p className="mt-2 text-2xl font-extrabold tracking-normal text-[#081B3A]">
                {stat.value}
              </p>
              <p className="mt-2 min-h-5 text-xs text-[#526173]">
                {stat.detail}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <Panel>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#081B3A]">Message volume</p>
              <p className="mt-1 text-xs text-[#526173]">
                Real sent, delivered, and inbound messages from the last 7 days
              </p>
            </div>
            <div className="hidden items-center gap-3 text-xs text-[#526173] sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#0052CC]" />
                Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2070B0]" />
                Delivered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#384080]" />
                Inbound
              </span>
            </div>
          </div>

          <div className="h-[300px]">
            {hasMessageVolume ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.messageVolume} margin={{ left: -18, right: 8 }}>
                  <defs>
                    <linearGradient id="sentGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#0052CC" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0052CC" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="inboundGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#384080" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#384080" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    axisLine={false}
                    dataKey="day"
                    tickLine={false}
                    tick={{ fill: "#526173", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#526173", fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    dataKey="sent"
                    fill="url(#sentGradient)"
                    name="Sent"
                    stroke="#0052CC"
                    strokeWidth={3}
                    type="monotone"
                  />
                  <Area
                    dataKey="delivered"
                    fill="transparent"
                    name="Delivered"
                    stroke="#2070B0"
                    strokeWidth={3}
                    type="monotone"
                  />
                  <Area
                    dataKey="inbound"
                    fill="url(#inboundGradient)"
                    name="Inbound"
                    stroke="#384080"
                    strokeWidth={3}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Send or receive messages and this chart will populate from your database." />
            )}
          </div>
        </Panel>

        <Panel>
          <div className="mb-6">
            <p className="text-sm font-bold text-[#081B3A]">Message status mix</p>
            <p className="mt-1 text-xs text-[#526173]">
              Current distribution by stored message status
            </p>
          </div>
          {hasChannelMix ? (
            <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr] xl:grid-cols-1 2xl:grid-cols-[220px_1fr]">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={data.channelMix}
                      dataKey="value"
                      innerRadius={62}
                      outerRadius={90}
                      paddingAngle={4}
                      stroke="transparent"
                    >
                      {data.channelMix.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {data.channelMix.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-2xl border border-[#D8E6F3] bg-[#F0F8FF] px-4 py-3"
                  >
                    <span className="flex items-center gap-2 text-sm text-[#526173]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </span>
                    <span className="text-sm font-bold text-[#081B3A]">
                      {item.value.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="No message records exist yet, so there is no status mix to show." />
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#081B3A]">
                Campaign performance
              </p>
              <p className="mt-1 text-xs text-[#526173]">
                Delivered and read percentages from stored campaign counters
              </p>
            </div>
            <Clock3 className="h-4 w-4 text-[#526173]" />
          </div>
          <div className="h-[300px]">
            {hasCampaignPerformance ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.campaignPerformance} margin={{ left: -18 }}>
                  <XAxis
                    axisLine={false}
                    dataKey="name"
                    tickLine={false}
                    tick={{ fill: "#526173", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#526173", fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="delivered"
                    fill="#0052CC"
                    name="Delivered %"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="read"
                    fill="#2070B0"
                    name="Read %"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Start a campaign and this chart will use its real delivery and read counters." />
            )}
          </div>
        </Panel>

        <Panel>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#081B3A]">Recent activity</p>
              <p className="mt-1 text-xs text-[#526173]">
                Latest messages, campaigns, and wallet transactions
              </p>
            </div>
            <div className="rounded-full bg-[#F8C830]/20 px-3 py-1 text-xs font-semibold text-[#081B3A]">
              Real data
            </div>
          </div>

          {data.activities.length > 0 ? (
            <div className="space-y-3">
              {data.activities.map((item, index) => {
                const Icon = activityIcons[item.type];

                return (
                  <div
                    key={`${item.title}-${item.time}-${index}`}
                    className="group flex items-center gap-4 rounded-2xl border border-[#D8E6F3] bg-white p-4 transition duration-200 hover:border-[#0052CC]/25 hover:bg-[#F0F8FF]"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F0F8FF] text-[#0052CC] transition group-hover:bg-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#081B3A]">
                        {item.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#526173]">
                        {item.detail}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-[#526173]">{item.time}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart message="No messages, campaigns, or wallet transactions have been recorded yet." />
          )}
        </Panel>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-[#0052CC]/30 hover:bg-[#F0F8FF]"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F0F8FF] text-[#0052CC]">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-[#526173] transition group-hover:text-[#0052CC]" />
              </div>
              <p className="mt-5 text-sm font-bold text-[#081B3A]">
                {action.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#526173]">
                {action.description}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
