"use client";

import { useState, useTransition } from "react";

export default function QueueForm() {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    const payload = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      color: String(formData.get("color") ?? "#128C7E"),
      assignmentMode: String(formData.get("assignmentMode") ?? "MANUAL"),
      maxOpenPerAgent: formData.get("maxOpenPerAgent")
        ? Number(formData.get("maxOpenPerAgent"))
        : null,
      approvalRequired: formData.get("approvalRequired") === "on",
    };

    startTransition(async () => {
      const response = await fetch("/api/inbox/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Unable to create queue");
        return;
      }

      window.location.reload();
    });
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_50px_rgba(18,140,126,0.06)]"
    >
      <h2 className="text-lg font-black text-[#081B3A]">Create queue</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-bold text-[#081B3A]">
          Queue name
          <input
            name="name"
            placeholder="Sales support"
            required
            className="w-full rounded-xl border border-[#BFE9D0] px-3 py-2 font-medium outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
          />
        </label>
        <label className="space-y-1.5 text-sm font-bold text-[#081B3A]">
          Assignment mode
          <select
            name="assignmentMode"
            className="w-full rounded-xl border border-[#BFE9D0] px-3 py-2 font-medium outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
          >
            <option value="MANUAL">Manual</option>
            <option value="ROUND_ROBIN">Round robin</option>
            <option value="LEAST_OPEN">Least open</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-bold text-[#081B3A]">
          Color
          <input
            name="color"
            type="color"
            defaultValue="#128C7E"
            className="h-11 w-full rounded-xl border border-[#BFE9D0] px-2 py-1"
          />
        </label>
        <label className="space-y-1.5 text-sm font-bold text-[#081B3A]">
          Max open per agent
          <input
            name="maxOpenPerAgent"
            type="number"
            min="1"
            max="500"
            placeholder="25"
            className="w-full rounded-xl border border-[#BFE9D0] px-3 py-2 font-medium outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
          />
        </label>
      </div>
      <label className="mt-4 block space-y-1.5 text-sm font-bold text-[#081B3A]">
        Description
        <textarea
          name="description"
          rows={3}
          placeholder="Which conversations should enter this queue?"
          className="w-full rounded-xl border border-[#BFE9D0] px-3 py-2 font-medium outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
        />
      </label>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#526173]">
        <input name="approvalRequired" type="checkbox" className="h-4 w-4" />
        Require supervisor approval before close or handoff
      </label>
      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-5 rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_30px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:opacity-60"
      >
        {isPending ? "Creating..." : "Create queue"}
      </button>
    </form>
  );
}
