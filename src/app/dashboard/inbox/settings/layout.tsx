import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "/dashboard/inbox/settings/queues", label: "Queues" },
  { href: "/dashboard/inbox/settings/routing", label: "Routing" },
  { href: "/dashboard/inbox/settings/agents", label: "Agents" },
  { href: "/dashboard/inbox/settings/skills", label: "Skills" },
  { href: "/dashboard/inbox/settings/sla", label: "SLA" },
  { href: "/dashboard/inbox/settings/csat", label: "CSAT" },
  { href: "/dashboard/inbox/settings/business-hours", label: "Business hours" },
  { href: "/dashboard/inbox/settings/escalations", label: "Escalations" },
];

export default function InboxSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-[#BFE9D0] bg-white/90 p-8 shadow-[0_24px_70px_rgba(18,140,126,0.08)]">
        <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#128C7E]">
          Multi-agent inbox
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-[#081B3A]">Inbox settings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
              Configure queues, agent capacity, and support skills before enabling
              advanced assignment automation.
            </p>
          </div>
          <Link
            href="/dashboard/inbox"
            className="rounded-xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-bold text-[#128C7E] transition hover:bg-[#E7F8EF]"
          >
            Back to Inbox
          </Link>
        </div>
        <nav className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-full border border-[#BFE9D0] bg-[#F7FFFA] px-4 py-2 text-sm font-bold text-[#075E54] transition hover:border-[#128C7E]/50 hover:bg-[#E7F8EF]"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </section>
      {children}
    </div>
  );
}
