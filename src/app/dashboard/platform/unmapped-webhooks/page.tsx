import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/server/auth/platform-admin";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import ReprocessUnmappedWebhookButton from "./reprocess-unmapped-webhook-button";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] : undefined;
}

function getFirstMessage(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const message = firstArrayItem(value?.messages);

  return asRecord(message);
}

function getCustomerPhone(payload: unknown) {
  const message = getFirstMessage(payload);
  const from = message?.from;

  return typeof from === "string" ? from : "Unknown";
}

function getMessageType(payload: unknown) {
  const message = getFirstMessage(payload);
  const type = message?.type;

  return typeof type === "string" ? type : "unknown";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function UnmappedWhatsAppWebhooksPage() {
  let platformAdmin;

  try {
    platformAdmin = await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const [events, companies] = await Promise.all([
    prisma.unmappedWebhookEvent.findMany({
      where: {
        status: "UNRESOLVED",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
    prisma.company.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
      take: 200,
    }),
  ]);

  await createPlatformAuditLog({
    actorUserId: platformAdmin.user?.id,
    actorEmail: platformAdmin.email,
    action: "platform.unmapped_webhooks.viewed",
    entityType: "UnmappedWebhookEvent",
    metadata: {
      unresolvedCount: events.length,
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Platform Ops</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Unmapped WhatsApp Events
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            These Meta webhooks could not be mapped to a company by
            phone_number_id. Link the event to the correct company and reprocess
            it so the customer message enters the inbox.
          </p>
        </div>
        <Link
          href="/dashboard/platform"
          className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-700"
        >
          Back to Platform
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Unresolved</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{events.length}</p>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Needs admin review
          </h2>
        </div>

        {events.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No unmapped WhatsApp webhooks.
          </div>
        ) : (
          <div className="divide-y">
            {events.map((event) => (
              <article key={event.id} className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,auto)]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                      {event.reason}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {event.eventType ?? "unknown"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-gray-500">phone_number_id</dt>
                      <dd className="mt-1 font-mono text-gray-900">
                        {event.phoneNumberId ?? "Missing"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Customer phone</dt>
                      <dd className="mt-1 font-mono text-gray-900">
                        {getCustomerPhone(event.payload)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Message type</dt>
                      <dd className="mt-1 text-gray-900">
                        {getMessageType(event.payload)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Event ID</dt>
                      <dd className="mt-1 truncate font-mono text-gray-900">
                        {event.id}
                      </dd>
                    </div>
                  </dl>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700">
                      Raw payload
                    </summary>
                    <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                </div>

                <ReprocessUnmappedWebhookButton
                  eventId={event.id}
                  companies={companies}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
