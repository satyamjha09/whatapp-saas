"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InboxTag = {
  id: string;
  name: string;
  color: string;
};

type ConversationTagManagerProps = {
  contactId: string;
  allTags: InboxTag[];
  activeTags: InboxTag[];
};

type TagResponse = {
  message: string;
};

export default function ConversationTagManager({
  contactId,
  allTags,
  activeTags,
}: ConversationTagManagerProps) {
  const router = useRouter();

  const activeTagIds = new Set(activeTags.map((tag) => tag.id));
  const availableTags = allTags.filter((tag) => !activeTagIds.has(tag.id));

  const [selectedTagId, setSelectedTagId] = useState("");
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function addTag() {
    if (!selectedTagId) {
      return;
    }

    setError("");
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tagId: selectedTagId,
        }),
      });

      const data: TagResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setSelectedTagId("");
      router.refresh();
    } catch {
      setError("Unable to add tag. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function removeTag(tagId: string) {
    setError("");
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/inbox/${contactId}/tags?tagId=${encodeURIComponent(tagId)}`,
        {
          method: "DELETE",
        },
      );

      const data: TagResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to remove tag. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">Tags</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeTags.length === 0 ? (
          <span className="text-sm text-gray-500">No tags added.</span>
        ) : (
          activeTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
            >
              {tag.name}

              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                disabled={isUpdating}
                className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove ${tag.name} tag`}
              >
                x
              </button>
            </span>
          ))
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={selectedTagId}
            onChange={(event) => setSelectedTagId(event.target.value)}
            disabled={isUpdating}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
          >
            <option value="">Add tag...</option>

            {availableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addTag}
            disabled={isUpdating || !selectedTagId}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
