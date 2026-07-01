"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type InviteRole = "ADMIN" | "MEMBER";

type InviteMemberResponse = {
  message: string;
  emailResult?: {
    skipped?: boolean;
    reason?: string;
    messageId?: string;
  };
  inviteUrl?: string;
  errors?: {
    email?: string[];
    role?: string[];
  };
};

export default function InviteMemberForm({
  canInvite,
  remainingSeats,
}: {
  canInvite: boolean;
  remainingSeats: number;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("MEMBER");
  const [inviteUrl, setInviteUrl] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setEmailStatus("");
    setSuccess("");
    setInviteUrl("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          role,
        }),
      });

      const data: InviteMemberResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.email?.[0] ??
          data.errors?.role?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setEmail("");
      setRole("MEMBER");
      setSuccess(data.message);
      setInviteUrl(data.inviteUrl ?? "");
      if (data.emailResult?.messageId) {
        setEmailStatus("Invite email sent successfully.");
      } else if (data.emailResult?.skipped) {
        setEmailStatus(data.emailResult.reason ?? "Invite email was not sent.");
      } else {
        setEmailStatus("Invite created.");
      }

      router.refresh();
    } catch {
      setError("Unable to create invite. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyInviteUrl() {
    if (!inviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
    setSuccess("Invite link copied");
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Invite Member</h2>

      <p className="mt-2 text-sm text-gray-600">
        Create an invite link for a new workspace member.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {!canInvite ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Your plan has reached its team member limit. Upgrade to add more people.
          </p>
        ) : (
          <p className="rounded-lg border border-[#BFE9D0] bg-[#E7F8EF] p-3 text-sm text-[#526173]">
            Remaining seats: {remainingSeats}
          </p>
        )}
        <div>
          <label
            htmlFor="inviteEmail"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Email address
          </label>

          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@example.com"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="inviteRole"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Role
          </label>

          <select
            id="inviteRole"
            value={role}
            onChange={(event) => setRole(event.target.value as InviteRole)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          >
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        )}

        {inviteUrl && (
          <div className="rounded-lg border bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-500">Invite Link</p>

            <p className="mt-2 break-all text-sm text-gray-700">{inviteUrl}</p>

            <button
              type="button"
              onClick={copyInviteUrl}
              className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Copy Link
            </button>
          </div>
        )}

        {emailStatus && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            {emailStatus}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !canInvite}
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating invite..." : "Create Invite"}
        </button>
      </form>
    </div>
  );
}
