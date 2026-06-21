"use client";

import { LoaderCircle, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RemoveGroupMemberButton({
  groupId,
  memberId,
}: {
  groupId: string;
  memberId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeMember() {
    if (!window.confirm("Remove this contact from the group?")) return;
    setError("");
    setIsRemoving(true);

    try {
      const response = await fetch(
        `/api/contacts/groups/${groupId}/members/${memberId}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Unable to remove contact.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to remove contact from group.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={removeMember}
        disabled={isRemoving}
        className="inline-flex items-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      >
        {isRemoving ? (
          <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserMinus className="mr-1.5 h-3.5 w-3.5" />
        )}
        {isRemoving ? "Removing..." : "Remove"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
