"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Create Contact</h2>

      <p className="mt-2 text-sm text-gray-600">
        Add a customer contact for sending WhatsApp template messages.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Contact name
          </label>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Test Customer"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="countryCode"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Country code
          </label>

          <input
            id="countryCode"
            type="text"
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            placeholder="91"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="phoneNumber"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Phone number
          </label>

          <input
            id="phoneNumber"
            type="text"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="9876543210"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Contact"}
        </button>
      </form>
    </div>
  );
}
