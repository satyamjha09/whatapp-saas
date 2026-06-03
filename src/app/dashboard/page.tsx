import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

export default async function DashboardPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { user, membership } = context;

  const cards = [
    {
      title: "WhatsApp Connection",
      description: "Connect and manage your WhatsApp Business account.",
      href: "/dashboard/settings/whatsapp",
    },
    {
      title: "Templates",
      description: "Create reusable WhatsApp message templates.",
      href: "/dashboard/templates",
    },
    {
      title: "Contacts",
      description: "Manage customers and phone numbers.",
      href: "/dashboard/contacts",
    },
    {
      title: "Messages",
      description: "Send template messages and view history.",
      href: "/dashboard/messages",
    },
    {
      title: "Campaigns",
      description: "Create and start bulk message campaigns.",
      href: "/dashboard/campaigns",
    },
    {
      title: "Reports",
      description: "Track message status and delivery performance.",
      href: "/dashboard/reports",
    },
    {
      title: "Wallet",
      description: "Top up balance and view transactions.",
      href: "/dashboard/wallet",
    },
    {
      title: "Billing",
      description: "View spending, refunds, and billing summary.",
      href: "/dashboard/billing",
    },
  ];

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

          <p className="mt-2 text-sm text-gray-600">
            Welcome back, {user.name ?? user.email}. You are managing{" "}
            <span className="font-medium text-gray-900">
              {membership.company.name}
            </span>{" "}
            as{" "}
            <span className="font-medium text-gray-900">
              {membership.role}
            </span>
            .
          </p>
        </section>

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {card.title}
              </h2>

              <p className="mt-2 text-sm text-gray-600">{card.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
