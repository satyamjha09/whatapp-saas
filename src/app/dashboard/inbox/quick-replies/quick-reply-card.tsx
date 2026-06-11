"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type QuickReplyCardProps = {
  quickReply: {
    id: string;
    title: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
};

type QuickReplyResponse = {
  message: string;
  errors?: {
    title?: string[];
    body?: string[];
  };
};

export default function QuickReplyCard({ quickReply }: QuickReplyCardProps) {
  const router = useRouter();

  const [title, setTitle] = useState(quickReply.title);
  const [body, setBody] = useState(quickReply.body);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function updateQuickReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/inbox/quick-replies/${quickReply.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            body,
          }),
        },
      );

      const data: QuickReplyResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.title?.[0] ?? data.errors?.body?.[0] ?? data.message;

        setError(firstError);
        return;
      }

      setIsEditing(false);
      router.refresh();
    } catch {
      setError("Unable to update quick reply. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteQuickReply() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this quick reply?",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/inbox/quick-replies/${quickReply.id}`,
        {
          method: "DELETE",
        },
      );

      const data: QuickReplyResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to delete quick reply. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isEditing) {
    return (
      <div className="rounded-xl border p-4">
        <form onSubmit={updateQuickReply} className="space-y-4">
          <div>
            <label
              htmlFor={`title-${quickReply.id}`}
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Title
            </label>

            <input
              id={`title-${quickReply.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={80}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor={`body-${quickReply.id}`}
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Reply Body
            </label>

            <textarea
              id={`body-${quickReply.id}`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              required
              maxLength={4096}
              className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={() => {
                setTitle(quickReply.title);
                setBody(quickReply.body);
                setError("");
                setIsEditing(false);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-900">{quickReply.title}</p>

          <p className="mt-1 text-xs text-gray-500">
            Created by{" "}
            {quickReply.createdBy?.name ??
              quickReply.createdBy?.email ??
              "Unknown"}
          </p>

          {quickReply.updatedAt.getTime() !==
            quickReply.createdAt.getTime() && (
            <p className="mt-1 text-xs text-gray-400">
              Edited: {quickReply.updatedAt.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={deleteQuickReply}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <p className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
        {quickReply.body}
      </p>
    </div>
  );
}
