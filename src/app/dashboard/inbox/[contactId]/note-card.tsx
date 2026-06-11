"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type NoteCardProps = {
  contactId: string;
  note: {
    id: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      name: string | null;
      email: string;
    };
  };
};

type NoteResponse = {
  message: string;
  errors?: {
    body?: string[];
  };
};

export default function NoteCard({ contactId, note }: NoteCardProps) {
  const router = useRouter();

  const [body, setBody] = useState(note.body);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function updateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/notes/${note.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body,
        }),
      });

      const data: NoteResponse = await response.json();

      if (!response.ok) {
        setError(data.errors?.body?.[0] ?? data.message);
        return;
      }

      setIsEditing(false);
      router.refresh();
    } catch {
      setError("Unable to update note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteNote() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this note?",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/notes/${note.id}`, {
        method: "DELETE",
      });

      const data: NoteResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to delete note. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isEditing) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <form onSubmit={updateNote} className="space-y-3">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            required
            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-black"
          />

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
                setBody(note.body);
                setIsEditing(false);
                setError("");
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
    <div className="rounded-xl border bg-white p-4">
      <p className="whitespace-pre-wrap text-sm text-gray-800">{note.body}</p>

      <p className="mt-3 text-xs text-gray-500">
        By {note.author.name ?? note.author.email} &middot;{" "}
        {note.createdAt.toLocaleString()}
      </p>

      {note.updatedAt.getTime() !== note.createdAt.getTime() && (
        <p className="mt-1 text-xs text-gray-400">
          Edited: {note.updatedAt.toLocaleString()}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={deleteNote}
          disabled={isDeleting}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
