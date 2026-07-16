import { createPartnerApiGetRoute } from "@/server/partner-api/partner-api-route";
import { listPartnerApiPayouts } from "@/server/services/partner-api.service";

export const GET = createPartnerApiGetRoute({
  requiredScope: "partner:payouts:read",
  handler: ({ partnerCompanyId }) => listPartnerApiPayouts(partnerCompanyId),
});
