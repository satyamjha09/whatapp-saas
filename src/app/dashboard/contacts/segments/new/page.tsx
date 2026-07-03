import { PageHeader, Panel } from "@/app/dashboard/dashboard-ui";
import { requireAdmin } from "@/server/auth/authorization";
import { SegmentBuilder } from "@/components/contacts/segments/segment-builder";

export default async function NewSegmentPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        eyebrow="Contacts"
        title="Create smart segment"
        description="Combine conditions to build a reusable audience for broadcasts. The count updates live as you edit rules."
      />

      <Panel>
        <SegmentBuilder mode="create" />
      </Panel>
    </div>
  );
}
