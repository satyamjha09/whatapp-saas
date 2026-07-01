import {
  Building2,
  CalendarDays,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import ProfileForm from "./profile-form";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function userInitial(name: string | null, email: string) {
  return (name?.trim().charAt(0) || email.trim().charAt(0) || "U").toUpperCase();
}

export default async function ProfilePage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const user = context.user;
  const membership = context.membership;
  const displayName = user.name ?? "Unnamed user";

  return (
    <div>
      <PageHeader
        eyebrow={membership.company.name}
        title="Profile"
        description="Manage your personal details, workspace access, and account security information."
        actions={
          <>
            <Link
              href="/dashboard/settings/team"
              className={actionButtonClass("secondary")}
            >
              <UserRound className="mr-2 h-4 w-4" />
              Team
            </Link>
            <Link
              href="/dashboard/settings/company"
              className={actionButtonClass("secondary")}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Company
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <Mail className="h-5 w-5 text-[#128C7E]" />
          <p className="mt-4 text-sm text-[#526173]">Email</p>
          <p className="mt-1 truncate text-sm font-bold text-[#081B3A]">
            {user.email}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <Phone className="h-5 w-5 text-[#128C7E]" />
          <p className="mt-4 text-sm text-[#526173]">Mobile</p>
          <p className="mt-1 truncate text-sm font-bold text-[#081B3A]">
            {user.mobile || "Not added"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <ShieldCheck className="h-5 w-5 text-[#22C55E]" />
          <p className="mt-4 text-sm text-[#526173]">Workspace Role</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {membership.role}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <CalendarDays className="h-5 w-5 text-[#075E54]" />
          <p className="mt-4 text-sm text-[#526173]">Joined</p>
          <p className="mt-1 text-sm font-bold text-[#081B3A]">
            {formatDate(user.createdAt)}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#128C7E] text-2xl font-bold text-white">
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                userInitial(user.name, user.email)
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-[#081B3A]">
                {displayName}
              </h2>
              <p className="mt-1 truncate text-sm text-[#526173]">
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone={statusTone(membership.company.status)}>
                  {membership.company.status.replaceAll("_", " ")}
                </StatusPill>
                <StatusPill tone={statusTone(membership.company.subscriptionStatus)}>
                  {membership.company.subscriptionStatus.replaceAll("_", " ")}
                </StatusPill>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Company
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {membership.company.name}
              </p>
            </div>
            <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Plan
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {membership.company.billingPlan}
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Personal Details"
            description="Update the name and mobile number shown inside this workspace."
          />
          <div className="mt-6">
            <ProfileForm
              initialName={user.name ?? ""}
              initialMobile={user.mobile ?? ""}
            />
          </div>
        </Panel>
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Login & Security"
            description="Authentication is managed by Clerk. Use Clerk account controls for password, email verification, and two-factor authentication."
          />
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
              <KeyRound className="h-5 w-5 text-[#128C7E]" />
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Password and 2FA
                </p>
                <p className="mt-1 text-sm text-[#526173]">
                  Managed by the sign-in provider for this account.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Account Activity"
            description="Key timestamps for this local workspace profile."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#BFE9D0] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Created
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {formatDate(user.createdAt)}
              </p>
            </div>
            <div className="rounded-xl border border-[#BFE9D0] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Last Updated
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {formatDate(user.updatedAt)}
              </p>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
