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
    amber: "from-amber-400/18 to-amber-500/5 text-amber-300",
    cyan: "from-cyan-400/18 to-cyan-500/5 text-cyan-300",
    emerald: "from-emerald-400/18 to-emerald-500/5 text-emerald-300",
    indigo: "from-indigo-400/18 to-indigo-500/5 text-indigo-300",
    violet: "from-violet-400/18 to-violet-500/5 text-violet-300",
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
    <div className="rounded-xl border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-2xl">
      {label && <p className="mb-1 font-medium text-white">{label}</p>}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-zinc-400">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}</span>
            <span className="ml-auto font-medium text-zinc-100">
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
        "rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.025] p-6 text-center">
      <div>
        <p className="text-sm font-medium text-white">No real data yet</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.045] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              {userRole} workspace
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Command center for {companyName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              These dashboard numbers are calculated from your real workspace
              data: messages, contacts, wallet transactions, campaigns, and
              inbox records.
            </p>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">Signed in as</p>
                <p className="mt-1 truncate text-sm font-medium text-white">
                  {userName}
                </p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-400/10 text-indigo-300">
                <MousePointer2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.05] p-3">
                <p className="text-[11px] text-zinc-500">Queued messages</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {data.summary.queuedMessages.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-3">
                <p className="text-[11px] text-zinc-500">Unread inbound</p>
                <p className="mt-1 text-lg font-semibold text-white">
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
              className="group rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-indigo-300/30 hover:bg-white/[0.07]"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={[
                    "grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br",
                    cardTone(stat.tone),
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.05] text-zinc-500">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-5 text-sm text-zinc-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-normal text-white">
                {stat.value}
              </p>
              <p className="mt-2 min-h-5 text-xs text-zinc-500">
                {stat.detail}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Panel>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Message volume</p>
              <p className="mt-1 text-xs text-zinc-500">
                Real sent, delivered, and inbound messages from the last 7 days
              </p>
            </div>
            <div className="hidden items-center gap-3 text-xs text-zinc-500 sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                Delivered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-300" />
                Inbound
              </span>
            </div>
          </div>

          <div className="h-[320px]">
            {hasMessageVolume ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.messageVolume} margin={{ left: -18, right: 8 }}>
                  <defs>
                    <linearGradient id="sentGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="inboundGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#c084fc" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#c084fc" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    axisLine={false}
                    dataKey="day"
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    dataKey="sent"
                    fill="url(#sentGradient)"
                    name="Sent"
                    stroke="#818cf8"
                    strokeWidth={3}
                    type="monotone"
                  />
                  <Area
                    dataKey="delivered"
                    fill="transparent"
                    name="Delivered"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    type="monotone"
                  />
                  <Area
                    dataKey="inbound"
                    fill="url(#inboundGradient)"
                    name="Inbound"
                    stroke="#c084fc"
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
            <p className="text-sm font-medium text-white">Message status mix</p>
            <p className="mt-1 text-xs text-zinc-500">
              Current distribution by stored message status
            </p>
          </div>
          {hasChannelMix ? (
            <div className="grid items-center gap-6 sm:grid-cols-[240px_1fr] xl:grid-cols-1 2xl:grid-cols-[240px_1fr]">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={data.channelMix}
                      dataKey="value"
                      innerRadius={68}
                      outerRadius={98}
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
                    className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
                  >
                    <span className="flex items-center gap-2 text-sm text-zinc-300">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </span>
                    <span className="text-sm font-semibold text-white">
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">
                Campaign performance
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Delivered and read percentages from stored campaign counters
              </p>
            </div>
            <Clock3 className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="h-[300px]">
            {hasCampaignPerformance ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.campaignPerformance} margin={{ left: -18 }}>
                  <XAxis
                    axisLine={false}
                    dataKey="name"
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="delivered"
                    fill="#818cf8"
                    name="Delivered %"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="read"
                    fill="#22d3ee"
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
              <p className="text-sm font-medium text-white">Recent activity</p>
              <p className="mt-1 text-xs text-zinc-500">
                Latest messages, campaigns, and wallet transactions
              </p>
            </div>
            <div className="rounded-full bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
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
                    className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 transition duration-200 hover:border-indigo-300/20 hover:bg-white/[0.06]"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-400/10 text-indigo-300 transition group-hover:bg-indigo-400/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {item.detail}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-zinc-600">{item.time}</p>
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
              className="group rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-indigo-300/30 hover:bg-white/[0.07]"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.06] text-indigo-300">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-zinc-600 transition group-hover:text-indigo-300" />
              </div>
              <p className="mt-5 text-sm font-semibold text-white">
                {action.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {action.description}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
