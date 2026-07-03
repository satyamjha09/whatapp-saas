import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertUserPermission } from "@/server/services/rbac-v2.service";
import { getContactImportDashboard } from "@/server/services/contact-import.service";
import { ContactImportWizard } from "@/components/contacts/import/contact-import-wizard";

export default async function ContactImportPage() {
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

  const [dashboard, contactLists] = await Promise.all([
    getContactImportDashboard(context.membership.companyId),
    prisma.contactGroup.findMany({
      where: {
        companyId: context.membership.companyId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Import contacts"
        description="Upload a CSV or XLSX file, map columns, validate phone numbers, and import clean contacts ready for broadcasts."
      />

      <Panel>
        <ContactImportWizard contactLists={contactLists} />
      </Panel>

      <Panel className="mt-6">
        <PanelTitle
          title="Recent imports"
          description="Track the status of your latest contact imports."
        />

        <div className="mt-4 divide-y divide-[#E7F8EF]">
          {dashboard.jobs.map((job) => (
            <article key={job.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <StatusPill tone={statusTone(job.status)}>{job.status}</StatusPill>

                  <h3 className="mt-2 font-semibold text-[#081B3A]">
                    <Link
                      href={`/dashboard/contacts/import/${job.id}`}
                      className="hover:text-[#128C7E] hover:underline"
                    >
                      {job.fileName ?? "Contact import"}
                    </Link>
                  </h3>

                  <p className="mt-1 text-sm text-[#526173]">
                    Total {job.totalRows} · Valid {job.validRows} · Duplicates{" "}
                    {job.duplicateRows} · Imported {job.importedRows} · Failed{" "}
                    {job.failedRows}
                  </p>

                  {job.errorMessage && (
                    <p className="mt-2 text-sm text-rose-600">{job.errorMessage}</p>
                  )}
                </div>

                <p className="text-xs text-[#526173]">
                  {job.createdAt.toLocaleString()}
                </p>
              </div>
            </article>
          ))}

          {dashboard.jobs.length === 0 && (
            <div className="py-8 text-center text-sm text-[#526173]">
              No imports yet. Upload your first file above.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
