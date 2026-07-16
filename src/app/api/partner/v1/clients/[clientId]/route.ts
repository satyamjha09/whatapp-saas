import {
  createPartnerApiGetRoute,
  createPartnerApiMutationRoute,
} from "@/server/partner-api/partner-api-route";
import {
  getPartnerApiClient,
  updatePartnerApiClient,
} from "@/server/services/partner-api.service";
import { partnerApiUpdateClientSchema } from "@/server/validators/partner-api.validator";

type PartnerClientRouteContext = {
  params: Promise<{ clientId: string }>;
};

export function GET(request: Request, context: PartnerClientRouteContext) {
  return createPartnerApiGetRoute({
    requiredScope: "partner:clients:read",
    handler: async ({ partnerCompanyId }) => {
      const { clientId } = await context.params;
      return getPartnerApiClient({ partnerCompanyId, clientCompanyId: clientId });
    },
  })(request);
}

export function PATCH(request: Request, context: PartnerClientRouteContext) {
  return createPartnerApiMutationRoute({
    requiredScope: "partner:clients:update",
    schema: partnerApiUpdateClientSchema,
    handler: async ({ apiKeyCreatedByUserId, body, partnerCompanyId }) => {
      const { clientId } = await context.params;
      return updatePartnerApiClient({
        partnerCompanyId,
        clientCompanyId: clientId,
        actorUserId: apiKeyCreatedByUserId,
        input: body,
      });
    },
  })(request);
}
