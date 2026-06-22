import Link from "next/link";
import { redirect } from "next/navigation";
import { DEVELOPER_API_SCOPES } from "@/server/config/developer-api-scopes";
import { DEVELOPER_WEBHOOK_EVENTS } from "@/server/config/developer-webhook-events";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

export default async function DeveloperDocsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <main className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            API Documentation
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Authentication
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Public API requests must include your API key in the{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">x-api-key</code>{" "}
            header.
          </p>

          <pre className="mt-5 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
            {`x-api-key: wsaas_your_api_key_here`}
          </pre>

          <p className="mt-4 text-sm text-gray-600">
            You can create API keys from{" "}
            <Link
              href="/dashboard/developer/api-keys"
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              Developer API Keys
            </Link>
            .
          </p>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Webhook Event Subscriptions
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Each webhook endpoint can subscribe only to the events it needs.
            This keeps customer integrations simpler and reduces unnecessary
            delivery traffic.
          </p>

          <div className="mt-5 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {DEVELOPER_WEBHOOK_EVENTS.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {event.id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {event.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Webhook Payload Version
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Webhook payloads include a version field. Keep your webhook on the
            default version unless you are intentionally testing newer payload
            formats.
          </p>

          <div className="mt-4 rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
            <pre className="overflow-auto text-xs">{`{
  "id": "evt_123",
  "type": "message.delivered",
  "version": "2026-06-01",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "data": {
    "messageId": "msg_123",
    "status": "DELIVERED"
  }
}`}</pre>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            API Key IP Allowlist
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            API keys can be restricted to trusted server IP addresses. Leave the
            allowlist empty to allow requests from any IP.
          </p>

          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Examples</p>

            <pre className="mt-2 whitespace-pre-wrap text-xs">
              {`103.10.20.30
103.10.20.0/24`}
            </pre>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            API Key Expiry
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Set an expiry date for temporary integrations, test keys, and
            contractor access. Expired keys return HTTP 403.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            API Key Scopes
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            API keys only work for the scopes selected at creation time.
            Owners and admins can edit active key names and scopes later without
            exposing the secret key.
          </p>

          <div className="mt-5 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Access</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {DEVELOPER_API_SCOPES.map((scope) => (
                  <tr key={scope.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {scope.id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {scope.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Create or Update Contact
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Save a contact in your workspace. If the phone number already
            exists, it will be updated.
          </p>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">Endpoint</p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`POST ${baseUrl}/api/public/contacts`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">Request Body</p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`{
  "name": "John Doe",
  "countryCode": "91",
  "phoneNumber": "9876543210"
}`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              PowerShell curl
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`curl.exe -X POST "${baseUrl}/api/public/contacts" \`
  -H "Content-Type: application/json" \`
  -H "x-api-key: PASTE_WSAAS_API_KEY" \`
  -d "{\\"name\\":\\"John Doe\\",\\"countryCode\\":\\"91\\",\\"phoneNumber\\":\\"9876543210\\"}"`}
            </pre>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            List Contacts
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Fetch contacts saved in your workspace.
          </p>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">Endpoint</p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`GET ${baseUrl}/api/public/contacts`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              PowerShell curl
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`curl.exe -X GET "${baseUrl}/api/public/contacts" \`
  -H "x-api-key: PASTE_WSAAS_API_KEY"`}
            </pre>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            List Templates
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Fetch available templates for your workspace.
          </p>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">Endpoint</p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`GET ${baseUrl}/api/public/templates`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              PowerShell curl
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`curl.exe -X GET "${baseUrl}/api/public/templates" \`
  -H "x-api-key: PASTE_WSAAS_API_KEY"`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              Success Response
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`{
  "success": true,
  "data": [
    {
      "name": "order_update",
      "language": "en_US",
      "category": "UTILITY",
      "status": "DRAFT",
      "variables": ["{{1}}", "{{2}}"],
      "variableCount": 2
    }
  ]
}`}
            </pre>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Send Template Message
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Queue a WhatsApp template message for sending.
          </p>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">Endpoint</p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`POST ${baseUrl}/api/public/messages/send-template`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">Request Body</p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`{
  "to": "919876543210",
  "contactName": "John Doe",
  "templateName": "order_update",
  "language": "en_US",
  "variables": ["John Doe", "ORD123"]
}`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              PowerShell curl
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`curl.exe -X POST "${baseUrl}/api/public/messages/send-template" \`
  -H "Content-Type: application/json" \`
  -H "x-api-key: PASTE_WSAAS_API_KEY" \`
  -d "{\\"to\\":\\"919876543210\\",\\"contactName\\":\\"John Doe\\",\\"templateName\\":\\"order_update\\",\\"language\\":\\"en_US\\",\\"variables\\":[\\"John Doe\\",\\"ORD123\\"]}"`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              Success Response
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`{
  "success": true,
  "message": "Template message queued successfully",
  "messageId": "MESSAGE_ID",
  "status": "QUEUED"
}`}
            </pre>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Check Message Status
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Use the returned message ID to check the message status and event
            timeline.
          </p>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">Endpoint</p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`GET ${baseUrl}/api/public/messages/{messageId}`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              PowerShell curl
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`curl.exe -X GET "${baseUrl}/api/public/messages/MESSAGE_ID_HERE" \`
  -H "x-api-key: PASTE_WSAAS_API_KEY"`}
            </pre>
          </div>

          <div className="mt-5 rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-500">
              Success Response
            </p>

            <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
              {`{
  "success": true,
  "data": {
    "id": "MESSAGE_ID",
    "status": "SENT",
    "toPhoneNumber": "919876543210",
    "metaMessageId": "wamid...",
    "template": {
      "name": "order_update",
      "language": "en_US"
    },
    "events": [
      {
        "status": "QUEUED"
      },
      {
        "status": "SENDING"
      },
      {
        "status": "SENT"
      }
    ]
  }
}`}
            </pre>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Message Status Values
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "QUEUED",
              "SENDING",
              "SENT",
              "DELIVERED",
              "READ",
              "FAILED",
              "RECEIVED",
            ].map((status) => (
              <div key={status} className="rounded-xl border p-4">
                <p className="font-medium text-gray-900">{status}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Verifying Webhook Signatures
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Every developer webhook delivery includes a timestamp and HMAC
            SHA-256 signature. Verify the raw request body before trusting the
            event.
          </p>

          <div className="mt-4 rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
            <pre className="overflow-auto text-xs">{`import crypto from "crypto";

function verifyTallyKonnectWebhook({
  rawBody,
  signatureHeader,
  secret,
}) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((item) => item.split("="))
  );

  const timestamp = parts.t;
  const signature = parts.v1;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${timestamp}.\${rawBody}\`, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}`}</pre>
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Headers</p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>X-TallyKonnect-Webhook-Id</li>
              <li>X-TallyKonnect-Webhook-Event</li>
              <li>X-TallyKonnect-Webhook-Timestamp</li>
              <li>X-TallyKonnect-Webhook-Signature</li>
            </ul>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Webhook Health and Auto-disable
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            If a webhook endpoint repeatedly fails, TallyKonnect automatically
            disables it to prevent unnecessary retries and delivery noise. Fix
            your receiver endpoint, then re-enable the webhook from Developer
            Webhooks.
          </p>

          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Health states</p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Healthy: webhook is active and recent deliveries are
                succeeding.
              </li>
              <li>Degraded: webhook has repeated recent failures.</li>
              <li>
                Auto-disabled: webhook was paused after repeated failures.
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-yellow-50 p-6 text-sm text-yellow-900">
          <h2 className="text-lg font-semibold">Important Notes</h2>

          <div className="mt-3 space-y-2">
            <p>
              Template name and language must match the template saved in your
              workspace.
            </p>

            <p>Wallet balance must be available before sending messages.</p>

            <p>The full API key is shown only once when it is created.</p>

            <p>
              Public APIs are rate limited per API key. If the limit is
              exceeded, the API returns HTTP 429.
            </p>
          </div>

          <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">
            {`{
  "success": false,
  "message": "Rate limit exceeded",
  "rateLimit": {
    "limit": 60,
    "remaining": 0,
    "resetInSeconds": 42
  }
}`}
          </pre>
        </section>
      </div>
    </main>
  );
}
