"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteTagButtonProps = {
  tagId: string;
};

type DeleteTagResponse = {
  message: string;
};

export default function DeleteTagButton({ tagId }: DeleteTagButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteTag() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this tag?",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/inbox/tags/${tagId}`, {
        method: "DELETE",
      });

      const data: DeleteTagResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to delete tag. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={deleteTag}
        disabled={isDeleting}
        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
