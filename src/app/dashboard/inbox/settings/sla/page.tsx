import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listInboxSlaPolicies } from "@/server/services/inbox-sla-policy.service";

function minutesLabel(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

export default async function InboxSlaSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const policies = await listInboxSlaPolicies(context.membership.companyId);

  return (
    <section className="rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#128C7E]">
            SLA policies
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#081B3A]">
            Queue response timers
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
            First response, next response, and resolution deadlines are now
            calculated per queue and priority. If no custom policy exists, MetaWhat
            creates a safe default automatically.
          </p>
        </div>
      </div>

      {policies.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FFFA] p-8 text-center">
          <h3 className="text-lg font-black text-[#081B3A]">
            Default SLA policy is active
          </h3>
          <p className="mt-2 text-sm text-[#526173]">
            Conversations use priority-based defaults until you add queue-specific
            rules.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#E0F3E8]">
          <table className="min-w-full divide-y divide-[#E0F3E8] text-sm">
            <thead className="bg-[#F7FFFA] text-left text-xs font-black uppercase tracking-[0.06em] text-[#526173]">
              <tr>
                <th className="px-4 py-3">Queue</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">First response</th>
                <th className="px-4 py-3">Next response</th>
                <th className="px-4 py-3">Resolution</th>
                <th className="px-4 py-3">Due soon</th>
                <th className="px-4 py-3">Snooze</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0F3E8] bg-white">
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td className="px-4 py-4 font-bold text-[#081B3A]">
                    {policy.queue?.name ?? "Company default"}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-bold text-[#128C7E]">
                      {policy.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[#526173]">
                    {minutesLabel(policy.firstResponseMinutes)}
                  </td>
                  <td className="px-4 py-4 text-[#526173]">
                    {minutesLabel(policy.nextResponseMinutes)}
                  </td>
                  <td className="px-4 py-4 text-[#526173]">
                    {minutesLabel(policy.resolutionMinutes)}
                  </td>
                  <td className="px-4 py-4 text-[#526173]">
                    {minutesLabel(policy.dueSoonMinutes)}
                  </td>
                  <td className="px-4 py-4 text-[#526173]">
                    {policy.pauseWhileSnoozed ? "Pauses SLA" : "Keeps running"}
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
