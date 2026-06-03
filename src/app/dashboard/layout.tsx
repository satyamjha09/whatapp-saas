import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

const navigationItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    label: "WhatsApp",
    href: "/dashboard/settings/whatsapp",
  },
  {
    label: "Templates",
    href: "/dashboard/templates",
  },
  {
    label: "Contacts",
    href: "/dashboard/contacts",
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
  },
  {
    label: "Inbox",
    href: "/dashboard/inbox",
  },
  {
    label: "Campaigns",
    href: "/dashboard/campaigns",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
  },
  {
    label: "Wallet",
    href: "/dashboard/wallet",
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
  },
  {
    label: "Settings",
    href: "/dashboard/settings/company",
  },
  {
    label: "Team",
    href: "/dashboard/settings/team",
  },
  {
    label: "Audit Logs",
    href: "/dashboard/settings/audit-logs",
  },
  {
    label: "API Keys",
    href: "/dashboard/developer/api-keys",
  },
  {
    label: "API Docs",
    href: "/dashboard/developer/docs",
  },
  {
    label: "Webhooks",
    href: "/dashboard/developer/webhooks",
  },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r bg-white p-6 lg:block">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Workspace
          </p>

          <h2 className="mt-2 truncate text-xl font-bold text-gray-900">
            {context.membership.company.name}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Role: {context.membership.role}
          </p>
        </div>

        <nav className="mt-8 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {context.membership.company.name}
              </p>

              <p className="text-xs text-gray-500">
                Welcome, {context.user.name ?? context.user.email}
              </p>
            </div>

            <UserButton />
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
