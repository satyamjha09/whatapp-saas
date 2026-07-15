"use client";

import { useState, useTransition } from "react";

type Skill = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count: {
    agentSkills: number;
    requiredByQueues: number;
  };
};

export default function SkillManagement({ skills }: { skills: Skill[] }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function createSkill(formData: FormData) {
    setError("");
    const payload = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    };

    startTransition(async () => {
      const response = await fetch("/api/inbox/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Unable to create skill");
        return;
      }

      window.location.reload();
    });
  }

  function deleteSkill(skillId: string) {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/inbox/skills/${skillId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Unable to delete skill");
        return;
      }

      window.location.reload();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form
        action={createSkill}
        className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_50px_rgba(18,140,126,0.06)]"
      >
        <h2 className="text-lg font-black text-[#081B3A]">Create skill</h2>
        <label className="mt-4 block space-y-1.5 text-sm font-bold text-[#081B3A]">
          Skill name
          <input
            name="name"
            required
            placeholder="Hindi support"
            className="w-full rounded-xl border border-[#BFE9D0] px-3 py-2 font-medium outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
          />
        </label>
        <label className="mt-4 block space-y-1.5 text-sm font-bold text-[#081B3A]">
          Description
          <textarea
            name="description"
            rows={3}
            placeholder="Optional routing context"
            className="w-full rounded-xl border border-[#BFE9D0] px-3 py-2 font-medium outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
          />
        </label>
        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="mt-5 rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_30px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Create skill"}
        </button>
      </form>

      <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
        <h2 className="text-xl font-black text-[#081B3A]">Skills</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#E1F5E9]">
          {skills.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#526173]">
              Create skills for language, product, or priority routing.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F7FFFA] text-xs uppercase tracking-[0.08em] text-[#128C7E]">
                <tr>
                  <th className="px-4 py-3">Skill</th>
                  <th className="px-4 py-3">Agents</th>
                  <th className="px-4 py-3">Queues</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1F5E9]">
                {skills.map((skill) => (
                  <tr key={skill.id}>
                    <td className="px-4 py-3">
                      <span className="font-black text-[#081B3A]">{skill.name}</span>
                      <span className="block text-xs text-[#526173]">{skill.slug}</span>
                      {skill.description ? (
                        <span className="block text-xs text-[#526173]">
                          {skill.description}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[#526173]">
                      {skill._count.agentSkills}
                    </td>
                    <td className="px-4 py-3 text-[#526173]">
                      {skill._count.requiredByQueues}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => deleteSkill(skill.id)}
                        disabled={isPending}
                        className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
