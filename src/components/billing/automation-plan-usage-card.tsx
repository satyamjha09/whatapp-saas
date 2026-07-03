"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Workflow, PlayCircle, TestTube2, ArrowRight } from "lucide-react";

type UsageData = {
  period: {
    start: string;
    end: string;
  };
  usage: {
    flowsUsed: number;
    publishedFlowsUsed: number;
    executionsUsed: number;
    testRunsUsed: number;
  };
  limits: {
    flows: number | null;
    publishedFlows: number | null;
    executions: number | null;
    testRuns: number | null;
  };
  percentages: {
    flows: number | null;
    publishedFlows: number | null;
    executions: number | null;
    testRuns: number | null;
  };
};

export default function AutomationPlanUsageCard() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch("/api/automation/usage");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load automation usage:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-[#D8E6F3] animate-pulse space-y-4">
        <div className="h-5 w-48 bg-slate-200 rounded" />
        <div className="h-12 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  const renderBar = (used: number, max: number | null, label: string, icon: React.ReactNode) => {
    const maxText = max === null ? "Unlimited" : max;
    const pct = max === null || max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
    const isHigh = pct >= 80;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-[#081B3A]">
            {icon}
            <span>{label}</span>
          </div>
          <span className={isHigh ? "text-amber-700 font-bold" : "text-slate-600"}>
            {used} / {maxText}
          </span>
        </div>

        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isHigh ? "bg-amber-500" : "bg-[#0052CC]"
            }`}
            style={{ width: `${max === null ? Math.min(100, used) : pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-[#D8E6F3] space-y-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#081B3A]">Automation Usage Quotas</h3>
          <p className="text-[11px] text-slate-500">
            Billing Cycle: {new Date(data.period.start).toLocaleDateString()} – {new Date(data.period.end).toLocaleDateString()}
          </p>
        </div>

        <Link
          href="/dashboard/billing/upgrade"
          className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1"
        >
          <span>Upgrade Limits</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {renderBar(
          data.usage.flowsUsed,
          data.limits.flows,
          "Created Automations",
          <Workflow className="h-4 w-4 text-[#0052CC]" />
        )}
        {renderBar(
          data.usage.executionsUsed,
          data.limits.executions,
          "Monthly Executions",
          <PlayCircle className="h-4 w-4 text-[#128C7E]" />
        )}
        {renderBar(
          data.usage.testRunsUsed,
          data.limits.testRuns,
          "Live Test Runs",
          <TestTube2 className="h-4 w-4 text-purple-600" />
        )}
      </div>
    </div>
  );
}
