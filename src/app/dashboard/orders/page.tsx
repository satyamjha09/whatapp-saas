import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, Plus, Search } from "lucide-react";
import {
  actionButtonClass,
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listOrdersForCompany } from "@/server/services/order.service";
import {
  listOrdersQuerySchema,
  ORDER_SOURCES,
  ORDER_STATUSES,
} from "@/server/validators/order.validator";

type OrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(amount: string, currency: string) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${currency} ${amount}`;

  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(numeric);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildPageHref(
  filters: Record<string, string>,
  page: number,
) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("page", String(page));

  return `/dashboard/orders?${params.toString()}`;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const params = await searchParams;
  const rawFilters = {
    contactId: firstQueryValue(params?.contactId).trim(),
    dateFrom: firstQueryValue(params?.dateFrom).trim(),
    dateTo: firstQueryValue(params?.dateTo).trim(),
    page: firstQueryValue(params?.page).trim() || "1",
    pageSize: firstQueryValue(params?.pageSize).trim() || "20",
    search: firstQueryValue(params?.search).trim(),
    source: firstQueryValue(params?.source).trim(),
    status: firstQueryValue(params?.status).trim(),
  };
  const parsedFilters = listOrdersQuerySchema.parse(rawFilters);

  const [ordersResult, contacts] = await Promise.all([
    listOrdersForCompany(context.membership.companyId, parsedFilters),
    prisma.contact.findMany({
      where: { companyId: context.membership.companyId },
      orderBy: [{ name: "asc" }, { phoneNumber: "asc" }],
      select: {
        id: true,
        name: true,
        phoneNumber: true,
      },
      take: 200,
    }),
  ]);

  const canManage =
    context.membership.role === "OWNER" || context.membership.role === "ADMIN";

  return (
    <div>
      <PageHeader
        actions={
          canManage ? (
            <>
              <Link className={actionButtonClass("secondary")} href="/dashboard/orders/tally">
                <Database className="mr-2 h-4 w-4" />
                Tally Sync
              </Link>
              <Link className={actionButtonClass("primary")} href="/dashboard/orders/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Order
              </Link>
            </>
          ) : null
        }
        description="Track customer orders, item snapshots, totals, current status, and every status change before WhatsApp order updates are connected."
        eyebrow={context.membership.company.name}
        title="Orders"
      />

      <Panel>
        <form className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.8fr_0.8fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
            <input
              className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white pl-10 pr-3 text-sm text-[#081B3A] outline-none focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10"
              defaultValue={rawFilters.search}
              name="search"
              placeholder="Order, customer, phone"
            />
          </label>
          <select
            className="h-11 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue={rawFilters.status}
            name="status"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelize(status)}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue={rawFilters.source}
            name="source"
          >
            <option value="">All sources</option>
            {ORDER_SOURCES.map((source) => (
              <option key={source} value={source}>
                {labelize(source)}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue={rawFilters.contactId}
            name="contactId"
          >
            <option value="">All customers</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name || contact.phoneNumber}
              </option>
            ))}
          </select>
          <input
            className="h-11 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue={rawFilters.dateFrom}
            name="dateFrom"
            type="date"
          />
          <input
            className="h-11 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue={rawFilters.dateTo}
            name="dateTo"
            type="date"
          />
          <button className={actionButtonClass("secondary")} type="submit">
            Filter
          </button>
        </form>
      </Panel>

      <Panel className="mt-5 overflow-hidden">
        {ordersResult.orders.length === 0 ? (
          <EmptyState>
            No orders found yet. Create a manual order or import orders later from
            Tally/API/Catalog sources.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-3 py-3">Order</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Items</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Order date</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7F8EF]">
                {ordersResult.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-4 font-semibold text-[#081B3A]">
                      {order.orderNumber}
                      {order.externalOrderId ? (
                        <div className="mt-1 text-xs font-normal text-[#526173]">
                          {order.externalOrderId}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-[#081B3A]">
                      {order.contact.name || "Unnamed customer"}
                      <div className="mt-1 text-xs text-[#526173]">
                        +{order.contact.countryCode}
                        {order.contact.phoneNumber}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-[#526173]">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-3 py-4 font-semibold text-[#081B3A]">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill tone={statusTone(order.currentStatus)}>
                        {labelize(order.currentStatus)}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-4 text-[#526173]">
                      {labelize(order.source)}
                    </td>
                    <td className="px-3 py-4 text-[#526173]">
                      {formatDate(order.orderDate)}
                    </td>
                    <td className="px-3 py-4 text-[#526173]">
                      {formatDate(order.updatedAt)}
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        className={actionButtonClass("secondary")}
                        href={`/dashboard/orders/${order.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-sm text-[#526173]">
          <span>
            Page {ordersResult.pagination.page} of{" "}
            {ordersResult.pagination.totalPages} ·{" "}
            {ordersResult.pagination.total.toLocaleString("en-IN")} orders
          </span>
          <div className="flex gap-2">
            {ordersResult.pagination.page > 1 ? (
              <Link
                className={actionButtonClass("secondary")}
                href={buildPageHref(rawFilters, ordersResult.pagination.page - 1)}
              >
                Previous
              </Link>
            ) : null}
            {ordersResult.pagination.page < ordersResult.pagination.totalPages ? (
              <Link
                className={actionButtonClass("secondary")}
                href={buildPageHref(rawFilters, ordersResult.pagination.page + 1)}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}

