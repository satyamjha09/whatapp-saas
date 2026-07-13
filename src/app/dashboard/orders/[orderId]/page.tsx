import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  canMoveOrderTo,
  getOrderForCompany,
  OrderServiceError,
  serializeOrder,
} from "@/server/services/order.service";
import OrderStatusActions from "./order-status-actions";

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

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

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { orderId } = await params;
  let orderRecord: Awaited<ReturnType<typeof getOrderForCompany>>;

  try {
    orderRecord = await getOrderForCompany(
      context.membership.companyId,
      orderId,
    );
  } catch (error) {
    if (error instanceof OrderServiceError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  const order = serializeOrder(orderRecord);
  const allowedStatuses = canMoveOrderTo(orderRecord);

  return (
    <div>
      <PageHeader
        actions={
          <Link className={actionButtonClass("secondary")} href="/dashboard/orders">
            Back to Orders
          </Link>
        }
        description={`Customer order linked to ${order.contact.name || order.contact.phoneNumber}. Item prices are preserved as snapshots.`}
        eyebrow={context.membership.company.name}
        title={`Order ${order.orderNumber}`}
      />

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#128C7E]">
                  Customer
                </p>
                <h2 className="mt-2 text-xl font-bold text-[#081B3A]">
                  {order.contact.name || "Unnamed customer"}
                </h2>
                <p className="mt-1 text-sm text-[#526173]">
                  +{order.contact.countryCode}
                  {order.contact.phoneNumber}
                  {order.contact.email ? ` - ${order.contact.email}` : ""}
                </p>
              </div>
              <StatusPill tone={statusTone(order.currentStatus)}>
                {labelize(order.currentStatus)}
              </StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-[#E7F8EF] p-4">
                <p className="text-xs text-[#526173]">Source</p>
                <p className="mt-1 font-semibold text-[#081B3A]">
                  {labelize(order.source)}
                </p>
              </div>
              <div className="rounded-xl bg-[#E7F8EF] p-4">
                <p className="text-xs text-[#526173]">Order date</p>
                <p className="mt-1 font-semibold text-[#081B3A]">
                  {formatDate(order.orderDate)}
                </p>
              </div>
              <div className="rounded-xl bg-[#E7F8EF] p-4">
                <p className="text-xs text-[#526173]">External ID</p>
                <p className="mt-1 font-semibold text-[#081B3A]">
                  {order.externalOrderId || "-"}
                </p>
              </div>
              <div className="rounded-xl bg-[#E7F8EF] p-4">
                <p className="text-xs text-[#526173]">Total</p>
                <p className="mt-1 font-semibold text-[#081B3A]">
                  {formatCurrency(order.totalAmount, order.currency)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold text-[#081B3A]">Items</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="border-b border-[#E7F8EF] text-xs uppercase text-[#526173]">
                  <tr>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Retailer ID</th>
                    <th className="px-3 py-3">Qty</th>
                    <th className="px-3 py-3">Unit</th>
                    <th className="px-3 py-3">Tax</th>
                    <th className="px-3 py-3">Discount</th>
                    <th className="px-3 py-3">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7F8EF]">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-4 font-semibold text-[#081B3A]">
                        {item.productNameSnapshot}
                        {item.localProduct ? (
                          <div className="mt-1 text-xs font-normal text-[#526173]">
                            Catalog product linked
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 text-[#526173]">
                        {item.retailerIdSnapshot || "-"}
                      </td>
                      <td className="px-3 py-4 text-[#526173]">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-4 text-[#526173]">
                        {formatCurrency(item.unitPriceAmount, order.currency)}
                      </td>
                      <td className="px-3 py-4 text-[#526173]">
                        {formatCurrency(item.taxAmount, order.currency)}
                      </td>
                      <td className="px-3 py-4 text-[#526173]">
                        {formatCurrency(item.discountAmount, order.currency)}
                      </td>
                      <td className="px-3 py-4 font-semibold text-[#081B3A]">
                        {formatCurrency(item.lineTotalAmount, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <h2 className="text-lg font-bold text-[#081B3A]">Actions</h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              Move the order through controlled statuses. WhatsApp sending is
              intentionally disabled until the next order-status template phase.
            </p>
            <div className="mt-5">
              <OrderStatusActions
                allowedStatuses={allowedStatuses}
                currentStatus={order.currentStatus}
                orderId={order.id}
              />
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold text-[#081B3A]">Totals</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Subtotal", order.subtotalAmount],
                ["Tax", order.taxAmount],
                ["Discount", order.discountAmount],
                ["Shipping", order.shippingAmount],
                ["Total", order.totalAmount],
              ].map(([label, amount]) => (
                <div className="flex justify-between gap-4" key={label}>
                  <dt className="text-[#526173]">{label}</dt>
                  <dd className="font-semibold text-[#081B3A]">
                    {formatCurrency(amount, order.currency)}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold text-[#081B3A]">
              Status Timeline
            </h2>
            <div className="mt-5 space-y-4">
              {order.statusEvents.map((event) => (
                <div
                  className="border-l-2 border-[#BFE9D0] pl-4"
                  key={event.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={statusTone(event.newStatus)}>
                      {labelize(event.newStatus)}
                    </StatusPill>
                    <span className="text-xs text-[#526173]">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#526173]">
                    {event.previousStatus
                      ? `${labelize(event.previousStatus)} -> ${labelize(
                          event.newStatus,
                        )}`
                      : `Initial status: ${labelize(event.newStatus)}`}
                  </p>
                  <p className="mt-1 text-xs text-[#526173]">
                    Source: {labelize(event.source)}
                    {event.changedByUser
                      ? ` - ${event.changedByUser.name || event.changedByUser.email}`
                      : ""}
                  </p>
                  {event.reason || event.note ? (
                    <p className="mt-2 rounded-xl bg-[#E7F8EF] px-3 py-2 text-xs leading-5 text-[#526173]">
                      {[event.reason, event.note].filter(Boolean).join(" - ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
