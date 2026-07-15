import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

function actionSummary(actions: unknown) {
  if (!actions || typeof actions !== "object") return "No actions configured";
  const items = Array.isArray(actions)
    ? actions
    : Array.isArray((actions as { actions?: unknown }).actions)
      ? (actions as { actions: unknown[] }).actions
      : [];

  if (items.length === 0) return "No actions configured";

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return (item as { type?: string }).type?.replaceAll("_", " ");
    })
    .filter(Boolean)
    .join(", ");
}

export default async function InboxEscalationsSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const rules = await prisma.inboxEscalationRule.findMany({
    where: { companyId: context.membership.companyId },
    include: {
      queue: { select: { id: true, name: true } },
    },
    orderBy: [{ active: "desc" }, { triggerType: "asc" }, { createdAt: "asc" }],
  });

  return (
    <section className="rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#128C7E]">
        Escalations
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#081B3A]">
        SLA automation rules
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
        Rules react to due-soon and breached timers. Actions can notify teams,
        raise priority, reassign queues, or hand work to another agent.
      </p>

      {rules.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FFFA] p-8 text-center">
          <h3 className="text-lg font-black text-[#081B3A]">
            No escalation rules yet
          </h3>
          <p className="mt-2 text-sm text-[#526173]">
            Due-soon and breach notifications are still emitted once per timer.
            Add rules later to automate priority raises or reassignment.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {rules.map((rule) => (
            <article
              key={rule.id}
              className="rounded-2xl border border-[#E0F3E8] bg-[#F7FFFA] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[#081B3A]">{rule.name}</h3>
                  <p className="mt-1 text-sm text-[#526173]">
                    {rule.queue?.name ?? "All queues"} ·{" "}
                    {rule.priority ?? "All priorities"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#128C7E]">
                  {rule.active ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#526173]">
                    Trigger
                  </p>
                  <p className="font-bold text-[#081B3A]">
                    {rule.triggerType.replaceAll("_", " ")} · value{" "}
                    {rule.triggerValue}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#526173]">
                    Actions
                  </p>
                  <p className="font-bold text-[#081B3A]">
                    {actionSummary(rule.actions)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
