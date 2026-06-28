import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import { listContactSegments } from "@/server/services/contact-segment-builder.service";

export default async function VariableMappingPage() {
  const context = await requireAdmin();
  const segments = await listContactSegments({
    companyId: context.membership.companyId,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Campaigns</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Template Variable Mapping</h1>
        <p className="mt-2 text-sm text-gray-600">
          Map WhatsApp template variables to contact fields, static values, or system values.
        </p>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Example Mapping</h2>
        <div className="mt-4 rounded-xl bg-gray-50 p-4 font-mono text-sm text-gray-800">
          Hello {"{{name}}"}, your invoice {"{{1}}"} is ready.
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="font-semibold text-gray-900">Variable</p>
            <p className="mt-1 text-sm text-gray-600">name</p>
            <p className="mt-3 font-semibold text-gray-900">Source</p>
            <p className="mt-1 text-sm text-gray-600">Contact field: name</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-semibold text-gray-900">Variable</p>
            <p className="mt-1 text-sm text-gray-600">1</p>
            <p className="mt-3 font-semibold text-gray-900">Source</p>
            <p className="mt-1 text-sm text-gray-600">Static or system value</p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Available Segments</h2>
        <div className="mt-4 divide-y">
          {segments.map((segment) => (
            <div key={segment.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-semibold text-gray-900">{segment.name}</p>
                <p className="text-sm text-gray-500">
                  {segment.lastPreviewCount} contacts - {segment.status}
                </p>
              </div>
              <Link
                href={`/dashboard/messages/bulk?segmentId=${segment.id}`}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Use in Campaign
              </Link>
            </div>
          ))}
          {segments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Create a contact segment first.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
