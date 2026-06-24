"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptRequiredDocumentsButton() {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setIsAccepting(true);
    setError("");

    try {
      const response = await fetch("/api/trust/required/accept", {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to accept documents");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to accept documents");
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={isAccepting}
        className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isAccepting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {isAccepting ? "Accepting..." : "Accept and Continue"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
