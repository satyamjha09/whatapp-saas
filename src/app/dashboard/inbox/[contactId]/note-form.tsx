"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type NoteFormProps = {
  contactId: string;
};

type NoteResponse = {
  message: string;
  errors?: {
    body?: string[];
  };
};

export default function NoteForm({ contactId }: NoteFormProps) {
  const router = useRouter();

  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/notes`, {
        method: "POST",
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

      setBody("");
      router.refresh();
    } catch {
      setError("Unable to add note. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add an internal note..."
        rows={3}
        required
        className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-black"
      />

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Adding..." : "Add Note"}
      </button>
    </form>
  );
}
