"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

type CreateGroupResponse = {
  message?: string;
  errors?: Partial<Record<"name" | "description" | "color", string[]>>;
};

export default function ContactGroupCreateForm({
  canManage,
}: {
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#0052CC");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/contacts/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });
      const data = (await response.json()) as CreateGroupResponse;

      if (!response.ok) {
        setError(
          data.errors?.name?.[0] ??
            data.errors?.description?.[0] ??
            data.errors?.color?.[0] ??
            data.message ??
            "Unable to create contact group.",
        );
        return;
      }

      setSuccess("Contact group created.");
      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Unable to create contact group.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Panel className="mb-6">
      <PanelTitle
        title="Create contact group"
        description="Build reusable lead, customer, campaign, and audience lists."
      />
      <form onSubmit={createGroup} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <div>
            <label htmlFor="group-name" className={labelClass}>
              Group name
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              placeholder="Example: June Leads"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="group-color" className={labelClass}>
              Color
            </label>
            <input
              id="group-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-[46px] w-full rounded-xl border border-[#D8E6F3] bg-white p-1.5"
            />
          </div>
        </div>
        <div>
          <label htmlFor="group-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Optional notes about this list"
            className={fieldClass}
          />
        </div>

        {!canManage ? (
          <p className="rounded-xl bg-[#F8C830]/15 p-3 text-sm text-[#102040]">
            Only workspace owners and admins can create groups.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canManage || isSaving}
          className={actionButtonClass()}
        >
          {isSaving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {isSaving ? "Creating..." : "Create Group"}
        </button>
      </form>
    </Panel>
  );
}
