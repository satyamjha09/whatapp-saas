import { z } from "zod";
import { createPartnerApiMutationRoute } from "@/server/partner-api/partner-api-route";
import { reactivatePartnerApiClient } from "@/server/services/partner-api.service";

type PartnerClientRouteContext = {
  params: Promise<{ clientId: string }>;
};

export function POST(request: Request, context: PartnerClientRouteContext) {
  return createPartnerApiMutationRoute({
    requiredScope: "partner:clients:suspend",
    schema: z.object({}).passthrough(),
    handler: async ({ apiKeyCreatedByUserId, partnerCompanyId }) => {
      const { clientId } = await context.params;
      return reactivatePartnerApiClient({
        partnerCompanyId,
        clientCompanyId: clientId,
        actorUserId: apiKeyCreatedByUserId,
      });
    },
  })(request);
}
