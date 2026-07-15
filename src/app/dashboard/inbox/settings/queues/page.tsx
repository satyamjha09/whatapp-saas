import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listInboxQueues } from "@/server/services/inbox-queue.service";
import QueueForm from "./queue-form";
import QueueMembersTable from "./queue-members-table";

export default async function InboxQueuesSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const [queues, memberships] = await Promise.all([
    listInboxQueues(companyId),
    prisma.companyUser.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);
  const users = memberships.map((membership) => membership.user);

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <QueueForm />
      <section className="space-y-4">
        {queues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#BFE9D0] bg-white/80 p-8 text-center">
            <h2 className="text-xl font-black text-[#081B3A]">No inbox queues yet</h2>
            <p className="mt-2 text-sm text-[#526173]">
              Create a queue for teams like Sales, Support, Billing, or Escalations.
            </p>
          </div>
        ) : (
          queues.map((queue) => (
            <article
              key={queue.id}
              className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_50px_rgba(18,140,126,0.06)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: queue.color ?? "#128C7E" }}
                    />
                    <h2 className="text-xl font-black text-[#081B3A]">{queue.name}</h2>
                    <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-bold text-[#128C7E]">
                      {queue.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#526173]">
                    {queue.description || "No description added."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#526173]">
                    <span className="rounded-full bg-[#F7FFFA] px-2.5 py-1">
                      {queue.assignmentMode.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-[#F7FFFA] px-2.5 py-1">
                      {queue._count.contacts} conversation(s)
                    </span>
                    {queue.maxOpenPerAgent ? (
                      <span className="rounded-full bg-[#F7FFFA] px-2.5 py-1">
                        Max {queue.maxOpenPerAgent}/agent
                      </span>
                    ) : null}
                    {queue.approvalRequired ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                        Approval required
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <QueueMembersTable
                queueId={queue.id}
                members={queue.members}
                users={users}
              />
            </article>
          ))
        )}
      </section>
    </div>
  );
}
