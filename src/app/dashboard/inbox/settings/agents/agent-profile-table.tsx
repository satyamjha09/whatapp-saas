"use client";

import { useState, useTransition } from "react";

type Skill = {
  id: string;
  name: string;
};

type AgentRow = {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  membershipRole: string;
  profile: {
    availabilityStatus: string;
    acceptingNew: boolean;
    maxOpenConversations: number;
    preferredLanguage: string | null;
    timezone: string;
  } | null;
  skills: Array<{
    level: number;
    skill: Skill;
  }>;
  openConversationCount: number;
};

export default function AgentProfileTable({
  agents,
  skills,
}: {
  agents: AgentRow[];
  skills: Skill[];
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function saveProfile(formData: FormData) {
    setError("");
    const payload = {
      userId: String(formData.get("userId") ?? ""),
      availabilityStatus: String(formData.get("availabilityStatus") ?? "OFFLINE"),
      acceptingNew: formData.get("acceptingNew") === "on",
      maxOpenConversations: Number(formData.get("maxOpenConversations") ?? 25),
      preferredLanguage: String(formData.get("preferredLanguage") ?? ""),
      timezone: String(formData.get("timezone") ?? "Asia/Kolkata"),
    };

    startTransition(async () => {
      const response = await fetch("/api/inbox/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Unable to save agent profile");
        return;
      }

      window.location.reload();
    });
  }

  function addSkill(formData: FormData) {
    setError("");
    const payload = {
      userId: String(formData.get("userId") ?? ""),
      skillId: String(formData.get("skillId") ?? ""),
      level: Number(formData.get("level") ?? 1),
    };

    startTransition(async () => {
      const response = await fetch("/api/inbox/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Unable to save agent skill");
        return;
      }

      window.location.reload();
    });
  }

  return (
    <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-[#081B3A]">Agent capacity</h2>
          <p className="text-sm text-[#526173]">
            Set availability and routing capacity for each workspace user.
          </p>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      <div className="mt-5 space-y-4">
        {agents.map((agent) => (
          <article
            key={agent.user.id}
            className="rounded-2xl border border-[#E1F5E9] bg-[#F7FFFA] p-4"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="font-black text-[#081B3A]">
                  {agent.user.name ?? agent.user.email}
                </h3>
                <p className="text-sm text-[#526173]">{agent.user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[#526173]">
                    {agent.membershipRole}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[#128C7E]">
                    {agent.openConversationCount} open
                  </span>
                </div>
              </div>
              <form action={saveProfile} className="grid gap-2 md:grid-cols-5">
                <input type="hidden" name="userId" value={agent.user.id} />
                <select
                  name="availabilityStatus"
                  defaultValue={agent.profile?.availabilityStatus ?? "OFFLINE"}
                  className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="BUSY">Busy</option>
                  <option value="AWAY">Away</option>
                  <option value="OFFLINE">Offline</option>
                </select>
                <input
                  name="maxOpenConversations"
                  type="number"
                  min="1"
                  max="500"
                  defaultValue={agent.profile?.maxOpenConversations ?? 25}
                  className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold"
                />
                <input
                  name="preferredLanguage"
                  placeholder="Language"
                  defaultValue={agent.profile?.preferredLanguage ?? ""}
                  className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold"
                />
                <input
                  name="timezone"
                  defaultValue={agent.profile?.timezone ?? "Asia/Kolkata"}
                  className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold"
                />
                <label className="flex items-center gap-2 rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-semibold">
                  <input
                    name="acceptingNew"
                    type="checkbox"
                    defaultChecked={agent.profile?.acceptingNew ?? true}
                  />
                  Accept
                </label>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#128C7E] px-3 py-2 text-sm font-bold text-white disabled:opacity-60 md:col-span-5"
                >
                  Save profile
                </button>
              </form>
            </div>
            <div className="mt-4 border-t border-[#BFE9D0] pt-4">
              <div className="flex flex-wrap gap-2">
                {agent.skills.length ? (
                  agent.skills.map((agentSkill) => (
                    <span
                      key={agentSkill.skill.id}
                      className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#075E54]"
                    >
                      {agentSkill.skill.name} L{agentSkill.level}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#526173]">No skills assigned.</span>
                )}
              </div>
              {skills.length ? (
                <form action={addSkill} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="userId" value={agent.user.id} />
                  <select
                    name="skillId"
                    className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Add skill
                    </option>
                    {skills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="level"
                    className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold"
                  >
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                    <option value="4">Level 4</option>
                    <option value="5">Level 5</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-bold text-[#128C7E] disabled:opacity-60"
                  >
                    Add skill
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
