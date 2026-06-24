import { listCompanyPlanChanges } from "@/server/services/plan-upgrade.service";

export async function PlanHistory({ companyId }: { companyId: string }) {
  const changes = await listCompanyPlanChanges({
    companyId,
  });

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-gray-50 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Plan Change History
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">From</th>
              <th className="px-5 py-3">To</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Messages</th>
              <th className="px-5 py-3">Changed By</th>
              <th className="px-5 py-3">Date</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {changes.map((change) => (
              <tr key={change.id}>
                <td className="px-5 py-4">{change.fromPlan}</td>
                <td className="px-5 py-4 font-semibold text-gray-900">
                  {change.toPlan}
                </td>
                <td className="px-5 py-4">{change.source}</td>
                <td className="px-5 py-4">
                  {change.previousMonthlyMessageLimit ?? "-"} {"->"}{" "}
                  {change.newMonthlyMessageLimit ?? "-"}
                </td>
                <td className="px-5 py-4">{change.actor?.email ?? "-"}</td>
                <td className="px-5 py-4">
                  {change.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}

            {changes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                  No plan changes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
