import Link from "next/link";
import { redirect } from "next/navigation";
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
            Developer Webhook Event Types
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "webhook.test",
              "message.status_updated",
              "message.received",
            ].map((eventType) => (
              <div key={eventType} className="rounded-xl border p-4">
                <p className="font-medium text-gray-900">{eventType}</p>
              </div>
            ))}
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
