import Link from "next/link";
import { actionButtonClass, PageHeader, Panel } from "@/app/dashboard/dashboard-ui";
import { requireAdmin } from "@/server/auth/authorization";
import { listContactSegments } from "@/server/services/contact-segment-builder.service";
import { SegmentTable } from "@/components/contacts/segments/segment-table";
import { SegmentEmptyState } from "@/components/contacts/segments/segment-empty-state";

export default async function ContactSegmentsPage() {
  const context = await requireAdmin();
  const segments = await listContactSegments({
    companyId: context.membership.companyId,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Contacts"
        title="Smart segments"
        description="Dynamic audiences built from contact data. Contacts enter and leave automatically as their data changes."
        actions={
          <Link
            href="/dashboard/contacts/segments/new"
            className={actionButtonClass("primary")}
          >
            Create segment
          </Link>
        }
      />

      <Panel>
        {segments.length === 0 ? (
          <SegmentEmptyState />
        ) : (
          <SegmentTable
            segments={segments.map((segment) => ({
              id: segment.id,
              name: segment.name,
              description: segment.description,
              status: segment.status,
              matchMode: segment.matchMode,
              ruleCount: segment.rules.length,
              lastPreviewCount: segment.lastPreviewCount,
              updatedAt: segment.updatedAt.toISOString(),
            }))}
          />
        )}
      </Panel>
    </div>
  );
}
