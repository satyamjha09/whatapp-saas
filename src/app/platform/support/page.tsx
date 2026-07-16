import { PartnerSupportPanel } from "@/components/partner-support-panel";
import { listPlatformPartnerSupportTickets } from "@/server/services/partner-support.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

export default async function PlatformSupportPage() {
  await requirePlatformPermission("PLATFORM_SUPPORT_VIEW");
  const tickets = await listPlatformPartnerSupportTickets();
  const openTickets = tickets.filter(
    (ticket) => ticket.status !== "CLOSED" && ticket.status !== "RESOLVED",
  );
  const urgentTickets = tickets.filter((ticket) => ticket.priority === "URGENT");

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Platform Admin</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Partner Support
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage partner support tickets, SLA timers, comments, assignment,
            escalation, and client-impacting platform handoffs.
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total tickets</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {tickets.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Open</p>
          <p className="mt-2 text-2xl font-black text-blue-700">
            {openTickets.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Urgent</p>
          <p className="mt-2 text-2xl font-black text-red-700">
            {urgentTickets.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Resolved</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {
              tickets.filter(
                (ticket) =>
                  ticket.status === "RESOLVED" || ticket.status === "CLOSED",
              ).length
            }
          </p>
        </div>
      </section>

      <section className="mt-6">
        <PartnerSupportPanel mode="platform" initialTickets={tickets} />
      </section>
    </main>
  );
}
