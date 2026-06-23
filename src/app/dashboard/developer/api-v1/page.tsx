import { requireMember } from "@/server/auth/authorization";

export default async function ApiV1DocsPage() {
  await requireMember();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm font-medium text-gray-500">Developer</p>
      <h1 className="mt-1 text-3xl font-bold text-gray-900">Public API v1</h1>
      <p className="mt-2 text-sm text-gray-600">
        Stable API contract for production integrations.
      </p>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Authentication</h2>
        <pre className="mt-4 overflow-auto rounded-xl bg-gray-950 p-4 text-sm text-white">
          {`Authorization: Bearer tk_live_xxxxx`}
        </pre>
        <p className="mt-3 text-sm text-gray-600">
          Existing integrations may continue using the x-api-key header.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Idempotency</h2>
        <p className="mt-2 text-sm text-gray-600">
          Mutations require an Idempotency-Key. The same key and payload replay
          the stored response; changing the request returns HTTP 409.
        </p>
        <pre className="mt-4 overflow-auto rounded-xl bg-gray-950 p-4 text-sm text-white">
          {`Idempotency-Key: order_123_send_welcome_message`}
        </pre>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Send template message</h2>
        <pre className="mt-4 overflow-auto rounded-xl bg-gray-950 p-4 text-sm text-white">
{`curl -X POST https://your-domain.com/api/v1/messages/send-template \\
  -H "Authorization: Bearer tk_live_xxxxx" \\
  -H "Idempotency-Key: msg_12345" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "918810386013",
    "templateName": "hello_world",
    "language": "en_US",
    "bodyParameters": []
  }'`}
        </pre>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">OpenAPI</h2>
        <a
          href="/api/v1/openapi.json"
          className="mt-2 inline-block text-sm font-medium text-gray-900 underline"
        >
          /api/v1/openapi.json
        </a>
      </section>
    </main>
  );
}
