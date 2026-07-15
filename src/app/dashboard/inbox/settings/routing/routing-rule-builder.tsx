"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { InboxAssignmentMode } from "@/generated/prisma/client";

type QueueOption = {
  id: string;
  name: string;
  status: string;
};

type SkillOption = {
  id: string;
  name: string;
};

type Condition = {
  field: string;
  operator: string;
  value: string;
};

const conditionFields = [
  "MESSAGE_CONTAINS",
  "CONTACT_TAG",
  "CONTACT_CITY",
  "CONTACT_SOURCE",
  "LEAD_SCORE",
  "LIFECYCLE_STAGE",
  "WHATSAPP_NUMBER",
  "CHATBOT_HANDOFF_REASON",
];

const operators = ["EQUALS", "CONTAINS", "IN", "GT", "GTE", "LT", "LTE"];
const assignmentModes: InboxAssignmentMode[] = ["MANUAL", "ROUND_ROBIN", "LEAST_OPEN", "HYBRID"];

export default function RoutingRuleBuilder({
  queues,
  skills,
}: {
  queues: QueueOption[];
  skills: SkillOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "MESSAGE_CONTAINS", operator: "CONTAINS", value: "" },
  ]);
  const [requiredSkillIds, setRequiredSkillIds] = useState<string[]>([]);

  async function submit(formData: FormData) {
    setError(null);

    const response = await fetch("/api/inbox/routing-rules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignmentMode: formData.get("assignmentMode") || null,
        conditions: conditions.map((condition) => ({
          ...condition,
          value:
            condition.operator === "IN"
              ? condition.value.split(",").map((item) => item.trim()).filter(Boolean)
              : condition.value,
        })),
        fallbackQueueId: formData.get("fallbackQueueId") || null,
        name: formData.get("name"),
        priority: Number(formData.get("priority") || 100),
        requiredSkillIds,
        status: formData.get("status"),
        targetQueueId: formData.get("targetQueueId"),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "Unable to create routing rule");
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <form
      action={submit}
      className="rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.06)]"
    >
      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#128C7E]">
        Routing rule
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#081B3A]">
        Send conversations to the right team
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#526173]">
        Match a new reply or chatbot handoff, then pick a queue and assignment
        strategy.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block text-sm font-bold text-[#081B3A]">
          Rule name
          <input
            className="mt-2 w-full rounded-xl border border-[#BFE9D0] px-4 py-3 text-sm outline-none focus:border-[#128C7E]"
            name="name"
            placeholder="Support keyword routing"
            required
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#081B3A]">
            Priority
            <input
              className="mt-2 w-full rounded-xl border border-[#BFE9D0] px-4 py-3 text-sm outline-none focus:border-[#128C7E]"
              defaultValue={100}
              min={1}
              name="priority"
              type="number"
            />
          </label>
          <label className="block text-sm font-bold text-[#081B3A]">
            Status
            <select
              className="mt-2 w-full rounded-xl border border-[#BFE9D0] px-4 py-3 text-sm outline-none focus:border-[#128C7E]"
              defaultValue="ACTIVE"
              name="status"
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-[#D9F3E5] bg-[#F7FFFA] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#081B3A]">Conditions</p>
            <button
              className="text-xs font-black text-[#128C7E]"
              onClick={() =>
                setConditions((current) => [
                  ...current,
                  { field: "MESSAGE_CONTAINS", operator: "CONTAINS", value: "" },
                ])
              }
              type="button"
            >
              Add condition
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {conditions.map((condition, index) => (
              <div key={`${condition.field}-${index}`} className="grid gap-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                  <select
                    className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm"
                    value={condition.field}
                    onChange={(event) =>
                      setConditions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, field: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {conditionFields.map((field) => (
                      <option key={field} value={field}>
                        {field.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm"
                    value={condition.operator}
                    onChange={(event) =>
                      setConditions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, operator: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {operators.map((operator) => (
                      <option key={operator} value={operator}>
                        {operator}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm"
                  placeholder="support, billing, Delhi, lead..."
                  value={condition.value}
                  onChange={(event) =>
                    setConditions((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <label className="block text-sm font-bold text-[#081B3A]">
          Target queue
          <select
            className="mt-2 w-full rounded-xl border border-[#BFE9D0] px-4 py-3 text-sm outline-none focus:border-[#128C7E]"
            name="targetQueueId"
            required
          >
            <option value="">Select queue</option>
            {queues.map((queue) => (
              <option key={queue.id} value={queue.id}>
                {queue.name} ({queue.status})
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#081B3A]">
            Assignment mode
            <select
              className="mt-2 w-full rounded-xl border border-[#BFE9D0] px-4 py-3 text-sm outline-none focus:border-[#128C7E]"
              name="assignmentMode"
            >
              <option value="">Use queue default</option>
              {assignmentModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-[#081B3A]">
            Fallback queue
            <select
              className="mt-2 w-full rounded-xl border border-[#BFE9D0] px-4 py-3 text-sm outline-none focus:border-[#128C7E]"
              name="fallbackQueueId"
            >
              <option value="">No fallback</option>
              {queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {skills.length ? (
          <div>
            <p className="text-sm font-bold text-[#081B3A]">Required skills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((skill) => {
                const checked = requiredSkillIds.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      setRequiredSkillIds((current) =>
                        checked
                          ? current.filter((id) => id !== skill.id)
                          : [...current, skill.id],
                      )
                    }
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-black transition",
                      checked
                        ? "border-[#128C7E] bg-[#E7F8EF] text-[#075E54]"
                        : "border-[#BFE9D0] bg-white text-[#526173]",
                    ].join(" ")}
                  >
                    {skill.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        className="mt-6 w-full rounded-xl bg-[#128C7E] px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || queues.length === 0}
        type="submit"
      >
        {isPending ? "Saving..." : "Create routing rule"}
      </button>
    </form>
  );
}
