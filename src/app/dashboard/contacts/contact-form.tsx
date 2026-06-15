"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

type Contact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
};

type CreateContactResponse = {
  message: string;
  contact?: Contact;
  errors?: {
    name?: string[];
    countryCode?: string[];
    phoneNumber?: string[];
  };
};

export default function ContactForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          countryCode,
          phoneNumber,
        }),
      });

      const data: CreateContactResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ??
          data.errors?.countryCode?.[0] ??
          data.errors?.phoneNumber?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setName("");
      setCountryCode("91");
      setPhoneNumber("");

      router.refresh();
    } catch {
      setError("Unable to create contact. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel>
      <PanelTitle
        title="Create contact"
        description="Add a customer contact for sending WhatsApp template messages."
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="name" className={labelClass}>
            Contact name
          </label>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Test Customer"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="countryCode" className={labelClass}>
            Country code
          </label>

          <input
            id="countryCode"
            type="text"
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            placeholder="91"
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="phoneNumber" className={labelClass}>
            Phone number
          </label>

          <input
            id="phoneNumber"
            type="text"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="9876543210"
            required
            className={fieldClass}
          />
          <p className={helperTextClass}>
            Store the number without spaces or symbols.
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={actionButtonClass()}
        >
          {isSubmitting ? "Creating..." : "Create Contact"}
        </button>
      </form>
    </Panel>
  );
}
