import { redirect } from "next/navigation";
import { PageHeader } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppCatalogsByCompany } from "@/server/services/whatsapp-catalog.service";
import WhatsAppCatalogManagementClient from "./whatsapp-catalog-management-client";

type CatalogsPageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;

  return Math.max(1, Math.floor(parsed));
}

export default async function CatalogsPage({
  searchParams,
}: CatalogsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const params = await searchParams;
  const page = parsePage(params?.page);
  const result = await getWhatsAppCatalogsByCompany({
    companyId: context.membership.companyId,
    page,
    pageSize: 20,
  });

  const serializedCatalogs = result.catalogs.map((catalog) => ({
    createdAt: catalog.createdAt.toISOString(),
    id: catalog.id,
    isUsable: catalog.isUsable,
    lastSyncedAt: catalog.lastSyncedAt?.toISOString() ?? null,
    metaCatalogId: catalog.metaCatalogId,
    name: catalog.name,
    productCount: catalog.productCount,
    remoteMissingAt: catalog.remoteMissingAt?.toISOString() ?? null,
    status: catalog.status,
    updatedAt: catalog.updatedAt.toISOString(),
    vertical: catalog.vertical,
    whatsAppAccount: {
      businessName: catalog.whatsAppAccount.businessName,
      id: catalog.whatsAppAccount.id,
      status: catalog.whatsAppAccount.status,
      wabaId: catalog.whatsAppAccount.wabaId,
    },
    whatsAppAccountId: catalog.whatsAppAccountId,
  }));

  return (
    <div>
      <PageHeader
        description="Sync Commerce Catalog metadata connected to your WhatsApp Business Account. Product sync and product sending come in later Catalog phases."
        eyebrow={context.membership.company.name}
        title="WhatsApp Catalogs"
      />

      <WhatsAppCatalogManagementClient
        canSync={
          context.membership.role === "OWNER" ||
          context.membership.role === "ADMIN"
        }
        catalogs={serializedCatalogs}
        connectedAccount={result.connectedAccount}
        pagination={result.pagination}
      />
    </div>
  );
}
