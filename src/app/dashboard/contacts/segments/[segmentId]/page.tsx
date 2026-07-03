import { notFound } from "next/navigation";
import { PageHeader, Panel, PanelTitle } from "@/app/dashboard/dashboard-ui";
import { requireAdmin } from "@/server/auth/authorization";
import {
  ContactSegmentBuilderError,
  getContactSegmentDetail,
} from "@/server/services/contact-segment-builder.service";
import { SegmentBuilder } from "@/components/contacts/segments/segment-builder";
import { SegmentContactsTable } from "@/components/contacts/segments/segment-contacts-table";
import type { SegmentRuleDraft } from "@/components/contacts/segments/segment-fields";

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ segmentId: string }>;
}) {
  const context = await requireAdmin();
  const { segmentId } = await params;

  let segment;

  try {
    segment = await getContactSegmentDetail({
      companyId: context.membership.companyId,
      segmentId,
    });
  } catch (error) {
    if (error instanceof ContactSegmentBuilderError) {
      notFound();
    }

    throw error;
  }

  const initialRules = segment.rules.map((rule) => ({
    field: rule.field,
    operator: rule.operator,
    customFieldKey: rule.customFieldKey ?? undefined,
    value: rule.value ?? undefined,
  })) as SegmentRuleDraft[];

  return (
    <div>
      <PageHeader
        eyebrow="Contacts · Smart segments"
        title={segment.name}
        description={
          segment.description ??
          "Edit the rules below - the matching contacts update automatically."
        }
      />

      <Panel>
        <SegmentBuilder
          mode="edit"
          segmentId={segment.id}
          initialName={segment.name}
          initialDescription={segment.description ?? ""}
          initialMatchMode={segment.matchMode}
          initialRules={initialRules}
        />
      </Panel>

      <Panel className="mt-6">
        <PanelTitle
          title="Matching contacts"
          description="Evaluated live from the saved rules. Membership is never stored."
        />
        <div className="mt-4">
          <SegmentContactsTable segmentId={segment.id} />
        </div>
      </Panel>
    </div>
  );
}
