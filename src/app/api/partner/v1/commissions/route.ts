import { createPartnerApiGetRoute } from "@/server/partner-api/partner-api-route";
import { listPartnerApiCommissions } from "@/server/services/partner-api.service";

export const GET = createPartnerApiGetRoute({
  requiredScope: "partner:commissions:read",
  handler: ({ partnerCompanyId }) => listPartnerApiCommissions(partnerCompanyId),
});
