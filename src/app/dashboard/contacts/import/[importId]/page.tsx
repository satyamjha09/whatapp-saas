import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertUserPermission } from "@/server/services/rbac-v2.service";
import {
  getContactImportWizardJob,
  ContactImportError,
} from "@/server/services/contact-import.service";
import { ContactImportProgress } from "@/components/contacts/import/contact-import-progress";
import { ContactImportErrorsTable } from "@/components/contacts/import/contact-import-errors-table";

export default async function ContactImportDetailPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  await assertUserPermission({
    companyId: context.membership.companyId,
    userId: context.user.id,
    permission: "CONTACT_VIEW",
  });

  const { importId } = await params;

  let job;

  try {
    job = await getContactImportWizardJob({
      companyId: context.membership.companyId,
      jobId: importId,
    });
  } catch (error) {
    if (error instanceof ContactImportError) {
      notFound();
    }

    throw error;
  }

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title={job.fileName ?? "Contact import"}
        description="Live status for this contact import."
        actions={
          <Link
            href="/dashboard/contacts/import"
            className={actionButtonClass("secondary")}
          >
            Back to imports
          </Link>
        }
      />

      <Panel>
        <ContactImportProgress
          importId={job.id}
          initialJob={{
            id: job.id,
            status: job.status,
            fileName: job.fileName,
            totalRows: job.totalRows,
            validRows: job.validRows,
            invalidRows: job.invalidRows,
            duplicateRows: job.duplicateRows,
            importedRows: job.importedRows,
            skippedRows: job.skippedRows,
            failedRows: job.failedRows,
            errorMessage: job.errorMessage,
          }}
        />
      </Panel>

      <Panel className="mt-6">
        <PanelTitle
          title="Row details"
          description="Invalid, duplicate, and failed rows from this import."
        />
        <div className="mt-4">
          <ContactImportErrorsTable importId={job.id} />
        </div>
      </Panel>
    </div>
  );
}
