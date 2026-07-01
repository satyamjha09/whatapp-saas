import { notFound, redirect } from "next/navigation";
import { Info } from "lucide-react";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";
import { StatusPill, statusTone } from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateSection: string }>;
}) {
  const { templateSection } = await params;

  if (templateSection === "match-logs") {
    return <ComingSoonPage title="Template Match Logs" />;
  }

  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const template = await prisma.template.findFirst({
    where: {
      id: templateSection,
      companyId: context.membership.companyId,
    },
  });

  if (!template) notFound();

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#081B3A]">Template Insights</h1>
        <div className="rounded-xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm text-[#081B3A]">
          2026-05-27 22:13:44 <span className="mx-4 text-[#A4AFBC]">-</span>{" "}
          2026-06-27 22:13:44
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_438px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-[#E8EEF6] px-7 py-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#081B3A]">
                {template.name}
                <Info className="h-5 w-5 fill-[#081B3A] text-white" />
              </h2>
              <StatusPill tone={statusTone(template.status)}>{template.status}</StatusPill>
            </div>
            <div className="grid gap-6 px-7 py-9 sm:grid-cols-3">
              {["Messages Sent", "Messages Delivered", "Messages Read"].map((label) => (
                <div key={label}>
                  <p className="text-base text-[#7B8491]">{label}</p>
                  <p className="mt-4 text-3xl text-[#081B3A]">0</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl bg-white">
            <h2 className="border-b border-[#E8EEF6] px-7 py-6 text-lg font-bold text-[#081B3A]">
              Performance Over Time
            </h2>
            <div className="p-8">
              <div className="grid h-80 place-items-end border-l border-b border-dashed border-[#B8C2CF] bg-[linear-gradient(to_right,#D1D5DB_1px,transparent_1px),linear-gradient(to_bottom,#D1D5DB_1px,transparent_1px)] bg-[length:16.66%_25%]">
                <div className="h-px w-full bg-amber-400" />
              </div>
            </div>
          </section>
        </div>

        <aside className="overflow-hidden rounded-xl bg-white xl:self-start">
          <h2 className="border-b border-[#E8EEF6] px-8 py-7 text-xl font-bold text-[#081B3A]">
            Preview
          </h2>
          <div className="min-h-[440px] bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
            <div className="mx-auto mb-3 w-fit rounded-full bg-white px-3 py-2 text-xs text-[#526173] shadow-sm">
              Today
            </div>
            <div className="rounded-lg bg-white p-4 text-sm text-[#081B3A] shadow-sm">
              <p className="whitespace-pre-wrap break-words leading-6">
                {template.body}
              </p>
              <p className="mt-2 text-right text-xs text-[#526173]">10:13 PM</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
