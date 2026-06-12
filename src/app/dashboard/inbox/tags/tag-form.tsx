"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type TagResponse = {
  message: string;
  errors?: {
    name?: string[];
    color?: string[];
  };
};

const colors = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
];

export default function TagForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [color, setColor] = useState("gray");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inbox/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          color,
        }),
      });

      const data: TagResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ?? data.errors?.color?.[0] ?? data.message;

        setError(firstError);
        return;
      }

      setName("");
      setColor("gray");
      router.refresh();
    } catch {
      setError("Unable to create tag. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={createTag} className="space-y-4">
      <div>
        <label
          htmlFor="tagName"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Tag name
        </label>

        <input
          id="tagName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Pricing"
          required
          maxLength={40}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
        />
      </div>

      <div>
        <label
          htmlFor="tagColor"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Color
        </label>

        <select
          id="tagColor"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
        >
          {colors.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating..." : "Create Tag"}
      </button>
    </form>
  );
}
