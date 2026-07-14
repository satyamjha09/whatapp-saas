"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  IndianRupee,
  Languages,
  Layers3,
  Lightbulb,
  MailCheck,
  MessageCircleReply,
  MousePointerClick,
  Send,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusPill, statusTone } from "@/app/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";

type Kpi = {
  rate?: number;
  trend: number;
  value?: number;
  valuePaise?: number;
};

type DashboardAnalytics = {
  audit: {
    dataSources: string[];
    phase: string;
    rangeDays: number;
  };
  breakdowns: {
    categories: PerformanceRow[];
    conversionTypes: Array<{ name: string; value: number; valuePaise: number }>;
    failureReasons: Array<{
      name: string;
      retryable: number;
      severity: string;
      value: number;
    }>;
    languages: PerformanceRow[];
    replyIntents: Array<{ name: string; value: number }>;
    segments: Array<{
      id: string;
      lastPreviewAt: string | null;
      name: string;
      previewCount: number;
      status: string;
    }>;
    templates: PerformanceRow[];
  };
  engagement: Array<{ name: string; value: number }>;
  funnel: Array<{ name: string; value: number }>;
  kpis: {
    campaigns: Kpi;
    conversions: Kpi;
    delivered: Kpi;
    read: Kpi;
    replied: Kpi;
    revenue: Kpi;
    sent: Kpi;
  };
  intelligence: {
    campaignComparison: Array<{
      healthScore: number;
      id: string;
      name: string;
      readRate: number;
      replyRate: number;
      roiPercent: number;
      sent: number;
      templateName: string;
    }>;
    decisionBrief: {
      confidence: string;
      generatedAt: string;
      highlights: string[];
      nextActions: Array<{
        description: string;
        owner: string;
        priority: string;
        title: string;
      }>;
      opportunities: string[];
      risks: string[];
      title: string;
      verdict: string;
    };
    executiveSummary: string[];
    experiments: Array<{
      basis: string;
      confidence: string;
      lift: {
        health: number;
        readRate: number;
        replyRate: number;
        roiPercent: number;
      };
      templateName: string;
      totalSent: number;
      variants: Array<{
        healthScore: number;
        id: string;
        name: string;
        readRate: number;
        replyRate: number;
        revenuePaise: number;
        roiPercent: number;
        sent: number;
      }>;
      winner: {
        id: string;
        name: string;
      };
    }>;
    exportReadiness: {
      completedExports: number;
      formats: Array<{
        available: boolean;
        label: string;
        note: string;
      }>;
      recentExports: Array<{
        createdAt: string;
        filename: string;
        format: string;
        rowCount: number;
        sizeBytes: number;
      }>;
      scheduledReports: {
        available: boolean;
        note: string;
      };
    };
    retargeting: Array<{
      action: string;
      audience: string;
      count: number;
      priority: string;
      reason: string;
    }>;
    revenueAttribution: {
      conversionRate: number;
      costPaise: number;
      costPerDeliveredPaise: number;
      costPerReadPaise: number;
      netPaise: number;
      revenuePaise: number;
      revenuePerConversionPaise: number;
      revenuePerReplyPaise: number;
      roiPercent: number;
    };
  };
  recommendations: Array<{
    description: string;
    title: string;
    tone: string;
  }>;
  scores: {
    audienceQuality: {
      grade: string;
      reasons: string[];
      score: number;
    };
    campaignHealth: {
      grade: string;
      reasons: string[];
      score: number;
    };
  };
  timing: {
    bestTimeWindows: Array<{
      day: string;
      engagement: number;
      failed: number;
      read: number;
      readRate: number;
      replied: number;
      replyRate: number;
      sent: number;
      window: string;
    }>;
    heatmap: Array<{
      day: string;
      engagement: number;
      failed: number;
      read: number;
      replied: number;
      sent: number;
      window: string;
    }>;
    hourly: Array<{
      failed: number;
      hour: number;
      label: string;
      read: number;
      replied: number;
      sent: number;
    }>;
  };
  topCampaigns: Array<{
    costPaise: number;
    conversionCount: number;
    delivered: number;
    deliveryRate: number;
    failed: number;
    healthScore: number;
    id: string;
    name: string;
    read: number;
    readRate: number;
    replied: number;
    replyRate: number;
    revenuePaise: number;
    roiPercent: number;
    sent: number;
    status: string;
    templateName: string;
  }>;
  totals: {
    costPaise: number;
    delivered: number;
    failed: number;
    read: number;
    replied: number;
    sent: number;
    totalContacts: number;
  };
  trend: Array<{
    date: string;
    delivered: number;
    failed: number;
    read: number;
    replied: number;
    sent: number;
  }>;
};

type PerformanceRow = {
  delivered: number;
  deliveryRate: number;
  failed: number;
  failureRate: number;
  name: string;
  read: number;
  readRate: number;
  replied: number;
  replyRate: number;
  sent: number;
};

type AdvancedCampaignDashboardProps = {
  analytics: DashboardAnalytics;
};

const engagementColors = ["#128C7E", "#25D366", "#2563EB", "#7C3AED", "#E11D48"];

const compactNumber = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const money = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatNumber(value: number) {
  return compactNumber.format(value);
}

function formatMoney(paise: number) {
  return money.format(paise / 100);
}

function formatRate(value?: number) {
  return `${(value ?? 0).toFixed(1)}%`;
}

function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        positive
          ? "bg-emerald-50 text-[#128C7E]"
          : "bg-rose-50 text-rose-600",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  detail,
  icon: Icon,
  label,
  value,
  trend,
}: {
  detail: string;
  icon: typeof Send;
  label: string;
  trend: number;
  value: string;
}) {
  return (
    <article className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(8,27,58,0.10)]">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Icon className="h-5 w-5" />
        </div>
        <TrendBadge value={trend} />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#526173]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight text-[#081B3A]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#526173]">{detail}</p>
    </article>
  );
}

function ChartPanel({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div>
        <h2 className="text-lg font-black text-[#081B3A]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#526173]">{description}</p>
      </div>
      <div className="mt-5 h-[280px]">{children}</div>
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F2FBF7] text-sm font-semibold text-[#526173]">
      {label}
    </div>
  );
}

function ScorePanel({
  description,
  icon: Icon,
  score,
  title,
}: {
  description: string;
  icon: typeof Send;
  score: DashboardAnalytics["scores"]["campaignHealth"];
  title: string;
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start justify-between gap-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#081B3A]">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              {description}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-4xl font-black text-[#081B3A]">{score.score}</p>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#128C7E]">
            {score.grade}
          </p>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#D8F3E3]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#128C7E] to-[#2563EB]"
          style={{ width: `${score.score}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(score.reasons.length > 0
          ? score.reasons
          : ["More campaign data is needed for a confident score."]
        ).map((reason) => (
          <span
            className="rounded-full bg-[#F2FBF7] px-3 py-1 text-xs font-semibold text-[#526173]"
            key={reason}
          >
            {reason}
          </span>
        ))}
      </div>
    </section>
  );
}

function TimingHeatmap({
  data,
}: {
  data: DashboardAnalytics["timing"]["heatmap"];
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const windows = [
    "Late night",
    "Morning",
    "Midday",
    "Afternoon",
    "Evening",
    "Night",
  ];
  const maxEngagement = Math.max(...data.map((item) => item.engagement), 1);

  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Clock3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">
            Send-time heatmap
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            Engagement by weekday and time window. Darker blocks have more read
            and reply activity.
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[90px_repeat(6,1fr)] gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#526173]">
            <span />
            {windows.map((window) => (
              <span key={window}>{window}</span>
            ))}
          </div>
          <div className="mt-2 space-y-2">
            {days.map((day) => (
              <div
                className="grid grid-cols-[90px_repeat(6,1fr)] items-center gap-2"
                key={day}
              >
                <span className="text-sm font-black text-[#081B3A]">{day}</span>
                {windows.map((window) => {
                  const point = data.find(
                    (item) => item.day === day && item.window === window,
                  );
                  const intensity = point
                    ? Math.max(0.08, point.engagement / maxEngagement)
                    : 0.08;

                  return (
                    <div
                      className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-xs font-semibold text-[#081B3A]"
                      key={`${day}-${window}`}
                      style={{
                        backgroundColor: `rgba(18, 140, 126, ${Math.min(
                          intensity,
                          0.82,
                        )})`,
                        color: intensity > 0.45 ? "white" : "#081B3A",
                      }}
                      title={`${day} ${window}: ${point?.read ?? 0} read, ${
                        point?.replied ?? 0
                      } replied`}
                    >
                      {point?.engagement ?? 0}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecommendationsPanel({
  recommendations,
}: {
  recommendations: DashboardAnalytics["recommendations"];
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-[#128C7E] ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
  };

  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">
            Smart recommendations
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            Practical next moves generated from delivery, engagement, failures,
            and timing data.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {(recommendations.length > 0
          ? recommendations
          : [
              {
                description:
                  "Launch more campaigns to unlock reliable timing, failure, and engagement recommendations.",
                title: "Collect more campaign data",
                tone: "green",
              },
            ]
        ).map((recommendation) => (
          <div
            className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
            key={recommendation.title}
          >
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1",
                tones[recommendation.tone] ?? tones.green,
              )}
            >
              {recommendation.title}
            </span>
            <p className="mt-3 text-sm leading-6 text-[#526173]">
              {recommendation.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DecisionBriefPanel({
  brief,
}: {
  brief: DashboardAnalytics["intelligence"]["decisionBrief"];
}) {
  const verdictClass =
    brief.verdict === "Fix delivery"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : brief.verdict === "Optimize creative"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : brief.verdict === "Scale carefully"
          ? "bg-emerald-50 text-[#128C7E] ring-emerald-200"
          : "bg-blue-50 text-blue-700 ring-blue-100";

  return (
    <section className="rounded-[22px] border border-[#BFE9D0] bg-gradient-to-br from-white via-[#F8FFFB] to-[#EAF7FF] p-5 shadow-[0_20px_55px_rgba(8,27,58,0.08)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-[#081B3A]">
                {brief.title}
              </h2>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold ring-1",
                  verdictClass,
                )}
              >
                {brief.verdict}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              Deterministic campaign intelligence from delivery, engagement,
              conversion, timing, and export signals. Confidence:{" "}
              <span className="font-bold text-[#081B3A]">
                {brief.confidence}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center gap-2 rounded-2xl bg-[#128C7E] px-4 py-2 text-sm font-black text-white shadow-[0_14px_30px_rgba(18,140,126,0.22)] transition hover:-translate-y-0.5"
            href="/dashboard/broadcasts/new"
          >
            Create campaign
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-2xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-black text-[#128C7E] transition hover:-translate-y-0.5 hover:bg-[#F2FBF7]"
            href="/api/reports/campaign-analytics/export"
          >
            Export CSV
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-3">
          {brief.highlights.map((item) => (
            <div
              className="rounded-2xl border border-[#BFE9D0] bg-white/85 p-4 text-sm font-semibold leading-6 text-[#081B3A]"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#BFE9D0] bg-white/85 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#128C7E]">
              Opportunities
            </p>
            <div className="mt-3 space-y-2">
              {brief.opportunities.map((item) => (
                <p className="text-sm leading-6 text-[#526173]" key={item}>
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#BFE9D0] bg-white/85 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-rose-700">
              Risks
            </p>
            <div className="mt-3 space-y-2">
              {(brief.risks.length > 0
                ? brief.risks
                : ["No major risk signal is visible in the selected range."]
              ).map((item) => (
                <p className="text-sm leading-6 text-[#526173]" key={item}>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {brief.nextActions.slice(0, 3).map((action) => (
          <div
            className="rounded-2xl border border-[#BFE9D0] bg-white/90 p-4"
            key={action.title}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-bold text-[#128C7E]">
                {action.owner}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold",
                  action.priority === "High"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-slate-100 text-[#526173]",
                )}
              >
                {action.priority}
              </span>
            </div>
            <p className="mt-3 text-sm font-black text-[#081B3A]">
              {action.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#526173]">
              {action.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExecutiveSummaryPanel({
  summary,
}: {
  summary: DashboardAnalytics["intelligence"]["executiveSummary"];
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">
            Executive campaign summary
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            A readable business summary generated from delivery, engagement,
            revenue, timing, and failure signals.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {summary.map((item) => (
          <div
            className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4 text-sm font-semibold leading-6 text-[#081B3A]"
            key={item}
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function RevenueAttributionPanel({
  attribution,
}: {
  attribution: DashboardAnalytics["intelligence"]["revenueAttribution"];
}) {
  const rows = [
    { label: "Tracked revenue", value: formatMoney(attribution.revenuePaise) },
    { label: "Recorded campaign cost", value: formatMoney(attribution.costPaise) },
    { label: "Net return", value: formatMoney(attribution.netPaise) },
    { label: "ROI", value: formatRate(attribution.roiPercent) },
    {
      label: "Revenue / conversion",
      value: formatMoney(attribution.revenuePerConversionPaise),
    },
    {
      label: "Revenue / reply",
      value: formatMoney(attribution.revenuePerReplyPaise),
    },
    {
      label: "Cost / delivered",
      value: formatMoney(attribution.costPerDeliveredPaise),
    },
    { label: "Cost / read", value: formatMoney(attribution.costPerReadPaise) },
  ];

  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start justify-between gap-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#081B3A]">
              Revenue attribution and ROI
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              Campaign revenue compared with recorded wallet cost and customer
              responses.
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            attribution.roiPercent >= 0
              ? "bg-emerald-50 text-[#128C7E]"
              : "bg-rose-50 text-rose-700",
          )}
        >
          {formatRate(attribution.roiPercent)} ROI
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
            key={row.label}
          >
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#526173]">
              {row.label}
            </p>
            <p className="mt-2 text-xl font-black text-[#081B3A]">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RetargetingPanel({
  cohorts,
}: {
  cohorts: DashboardAnalytics["intelligence"]["retargeting"];
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">
            Retargeting recommendations
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            Cohorts worth following up based on delivery, reads, replies, and
            retry safety.
          </p>
        </div>
      </div>

      {cohorts.length === 0 ? (
        <div className="mt-5 h-40">
          <EmptyChart label="Retargeting cohorts will appear after delivery, read, reply, or failure signals arrive." />
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {cohorts.map((cohort) => (
            <div
              className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
              key={cohort.audience}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#081B3A]">
                    {cohort.audience}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#526173]">
                    {cohort.reason}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black text-[#081B3A]">
                    {cohort.count.toLocaleString("en-IN")}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      cohort.priority === "High"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-[#128C7E]",
                    )}
                  >
                    {cohort.priority}
                  </span>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#128C7E]">
                {cohort.action}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CampaignComparisonMatrixPanel({
  campaigns,
}: {
  campaigns: DashboardAnalytics["intelligence"]["campaignComparison"];
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">
            Campaign comparison matrix
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            Ranked by health score, then ROI and send volume, so teams can see
            what is worth repeating.
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-5 h-40">
          <EmptyChart label="Launch campaigns to compare performance quality." />
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#E7F8EF] text-xs uppercase tracking-[0.08em] text-[#526173]">
              <tr>
                <th className="rounded-l-xl px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Read</th>
                <th className="px-4 py-3">Reply</th>
                <th className="px-4 py-3">ROI</th>
                <th className="rounded-r-xl px-4 py-3">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#BFE9D0]">
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-4 py-4">
                    <p className="font-black text-[#081B3A]">{campaign.name}</p>
                    <p className="text-xs text-[#526173]">
                      {campaign.templateName}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-black text-[#081B3A]">
                    {campaign.healthScore}
                  </td>
                  <td className="px-4 py-4 text-[#526173]">
                    {formatRate(campaign.readRate)}
                  </td>
                  <td className="px-4 py-4 text-[#526173]">
                    {formatRate(campaign.replyRate)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        campaign.roiPercent >= 0
                          ? "bg-emerald-50 text-[#128C7E]"
                          : "bg-rose-50 text-rose-700",
                      )}
                    >
                      {formatRate(campaign.roiPercent)}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#081B3A]">
                    {campaign.sent.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ExperimentReadinessPanel({
  experiments,
}: {
  experiments: DashboardAnalytics["intelligence"]["experiments"];
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">
            A/B testing signals
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            Detected from multiple campaigns using the same approved template.
            This is directional until a dedicated experiment runner is added.
          </p>
        </div>
      </div>

      {experiments.length === 0 ? (
        <div className="mt-5 h-40">
          <EmptyChart label="Run at least two campaigns with the same template to detect A/B-style signals." />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {experiments.map((experiment) => (
            <div
              className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
              key={experiment.templateName}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#081B3A]">
                    {experiment.templateName}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#526173]">
                    Winner: {experiment.winner.name} ·{" "}
                    {experiment.totalSent.toLocaleString("en-IN")} total sent
                  </p>
                </div>
                <span className="w-fit rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-bold text-[#128C7E]">
                  {experiment.confidence} confidence
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-[#526173]">Health lift</p>
                  <p className="mt-1 font-black text-[#081B3A]">
                    {experiment.lift.health}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-[#526173]">Read lift</p>
                  <p className="mt-1 font-black text-[#081B3A]">
                    {formatRate(experiment.lift.readRate)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-[#526173]">Reply lift</p>
                  <p className="mt-1 font-black text-[#081B3A]">
                    {formatRate(experiment.lift.replyRate)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-[#526173]">ROI lift</p>
                  <p className="mt-1 font-black text-[#081B3A]">
                    {formatRate(experiment.lift.roiPercent)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {experiment.variants.map((variant) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
                    key={variant.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#081B3A]">
                        {variant.name}
                      </p>
                      <p className="text-xs text-[#526173]">
                        {variant.sent.toLocaleString("en-IN")} sent ·{" "}
                        {formatRate(variant.readRate)} read ·{" "}
                        {formatRate(variant.replyRate)} reply
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-black text-[#128C7E]">
                      {variant.healthScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ExportReadinessPanel({
  exportReadiness,
}: {
  exportReadiness: DashboardAnalytics["intelligence"]["exportReadiness"];
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#081B3A]">
              Report export readiness
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              Shows which report formats are active from the existing campaign
              report-export model.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-2xl bg-[#128C7E] px-4 py-2 text-sm font-black text-white transition hover:-translate-y-0.5"
            href="/api/reports/campaign-analytics/export"
          >
            Download CSV
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-black text-[#128C7E] transition hover:-translate-y-0.5 hover:bg-[#F2FBF7]"
            href="/dashboard/broadcasts/reports"
          >
            Open reports
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {exportReadiness.formats.map((format) => (
          <div
            className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4"
            key={format.label}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-[#081B3A]">{format.label}</p>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold",
                  format.available
                    ? "bg-emerald-50 text-[#128C7E]"
                    : "bg-slate-100 text-[#526173]",
                )}
              >
                {format.available ? "Active" : "Not active"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#526173]">
              {format.note}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[#081B3A]">
            Scheduled analytics reports
          </p>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              exportReadiness.scheduledReports.available
                ? "bg-emerald-50 text-[#128C7E]"
                : "bg-slate-100 text-[#526173]",
            )}
          >
            {exportReadiness.scheduledReports.available
              ? "Ready"
              : "Future phase"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#526173]">
          {exportReadiness.scheduledReports.note}
        </p>
      </div>
    </section>
  );
}

function PerformanceComparisonPanel({
  description,
  icon: Icon,
  rows,
  title,
}: {
  description: string;
  icon: typeof Send;
  rows: PerformanceRow[];
  title: string;
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            {description}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 h-40">
          <EmptyChart label="No comparison data is available yet." />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#081B3A]">
                    {row.name}
                  </p>
                  <p className="text-xs text-[#526173]">
                    {row.sent.toLocaleString("en-IN")} sent ·{" "}
                    {formatRate(row.readRate)} read ·{" "}
                    {formatRate(row.replyRate)} reply
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-bold text-[#128C7E]">
                  {formatRate(row.deliveryRate)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D8F3E3]">
                <div
                  className="h-full rounded-full bg-[#128C7E]"
                  style={{ width: `${Math.min(row.deliveryRate, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SegmentReadinessPanel({
  segments,
}: {
  segments: DashboardAnalytics["breakdowns"]["segments"];
}) {
  return (
    <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 p-5 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#128C7E]/10 p-3 text-[#128C7E]">
          <UsersRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#081B3A]">
            Audience segment readiness
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526173]">
            Recent saved segments and preview sizes for campaign planning.
          </p>
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="mt-5 h-40">
          <EmptyChart label="Create contact segments to compare audience readiness." />
        </div>
      ) : (
        <div className="mt-5 divide-y divide-[#BFE9D0]">
          {segments.map((segment) => (
            <div
              className="flex items-center justify-between gap-4 py-3"
              key={segment.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#081B3A]">
                  {segment.name}
                </p>
                <p className="text-xs text-[#526173]">
                  {segment.lastPreviewAt
                    ? `Previewed ${new Date(segment.lastPreviewAt).toLocaleDateString("en-IN")}`
                    : "Not previewed yet"}
                </p>
              </div>
              <div className="text-right">
                <StatusPill tone={statusTone(segment.status)}>
                  {segment.status}
                </StatusPill>
                <p className="mt-1 text-xs font-semibold text-[#526173]">
                  {segment.previewCount.toLocaleString("en-IN")} contacts
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdvancedCampaignDashboard({
  analytics,
}: AdvancedCampaignDashboardProps) {
  const hasTrend = analytics.trend.some(
    (point) =>
      point.sent ||
      point.delivered ||
      point.read ||
      point.replied ||
      point.failed,
  );
  const hasEngagement = analytics.engagement.length > 0;
  const hasFunnel = analytics.funnel.some((item) => item.value > 0);
  const hasFailures = analytics.breakdowns.failureReasons.length > 0;
  const hasReplyIntents = analytics.breakdowns.replyIntents.length > 0;
  const hasConversionTypes = analytics.breakdowns.conversionTypes.length > 0;
  const hasHourlyTiming = analytics.timing.hourly.some(
    (item) => item.sent || item.read || item.replied || item.failed,
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          detail={`${analytics.audit.rangeDays} day send volume`}
          icon={Send}
          label="Sent"
          trend={analytics.kpis.sent.trend}
          value={formatNumber(analytics.kpis.sent.value ?? 0)}
        />
        <KpiCard
          detail={`${formatRate(analytics.kpis.delivered.rate)} delivery rate`}
          icon={MailCheck}
          label="Delivered"
          trend={analytics.kpis.delivered.trend}
          value={formatNumber(analytics.kpis.delivered.value ?? 0)}
        />
        <KpiCard
          detail={`${formatRate(analytics.kpis.read.rate)} read rate`}
          icon={MousePointerClick}
          label="Read"
          trend={analytics.kpis.read.trend}
          value={formatNumber(analytics.kpis.read.value ?? 0)}
        />
        <KpiCard
          detail={`${formatRate(analytics.kpis.replied.rate)} reply rate`}
          icon={MessageCircleReply}
          label="Replies"
          trend={analytics.kpis.replied.trend}
          value={formatNumber(analytics.kpis.replied.value ?? 0)}
        />
        <KpiCard
          detail="Tracked conversion events"
          icon={Target}
          label="Conversions"
          trend={analytics.kpis.conversions.trend}
          value={formatNumber(analytics.kpis.conversions.value ?? 0)}
        />
        <KpiCard
          detail="Attributed campaign revenue"
          icon={IndianRupee}
          label="Revenue"
          trend={analytics.kpis.revenue.trend}
          value={formatMoney(analytics.kpis.revenue.valuePaise ?? 0)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ScorePanel
          description="Weighted score using delivery, read, reply, and failure rates."
          icon={ShieldCheck}
          score={analytics.scores.campaignHealth}
          title="Campaign health score"
        />
        <ScorePanel
          description="Audience quality score based on engagement quality and delivery risk."
          icon={UsersRound}
          score={analytics.scores.audienceQuality}
          title="Audience quality score"
        />
      </section>

      <DecisionBriefPanel
        brief={analytics.intelligence.decisionBrief}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <RevenueAttributionPanel
          attribution={analytics.intelligence.revenueAttribution}
        />
        <ExecutiveSummaryPanel
          summary={analytics.intelligence.executiveSummary}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
        <ChartPanel
          description="Hourly send, read, reply, and failed activity for the selected range."
          title="Read and reply time distribution"
        >
          {hasHourlyTiming ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.timing.hourly}>
                <CartesianGrid stroke="#D8F3E3" strokeDasharray="4 4" />
                <XAxis dataKey="label" fontSize={10} stroke="#526173" />
                <YAxis fontSize={11} stroke="#526173" />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #BFE9D0",
                    borderRadius: 14,
                    boxShadow: "0 18px 45px rgba(8,27,58,0.12)",
                  }}
                />
                <Bar
                  dataKey="sent"
                  fill="#2563EB"
                  name="Sent"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="read"
                  fill="#128C7E"
                  name="Read"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="replied"
                  fill="#7C3AED"
                  name="Replied"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  fill="#E11D48"
                  name="Failed"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Timing distribution will appear after campaign events arrive." />
          )}
        </ChartPanel>

        <RecommendationsPanel recommendations={analytics.recommendations} />
      </section>

      <TimingHeatmap data={analytics.timing.heatmap} />

      <RetargetingPanel cohorts={analytics.intelligence.retargeting} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <CampaignComparisonMatrixPanel
          campaigns={analytics.intelligence.campaignComparison}
        />
        <ExportReadinessPanel
          exportReadiness={analytics.intelligence.exportReadiness}
        />
      </section>

      <ExperimentReadinessPanel
        experiments={analytics.intelligence.experiments}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <ChartPanel
          description="Daily sent, delivered, read, replied, and failed movement from message events and reply attribution."
          title="Campaign performance trend"
        >
          {hasTrend ? (
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={analytics.trend}>
                <defs>
                  <linearGradient id="sentGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="readGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#128C7E" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#128C7E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#D8F3E3" strokeDasharray="4 4" />
                <XAxis dataKey="date" fontSize={11} stroke="#526173" />
                <YAxis fontSize={11} stroke="#526173" />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #BFE9D0",
                    borderRadius: 14,
                    boxShadow: "0 18px 45px rgba(8,27,58,0.12)",
                  }}
                />
                <Area
                  dataKey="sent"
                  fill="url(#sentGradient)"
                  name="Sent"
                  stroke="#2563EB"
                  strokeWidth={2}
                  type="monotone"
                />
                <Area
                  dataKey="delivered"
                  fill="transparent"
                  name="Delivered"
                  stroke="#25D366"
                  strokeWidth={2}
                  type="monotone"
                />
                <Area
                  dataKey="read"
                  fill="url(#readGradient)"
                  name="Read"
                  stroke="#128C7E"
                  strokeWidth={2}
                  type="monotone"
                />
                <Area
                  dataKey="replied"
                  fill="transparent"
                  name="Replied"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  type="monotone"
                />
                <Area
                  dataKey="failed"
                  fill="transparent"
                  name="Failed"
                  stroke="#E11D48"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No campaign events are available yet." />
          )}
        </ChartPanel>

        <ChartPanel
          description="Audience distribution by strongest known engagement state."
          title="Engagement mix"
        >
          {hasEngagement ? (
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={analytics.engagement}
                  dataKey="value"
                  innerRadius={70}
                  nameKey="name"
                  outerRadius={105}
                  paddingAngle={2}
                >
                  {analytics.engagement.map((entry, index) => (
                    <Cell
                      fill={engagementColors[index % engagementColors.length]}
                      key={entry.name}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: "1px solid #BFE9D0",
                    borderRadius: 14,
                    boxShadow: "0 18px 45px rgba(8,27,58,0.12)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Engagement will appear after messages are sent." />
          )}
        </ChartPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.45fr)]">
        <ChartPanel
          description="High-level campaign funnel from outbound messages through replies."
          title="Campaign funnel"
        >
          {hasFunnel ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.funnel} layout="vertical">
                <CartesianGrid stroke="#D8F3E3" strokeDasharray="4 4" />
                <XAxis fontSize={11} stroke="#526173" type="number" />
                <YAxis
                  dataKey="name"
                  fontSize={12}
                  stroke="#526173"
                  type="category"
                  width={82}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #BFE9D0",
                    borderRadius: 14,
                    boxShadow: "0 18px 45px rgba(8,27,58,0.12)",
                  }}
                />
                <Bar dataKey="value" fill="#128C7E" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="The funnel is waiting for campaign activity." />
          )}
        </ChartPanel>

        <section className="rounded-[18px] border border-[#BFE9D0] bg-white/90 shadow-[0_18px_45px_rgba(8,27,58,0.06)]">
          <div className="flex flex-col gap-2 border-b border-[#BFE9D0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#081B3A]">
                Top campaign performance
              </h2>
              <p className="mt-1 text-sm text-[#526173]">
                Sorted by newest campaigns with live snapshot metrics.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F2FBF7] px-3 py-1 text-xs font-bold text-[#128C7E]">
              <BarChart3 className="h-3.5 w-3.5" />
              {analytics.audit.phase}
            </div>
          </div>

          {analytics.topCampaigns.length === 0 ? (
            <div className="p-5">
              <EmptyChart label="Create and launch a broadcast to see campaign intelligence." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-[#E7F8EF] text-xs uppercase tracking-[0.08em] text-[#526173]">
                  <tr>
                    <th className="px-5 py-3">Campaign</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Sent</th>
                    <th className="px-5 py-3">Delivered</th>
                    <th className="px-5 py-3">Read</th>
                    <th className="px-5 py-3">Replies</th>
                    <th className="px-5 py-3">Conv.</th>
                    <th className="px-5 py-3">ROI</th>
                    <th className="px-5 py-3">Health</th>
                    <th className="px-5 py-3">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BFE9D0]">
                  {analytics.topCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="align-top">
                      <td className="px-5 py-4">
                        <Link
                          className="font-black text-[#081B3A] hover:text-[#128C7E]"
                          href={`/dashboard/analytics/campaigns/${campaign.id}`}
                        >
                          {campaign.name}
                        </Link>
                        <p className="mt-1 text-xs text-[#526173]">
                          Template: {campaign.templateName}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={statusTone(campaign.status)}>
                          {campaign.status}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#081B3A]">
                        {campaign.sent.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-[#081B3A]">
                          {campaign.delivered.toLocaleString("en-IN")}
                        </span>
                        <p className="text-xs text-[#526173]">
                          {formatRate(campaign.deliveryRate)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-[#081B3A]">
                          {campaign.read.toLocaleString("en-IN")}
                        </span>
                        <p className="text-xs text-[#526173]">
                          {formatRate(campaign.readRate)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-[#081B3A]">
                          {campaign.replied.toLocaleString("en-IN")}
                        </span>
                        <p className="text-xs text-[#526173]">
                          {formatRate(campaign.replyRate)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-[#081B3A]">
                          {campaign.conversionCount.toLocaleString("en-IN")}
                        </span>
                        <p className="text-xs text-[#526173]">
                          {formatMoney(campaign.revenuePaise)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            campaign.roiPercent >= 0
                              ? "bg-emerald-50 text-[#128C7E]"
                              : "bg-rose-50 text-rose-700",
                          )}
                        >
                          {formatRate(campaign.roiPercent)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#081B3A]">
                        {campaign.healthScore}
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#081B3A]">
                        {formatMoney(campaign.costPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          description="Most common failure groups from campaign failure intelligence or recent failed campaign messages."
          title="Failure reasons"
        >
          {hasFailures ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.breakdowns.failureReasons} layout="vertical">
                <CartesianGrid stroke="#F7D1DA" strokeDasharray="4 4" />
                <XAxis fontSize={11} stroke="#526173" type="number" />
                <YAxis
                  dataKey="name"
                  fontSize={11}
                  stroke="#526173"
                  type="category"
                  width={138}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #FECACA",
                    borderRadius: 14,
                    boxShadow: "0 18px 45px rgba(8,27,58,0.12)",
                  }}
                />
                <Bar dataKey="value" fill="#E11D48" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No failure groups have been recorded yet." />
          )}
        </ChartPanel>

        <section className="grid gap-6 md:grid-cols-2">
          <ChartPanel
            description="What customers are saying after campaign messages."
            title="Reply intent mix"
          >
            {hasReplyIntents ? (
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={analytics.breakdowns.replyIntents}
                    dataKey="value"
                    innerRadius={52}
                    nameKey="name"
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {analytics.breakdowns.replyIntents.map((entry, index) => (
                      <Cell
                        fill={engagementColors[index % engagementColors.length]}
                        key={entry.name}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #BFE9D0",
                      borderRadius: 14,
                      boxShadow: "0 18px 45px rgba(8,27,58,0.12)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="Reply intents will appear after replies are attributed." />
            )}
          </ChartPanel>

          <ChartPanel
            description="Conversion event count by tracked type."
            title="Conversion mix"
          >
            {hasConversionTypes ? (
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={analytics.breakdowns.conversionTypes}>
                  <CartesianGrid stroke="#D8F3E3" strokeDasharray="4 4" />
                  <XAxis dataKey="name" fontSize={11} stroke="#526173" />
                  <YAxis fontSize={11} stroke="#526173" />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #BFE9D0",
                      borderRadius: 14,
                      boxShadow: "0 18px 45px rgba(8,27,58,0.12)",
                    }}
                  />
                  <Bar dataKey="value" fill="#2563EB" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No conversion events are tracked for this period." />
            )}
          </ChartPanel>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <PerformanceComparisonPanel
          description="Compare templates by send volume, delivery, read, and reply rates."
          icon={Layers3}
          rows={analytics.breakdowns.templates}
          title="Template comparison"
        />
        <PerformanceComparisonPanel
          description="Spot which languages are getting better engagement."
          icon={Languages}
          rows={analytics.breakdowns.languages}
          title="Language comparison"
        />
        <PerformanceComparisonPanel
          description="Compare Marketing, Utility, and other approved template categories."
          icon={AlertTriangle}
          rows={analytics.breakdowns.categories}
          title="Category comparison"
        />
      </section>

      <SegmentReadinessPanel segments={analytics.breakdowns.segments} />

      <section className="rounded-[18px] border border-[#BFE9D0] bg-[#F2FBF7] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#128C7E]">
          Analytics data audit
        </p>
        <p className="mt-2 text-sm leading-6 text-[#526173]">
          This dashboard currently reads from{" "}
          {analytics.audit.dataSources.join(", ")}. Later analytics phases can
          add audience comparisons, failure reasons, heatmaps, A/B testing, and
          AI summaries on top of the same architecture.
        </p>
      </section>
    </div>
  );
}
