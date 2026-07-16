import { createPartnerApiGetRoute } from "@/server/partner-api/partner-api-route";
import { getPartnerApiClientUsage } from "@/server/services/partner-api.service";

type PartnerClientRouteContext = {
  params: Promise<{ clientId: string }>;
};

export function GET(request: Request, context: PartnerClientRouteContext) {
  return createPartnerApiGetRoute({
    requiredScope: "partner:usage:read",
    handler: async ({ partnerCompanyId }) => {
      const { clientId } = await context.params;
      return getPartnerApiClientUsage({
        partnerCompanyId,
        clientCompanyId: clientId,
      });
    },
  })(request);
}
