import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionButtonClass, PageHeader } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCatalogProducts } from "@/server/services/whatsapp-catalog.service";
import CatalogProductsClient from "./catalog-products-client";

type CatalogProductsPageProps = {
  params: Promise<{
    catalogId: string;
  }>;
  searchParams?: Promise<{
    availability?: string;
    page?: string;
    search?: string;
    usableOnly?: string;
  }>;
};

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;

  return Math.max(1, Math.floor(parsed));
}

function serializeDecimal(value: { toString(): string } | null) {
  return value ? value.toString() : null;
}

export default async function CatalogProductsPage({
  params,
  searchParams,
}: CatalogProductsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const [{ catalogId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const result = await getCatalogProducts({
    availability: resolvedSearchParams?.availability,
    catalogId,
    companyId: context.membership.companyId,
    page: parsePage(resolvedSearchParams?.page),
    pageSize: 20,
    search: resolvedSearchParams?.search,
    usableOnly: resolvedSearchParams?.usableOnly === "true",
  }).catch((error) => {
    if (error instanceof Error && error.message.includes("Catalog not found")) {
      notFound();
    }

    throw error;
  });

  const products = result.products.map((product) => ({
    availability: product.availability,
    brand: product.brand,
    category: product.category,
    condition: product.condition,
    currency: product.currency,
    description: product.description,
    id: product.id,
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    isUsable: product.isUsable,
    lastSyncedAt: product.lastSyncedAt?.toISOString() ?? null,
    metaProductId: product.metaProductId,
    name: product.name,
    priceAmount: serializeDecimal(product.priceAmount),
    productUrl: product.productUrl,
    remoteMissingAt: product.remoteMissingAt?.toISOString() ?? null,
    retailerId: product.retailerId,
    updatedAt: product.updatedAt.toISOString(),
  }));

  const catalog = {
    id: result.catalog.id,
    isUsable: result.catalog.isUsable,
    lastSyncedAt: result.catalog.lastSyncedAt?.toISOString() ?? null,
    metaCatalogId: result.catalog.metaCatalogId,
    name: result.catalog.name,
    productCount: result.catalog.productCount,
    remoteMissingAt: result.catalog.remoteMissingAt?.toISOString() ?? null,
    status: result.catalog.status,
    vertical: result.catalog.vertical,
    whatsAppAccount: result.catalog.whatsAppAccount,
  };

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/catalogs"
            >
              Back to Catalogs
            </Link>
            <button
              className={actionButtonClass("secondary")}
              disabled
              type="button"
              title="Catalog template builder comes in the next Catalog phase"
            >
              Use in Template
            </button>
          </>
        }
        description="Search and manage the local product cache synced from Meta. Products are not sent from this page yet."
        eyebrow={context.membership.company.name}
        title={catalog.name}
      />

      <CatalogProductsClient
        availabilityOptions={result.availabilityOptions}
        canSync={
          context.membership.role === "OWNER" ||
          context.membership.role === "ADMIN"
        }
        catalog={catalog}
        filters={{
          availability: resolvedSearchParams?.availability ?? "ALL",
          search: resolvedSearchParams?.search ?? "",
          usableOnly: resolvedSearchParams?.usableOnly === "true",
        }}
        pagination={result.pagination}
        products={products}
      />
    </div>
  );
}
