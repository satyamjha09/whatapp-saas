import {
  BarChart3,
  Bot,
  Eye,
  MessageCircle,
  MousePointer2,
  PackageSearch,
  Send,
  ShieldCheck,
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
  WHATSAPP_CATALOG_ANALYTICS_METRICS,
  type WhatsAppCatalogAnalyticsMetricKey,
} from "@/lib/whatsapp-catalog-analytics";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppCatalogAnalytics } from "@/server/services/whatsapp-catalog-analytics.service";
import { whatsAppCatalogAnalyticsQuerySchema } from "@/server/validators/whatsapp-catalog-analytics.validator";

type CatalogAnalyticsPageProps = {
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

function metricLabel(metric: WhatsAppCatalogAnalyticsMetricKey) {
  return WHATSAPP_CATALOG_ANALYTICS_METRICS[metric].label;
}

const metricCards = [
  { icon: Send, key: "sent" },
  { icon: ShieldCheck, key: "delivered" },
  { icon: Eye, key: "read" },
  { icon: MousePointer2, key: "productInteractions" },
  { icon: PackageSearch, key: "uniqueInteractedMessages" },
  { icon: Bot, key: "automationResumed" },
  { icon: BarChart3, key: "productEnquiryRate" },
] as const;

export default async function WhatsAppCatalogAnalyticsPage({
  searchParams,
}: CatalogAnalyticsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const rawFilters = normalizeSearchParams(await searchParams);
  const parsed = whatsAppCatalogAnalyticsQuerySchema.safeParse(rawFilters);
  const filters = parsed.success
    ? parsed.data
    : whatsAppCatalogAnalyticsQuerySchema.parse({});
  const analytics = await getWhatsAppCatalogAnalytics(
    context.membership.companyId,
    filters,
  );

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Link className={actionButtonClass("secondary")} href="/dashboard/catalogs">
              Back to Catalogs
            </Link>
            <Link className={actionButtonClass()} href="/dashboard/templates/new/catalog">
              Create Catalog Template
            </Link>
          </>
        }
        description="Track Catalog template delivery, product replies, orders, automation resumes, and product enquiry rate without exposing customer PII."
        eyebrow={context.membership.company.name}
        title="WhatsApp Catalog Analytics"
      />

      <Panel className="mb-6">
        <PanelTitle
          description={`Showing ${new Date(
            analytics.dateRange.startDate,
          ).toLocaleDateString("en-IN")} to ${new Date(
            analytics.dateRange.endDate,
          ).toLocaleDateString("en-IN")}. Sent metrics use the sent cohort; interaction trend uses webhook time.`}
          title="Filters"
        />

        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
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
            <span className={labelClass}>Catalog</span>
            <select
              className={fieldClass}
              defaultValue={rawFilters.catalogId ?? ""}
              name="catalogId"
            >
              <option value="">All catalogs</option>
              {analytics.catalogOptions.map((catalog) => (
                <option key={catalog.id} value={catalog.id}>
                  {catalog.name}
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
            <span className={labelClass}>Product</span>
            <select
              className={fieldClass}
              defaultValue={rawFilters.productId ?? ""}
              name="productId"
            >
              <option value="">All products</option>
              {analytics.productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.retailerId ? ` (${product.retailerId})` : ""}
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

          <div className="flex items-end gap-3 md:col-span-2 xl:col-span-7">
            <button className={actionButtonClass()} type="submit">
              Apply
            </button>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/whatsapp/catalogs/analytics"
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
            value={
              key === "productEnquiryRate"
                ? formatPercent(analytics.summary[key])
                : formatCount(analytics.summary[key])
            }
          />
        ))}
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelTitle
            description={`${formatCount(
              analytics.summary.uniqueInteractedMessages,
            )} of ${formatCount(analytics.summary.sent)} sent catalog messages received a product reply or order.`}
            title="Sent cohort funnel"
          />
          <div className="mt-5 space-y-3">
            {[
              ["Sent", analytics.summary.sent],
              ["Delivered", analytics.summary.delivered],
              ["Read", analytics.summary.read],
              ["Product interactions", analytics.summary.productInteractions],
              ["Automation resumed", analytics.summary.automationResumed],
              ["Business conversions", analytics.summary.businessConversions],
            ].map(([label, value]) => (
              <div
                className="rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4"
                key={label}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[#081B3A]">{label}</p>
                  <p className="text-lg font-bold text-[#128C7E]">
                    {formatCount(Number(value))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            description="Daily counts use each event's own timestamp."
            title="Activity trend"
          />
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Delivered</th>
                  <th className="px-3 py-2">Read</th>
                  <th className="px-3 py-2">Interactions</th>
                  <th className="px-3 py-2">Automation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {analytics.trend.map((day) => (
                  <tr key={day.date}>
                    <td className="px-3 py-3 font-medium text-[#081B3A]">
                      {day.date}
                    </td>
                    <td className="px-3 py-3 text-[#526173]">{day.sent}</td>
                    <td className="px-3 py-3 text-[#526173]">
                      {day.delivered}
                    </td>
                    <td className="px-3 py-3 text-[#526173]">{day.read}</td>
                    <td className="px-3 py-3 text-[#526173]">
                      {day.productInteractions}
                    </td>
                    <td className="px-3 py-3 text-[#526173]">
                      {day.automationResumed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel>
          <PanelTitle
            description="Catalogs ranked by product interactions first, then sends."
            title="Top catalogs"
          />
          <div className="mt-5 space-y-3">
            {analytics.topCatalogs.length === 0 ? (
              <p className="text-sm text-[#526173]">No catalog activity yet.</p>
            ) : (
              analytics.topCatalogs.map((catalog) => (
                <div
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4"
                  key={catalog.catalogId}
                >
                  <p className="font-bold text-[#081B3A]">{catalog.name}</p>
                  <p className="mt-1 text-xs text-[#526173]">
                    {formatCount(catalog.sent)} sent -{" "}
                    {formatCount(catalog.interactions)} interactions
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            description="Products customers selected or ordered from catalog messages."
            title="Top products"
          />
          <div className="mt-5 space-y-3">
            {analytics.topProducts.length === 0 ? (
              <p className="text-sm text-[#526173]">No product interactions yet.</p>
            ) : (
              analytics.topProducts.map((product) => (
                <div
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4"
                  key={product.localProductId ?? product.retailerId ?? product.name}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-[#081B3A]">{product.name}</p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {product.retailerId ?? "No retailer ID"} -{" "}
                        {formatCount(product.count)} interactions -{" "}
                        {formatCount(product.orderCount)} orders
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
            description="Catalog template volume for the selected sent cohort."
            title="Top templates"
          />
          <div className="mt-5 space-y-3">
            {analytics.topTemplates.length === 0 ? (
              <p className="text-sm text-[#526173]">
                No catalog template sends in this range.
              </p>
            ) : (
              analytics.topTemplates.map((template) => (
                <div
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4"
                  key={template.templateId}
                >
                  <p className="font-bold text-[#081B3A]">{template.name}</p>
                  <p className="mt-1 text-xs text-[#526173]">
                    {template.language} - {formatCount(template.sent)} sent
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
