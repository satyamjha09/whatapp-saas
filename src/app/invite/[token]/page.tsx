import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getInviteByToken } from "@/server/services/invite.service";
import AcceptInviteButton from "./accept-invite-button";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Invite not found
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            This invite link is invalid or has been removed.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (invite.status !== "PENDING") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Invite unavailable
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            This invite is currently {invite.status.toLowerCase()}.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Invite expired</h1>

          <p className="mt-2 text-sm text-gray-600">
            Ask the workspace admin to create a new invite.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect(`/sign-in?redirect_url=/invite/${token}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Join {invite.company.name}
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          You have been invited as{" "}
          <span className="font-medium text-gray-900">{invite.role}</span>.
        </p>

        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Invited email</p>

          <p className="mt-1 font-medium text-gray-900">{invite.email}</p>
        </div>

        <AcceptInviteButton token={token} />
      </div>
    </main>
  );
}
