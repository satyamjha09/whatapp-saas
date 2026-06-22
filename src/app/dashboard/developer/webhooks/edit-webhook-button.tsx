"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEVELOPER_WEBHOOK_EVENTS,
  DEVELOPER_WEBHOOK_PAYLOAD_VERSION,
} from "@/server/config/developer-webhook-events";

type EditWebhookButtonProps = {
  endpointId: string;
  initialName: string;
  initialUrl: string;
  initialEvents: string[];
  initialPayloadVersion: string;
};

type UpdateWebhookResponse = {
  message: string;
  errors?: {
    name?: string[];
    url?: string[];
    events?: string[];
    payloadVersion?: string[];
  };
};

export default function EditWebhookButton({
  endpointId,
  initialName,
  initialUrl,
  initialEvents,
  initialPayloadVersion,
}: EditWebhookButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    initialEvents.length > 0
      ? initialEvents
      : DEVELOPER_WEBHOOK_EVENTS.map((event) => event.id),
  );
  const [payloadVersion, setPayloadVersion] = useState(
    initialPayloadVersion || DEVELOPER_WEBHOOK_PAYLOAD_VERSION,
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function toggleEvent(eventId: string) {
    setSelectedEvents((current) =>
      current.includes(eventId)
        ? current.filter((item) => item !== eventId)
        : [...current, eventId],
    );
  }

  async function updateWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/developer/webhooks/${endpointId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          url,
          events: selectedEvents,
          payloadVersion,
        }),
      });
      const data = (await response.json()) as UpdateWebhookResponse;

      if (!response.ok) {
        setError(
          data.errors?.name?.[0] ??
            data.errors?.url?.[0] ??
            data.errors?.events?.[0] ??
            data.errors?.payloadVersion?.[0] ??
            data.message,
        );
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Unable to update webhook.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
      >
        Edit
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Webhook
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Update endpoint URL, event subscriptions, and payload
                  version.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={updateWebhook} className="mt-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Webhook Name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Endpoint URL
                </label>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-gray-900">Events</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {DEVELOPER_WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          {event.label}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {event.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Payload Version
                </label>
                <input
                  value={payloadVersion}
                  onChange={(event) => setPayloadVersion(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>

              {error && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
