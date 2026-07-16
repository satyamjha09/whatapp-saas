import { createPartnerApiGetRoute } from "@/server/partner-api/partner-api-route";
import { listPartnerApiSubscriptions } from "@/server/services/partner-api.service";

export const GET = createPartnerApiGetRoute({
  requiredScope: "partner:subscriptions:read",
  handler: ({ partnerCompanyId }) => listPartnerApiSubscriptions(partnerCompanyId),
});
