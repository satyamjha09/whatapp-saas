"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RemoveMemberButtonProps = {
  companyUserId: string;
  disabled: boolean;
};

type RemoveMemberResponse = {
  message: string;
};

export default function RemoveMemberButton({
  companyUserId,
  disabled,
}: RemoveMemberButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeMember() {
    const confirmed = window.confirm(
      "Are you sure you want to remove this member?",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setIsRemoving(true);

    try {
      const response = await fetch(`/api/team/members/${companyUserId}`, {
        method: "DELETE",
      });

      const data: RemoveMemberResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to remove member. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={removeMember}
        disabled={disabled || isRemoving}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRemoving ? "Removing..." : "Remove"}
      </button>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
