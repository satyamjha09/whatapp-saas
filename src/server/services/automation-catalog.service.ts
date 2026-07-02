export function buildAutomationCatalogPreview({
  catalogSource,
  maxProducts,
  productIds,
}: {
  catalogSource: string;
  maxProducts: number;
  productIds: string[];
}) {
  return {
    catalogSource,
    productIds: productIds.slice(0, maxProducts),
    simulatedCatalogSend: true,
  };
}
