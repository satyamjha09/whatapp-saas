"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AcceptInviteButtonProps = {
  disabled?: boolean;
  token: string;
};

type AcceptInviteResponse = {
  message: string;
};

export default function AcceptInviteButton({
  disabled = false,
  token,
}: AcceptInviteButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  async function acceptInvite() {
    setError("");
    setIsAccepting(true);

    try {
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });

      const data: AcceptInviteResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to accept invite. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={acceptInvite}
        disabled={disabled || isAccepting}
        className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isAccepting ? "Joining..." : "Accept Invite"}
      </button>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
