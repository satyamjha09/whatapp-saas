import { createPartnerApiGetRoute } from "@/server/partner-api/partner-api-route";
import { listPartnerApiInvoices } from "@/server/services/partner-api.service";

export const GET = createPartnerApiGetRoute({
  requiredScope: "partner:invoices:read",
  handler: ({ partnerCompanyId }) => listPartnerApiInvoices(partnerCompanyId),
});
