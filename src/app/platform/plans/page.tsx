import Link from "next/link";
import { BILLING_PLANS, formatPlanPrice } from "@/lib/billing-plans";
import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

function moneyLabel(value: number | null | undefined, currency = "INR") {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default async function PlatformPlansPage() {
  await requirePlatformPermission("PLATFORM_PLAN_MANAGE");

  const [priceBooks, activeSubscriptions, planCounts] = await Promise.all([
    prisma.partnerPriceBook.findMany({
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      include: {
        partnerCompany: {
          select: { id: true, name: true, status: true },
        },
        items: {
          orderBy: [{ active: "desc" }, { platformPlanCode: "asc" }],
        },
      },
      take: 25,
    }),
    prisma.partnerClientSubscription.count({
      where: { status: "ACTIVE" },
    }),
    prisma.company.groupBy({
      by: ["billingPlan"],
      _count: { _all: true },
    }),
  ]);

  const companiesByPlan = new Map(
    planCounts.map((item) => [item.billingPlan, item._count._all ?? 0]),
  );
  const activePriceBookCount = priceBooks.filter((book) => book.active).length;
  const activePriceBookItemCount = priceBooks.reduce(
    (total, book) => total + book.items.filter((item) => item.active).length,
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Platform plans
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Plans and partner pricing
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review the core MetaWhat billing plans and partner price-book
              coverage before assigning plans to companies or partner clients.
            </p>
          </div>

          <Link
            href="/platform/partners"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            Manage partner pricing
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Base plans</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {BILLING_PLANS.length}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Active price books</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {activePriceBookCount}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Active price items</p>
          <p className="mt-2 text-3xl font-black text-blue-700">
            {activePriceBookItemCount}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Partner subscriptions
          </p>
          <p className="mt-2 text-3xl font-black text-amber-700">
            {activeSubscriptions}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {BILLING_PLANS.map((plan) => (
          <article
            key={plan.id}
            className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  {plan.id}
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {plan.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {plan.description}
                </p>
              </div>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                {formatPlanPrice(plan.monthlyPricePaise)}
              </span>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <dt className="font-semibold text-emerald-900">Messages</dt>
                <dd className="mt-1 font-black text-emerald-700">
                  {formatNumber(plan.monthlyMessageLimit)}
                </dd>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3">
                <dt className="font-semibold text-blue-900">Bulk max</dt>
                <dd className="mt-1 font-black text-blue-700">
                  {formatNumber(plan.maxBulkRecipients)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="font-semibold text-slate-700">Companies</dt>
                <dd className="mt-1 font-black text-slate-950">
                  {companiesByPlan.get(plan.id) ?? 0}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {plan.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                >
                  {feature}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">
            Partner price books
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest partner wholesale, retail floor, and suggested retail settings.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Partner</th>
                <th className="px-5 py-4">Price book</th>
                <th className="px-5 py-4">Plan items</th>
                <th className="px-5 py-4">Retail floor</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {priceBooks.map((book) => {
                const activeItems = book.items.filter((item) => item.active);
                const lowestFloor = activeItems.reduce<number | null>(
                  (lowest, item) =>
                    lowest === null
                      ? item.minimumRetailPaise
                      : Math.min(lowest, item.minimumRetailPaise),
                  null,
                );

                return (
                  <tr key={book.id} className="align-top">
                    <td className="px-5 py-5">
                      <p className="font-black text-slate-950">
                        {book.partnerCompany.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {book.partnerCompany.status}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <p className="font-semibold text-slate-900">{book.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{book.currency}</p>
                    </td>
                    <td className="px-5 py-5">
                      <p className="font-black text-slate-950">
                        {activeItems.length} active
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {book.items.length} total configured
                      </p>
                    </td>
                    <td className="px-5 py-5 font-semibold text-slate-700">
                      {moneyLabel(lowestFloor, book.currency)}
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          book.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {book.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {priceBooks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No partner price books configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
