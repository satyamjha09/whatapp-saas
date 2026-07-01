"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";

type ProfileFormProps = {
  initialName: string;
  initialMobile: string;
};

type UpdateProfileResponse = {
  message: string;
  errors?: {
    name?: string[];
    mobile?: string[];
  };
};

export default function ProfileForm({
  initialMobile,
  initialName,
}: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [mobile, setMobile] = useState(initialMobile);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          mobile,
        }),
      });

      const data = (await response.json()) as UpdateProfileResponse;

      if (!response.ok) {
        setError(
          data.errors?.name?.[0] ??
            data.errors?.mobile?.[0] ??
            data.message ??
            "Unable to save profile.",
        );
        return;
      }

      setSuccess(data.message);
      router.refresh();
    } catch {
      setError("Unable to save profile.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="profile-name" className={labelClass}>
          Full Name
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass}
          placeholder="Your full name"
          required
        />
      </div>

      <div>
        <label htmlFor="profile-mobile" className={labelClass}>
          Mobile Number
        </label>
        <input
          id="profile-mobile"
          value={mobile}
          onChange={(event) =>
            setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
          }
          className={fieldClass}
          inputMode="numeric"
          placeholder="10-digit mobile number"
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={actionButtonClass()}
      >
        {isSubmitting ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
