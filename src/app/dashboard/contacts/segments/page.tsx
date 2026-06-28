import { requireAdmin } from "@/server/auth/authorization";
import { listContactSegments } from "@/server/services/contact-segment-builder.service";
import { SegmentCreateForm } from "./segment-create-form";
import { SegmentPreviewButton } from "./segment-actions";

export default async function ContactSegmentsPage() {
  const context = await requireAdmin();
  const segments = await listContactSegments({
    companyId: context.membership.companyId,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Contacts</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Contact Segments</h1>
        <p className="mt-2 text-sm text-gray-600">
          Build reusable recipient groups for WhatsApp campaigns.
        </p>
      </div>

      <div className="mt-6">
        <SegmentCreateForm />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Segments</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Match</th>
                <th className="px-5 py-3">Rules</th>
                <th className="px-5 py-3">Last Preview</th>
                <th className="px-5 py-3">Created By</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {segments.map((segment) => (
                <tr key={segment.id}>
                  <td className="px-5 py-4 font-semibold">{segment.name}</td>
                  <td className="px-5 py-4">{segment.status}</td>
                  <td className="px-5 py-4">{segment.matchMode}</td>
                  <td className="px-5 py-4">{segment.rules.length}</td>
                  <td className="px-5 py-4">{segment.lastPreviewCount} contacts</td>
                  <td className="px-5 py-4">{segment.createdByUser?.email ?? "-"}</td>
                  <td className="px-5 py-4">
                    <SegmentPreviewButton segmentId={segment.id} />
                  </td>
                </tr>
              ))}
              {segments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                    No segments yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
