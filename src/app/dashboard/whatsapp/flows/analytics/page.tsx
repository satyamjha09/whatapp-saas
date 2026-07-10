import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  MessageCircle,
  MousePointer2,
  Send,
  ShieldCheck,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import {
  WHATSAPP_FLOW_ANALYTICS_METRICS,
  type WhatsAppFlowAnalyticsMetricKey,
} from "@/lib/whatsapp-flow-analytics";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppFlowAnalytics } from "@/server/services/whatsapp-flow-analytics.service";
import { whatsAppFlowAnalyticsQuerySchema } from "@/server/validators/whatsapp-flow-analytics.validator";

type WhatsAppFlowAnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchParams(
  params: Record<string, string | string[] | undefined> | undefined,
) {
  return Object.fromEntries(
    Object.entries(params ?? {})
      .map(([key, value]) => [key, firstValue(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function dateInputValue(value: string | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function metricLabel(metric: WhatsAppFlowAnalyticsMetricKey) {
  return WHATSAPP_FLOW_ANALYTICS_METRICS[metric].label;
}

const metricCards = [
  { icon: Send, key: "sent" },
  { icon: ShieldCheck, key: "delivered" },
  { icon: Eye, key: "read" },
  { icon: CheckCircle2, key: "completed" },
  { icon: Workflow, key: "processed" },
  { icon: Clock3, key: "automationResumed" },
  { icon: MousePointer2, key: "businessConverted" },
  { icon: TriangleAlert, key: "failed" },
] as const;

export default async function WhatsAppFlowAnalyticsPage({
  searchParams,
}: WhatsAppFlowAnalyticsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const rawFilters = normalizeSearchParams(await searchParams);
  const parsed = whatsAppFlowAnalyticsQuerySchema.safeParse(rawFilters);
  const filters = parsed.success
    ? parsed.data
    : whatsAppFlowAnalyticsQuerySchema.parse({});
  const analytics = await getWhatsAppFlowAnalytics(
    context.membership.companyId,
    filters,
  );

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/whatsapp/flows"
            >
              Back to Flows
            </Link>
            <Link
              className={actionButtonClass()}
              href="/dashboard/templates/new/flow"
            >
              Create Flow Template
            </Link>
          </>
        }
        description="Measure Flow delivery, read, completion, response processing, automation resume, and explicit business conversion."
        eyebrow={context.membership.company.name}
        title="WhatsApp Flow Analytics"
      />

      <Panel className="mb-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <PanelTitle
            description={`Showing ${new Date(
              analytics.dateRange.startDate,
            ).toLocaleDateString("en-IN")} to ${new Date(
              analytics.dateRange.endDate,
            ).toLocaleDateString("en-IN")}. Funnel uses interactions sent in this period.`}
            title="Filters"
          />
        </div>

        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label>
            <span className={labelClass}>Range</span>
            <select
              className={fieldClass}
              defaultValue={rawFilters.range ?? "30d"}
              name="range"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label>
            <span className={labelClass}>Flow asset</span>
            <select
              className={fieldClass}
              defaultValue={rawFilters.flowAssetId ?? ""}
              name="flowAssetId"
            >
              <option value="">All flows</option>
              {analytics.flowOptions.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>Template</span>
            <select
              className={fieldClass}
              defaultValue={rawFilters.templateId ?? ""}
              name="templateId"
            >
              <option value="">All templates</option>
              {analytics.templateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.language})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>Source</span>
            <select
              className={fieldClass}
              defaultValue={rawFilters.source ?? "ALL"}
              name="source"
            >
              <option value="ALL">All</option>
              <option value="MANUAL">Manual</option>
              <option value="AUTOMATION">Automation</option>
            </select>
          </label>

          <label>
            <span className={labelClass}>From</span>
            <input
              className={fieldClass}
              defaultValue={dateInputValue(rawFilters.startDate)}
              name="startDate"
              type="date"
            />
          </label>

          <label>
            <span className={labelClass}>To</span>
            <input
              className={fieldClass}
              defaultValue={dateInputValue(rawFilters.endDate)}
              name="endDate"
              type="date"
            />
          </label>

          <div className="flex items-end gap-3 md:col-span-2 xl:col-span-6">
            <button className={actionButtonClass()} type="submit">
              Apply
            </button>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/whatsapp/flows/analytics"
            >
              Reset
            </Link>
          </div>
        </form>
      </Panel>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ icon, key }) => (
          <MetricCard
            detail={analytics.metricDefinitions[key].description}
            icon={icon}
            key={key}
            label={metricLabel(key)}
            value={formatCount(analytics.summary[key])}
          />
        ))}
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelTitle
            description={`Completed ${formatCount(
              analytics.summary.completed,
            )} of ${formatCount(analytics.summary.sent)} sent (${formatPercent(
              analytics.summary.completionRate,
            )}).`}
            title="Sent cohort funnel"
          />
          <div className="mt-5 space-y-3">
            {analytics.funnel.map((stage) => (
              <div
                className="rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4"
                key={stage.metric}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#081B3A]">
                      {metricLabel(stage.metric as WhatsAppFlowAnalyticsMetricKey)}
                    </p>
                    <p className="mt-1 text-xs text-[#526173]">
                      From sent: {formatPercent(stage.rateFromSent)}
                      {stage.rateFromPrevious === null
                        ? ""
                        : ` - Previous stage: ${formatPercent(
                            stage.rateFromPrevious,
                          )}`}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-[#128C7E]">
                    {formatCount(stage.count)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            description="Daily trend counts events by their own timestamps, not by the sent cohort."
            title="Activity trend"
          />
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Read</th>
                  <th className="px-3 py-2">Completed</th>
                  <th className="px-3 py-2">Converted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {analytics.trend.map((day) => (
                  <tr key={day.date}>
                    <td className="px-3 py-3 font-medium text-[#081B3A]">
                      {day.date}
                    </td>
                    <td className="px-3 py-3 text-[#526173]">{day.sent}</td>
                    <td className="px-3 py-3 text-[#526173]">{day.read}</td>
                    <td className="px-3 py-3 text-[#526173]">
                      {day.completed}
                    </td>
                    <td className="px-3 py-3 text-[#526173]">
                      {day.businessConverted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            description="Flow performance for the selected sent cohort."
            title="Top Flow assets"
          />
          <div className="mt-5 space-y-3">
            {analytics.topFlows.length === 0 ? (
              <p className="text-sm text-[#526173]">No Flow sends in this range.</p>
            ) : (
              analytics.topFlows.map((flow) => (
                <div
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4"
                  key={flow.flowId}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-[#081B3A]">{flow.name}</p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {formatCount(flow.sent)} sent - {formatPercent(
                          flow.completionRate,
                        )} completed - {formatPercent(
                          flow.businessConversionRate,
                        )} business converted
                      </p>
                    </div>
                    <MessageCircle className="h-5 w-5 shrink-0 text-[#128C7E]" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            description="Template performance for Flow messages in the selected sent cohort."
            title="Top Flow templates"
          />
          <div className="mt-5 space-y-3">
            {analytics.topTemplates.length === 0 ? (
              <p className="text-sm text-[#526173]">
                No Flow template sends in this range.
              </p>
            ) : (
              analytics.topTemplates.map((template) => (
                <div
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4"
                  key={template.templateId}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-[#081B3A]">{template.name}</p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {template.language} - {template.category} -{" "}
                        {formatCount(template.sent)} sent -{" "}
                        {formatPercent(template.completionRate)} completed
                      </p>
                    </div>
                    <BarChart3 className="h-5 w-5 shrink-0 text-[#128C7E]" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
