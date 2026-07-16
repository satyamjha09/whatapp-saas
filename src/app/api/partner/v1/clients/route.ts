import {
  createPartnerApiGetRoute,
  createPartnerApiMutationRoute,
} from "@/server/partner-api/partner-api-route";
import {
  createPartnerApiClient,
  listPartnerApiClients,
} from "@/server/services/partner-api.service";
import { partnerApiCreateClientSchema } from "@/server/validators/partner-api.validator";

export const GET = createPartnerApiGetRoute({
  requiredScope: "partner:clients:read",
  handler: ({ partnerCompanyId }) => listPartnerApiClients(partnerCompanyId),
});

export const POST = createPartnerApiMutationRoute({
  requiredScope: "partner:clients:create",
  schema: partnerApiCreateClientSchema,
  successStatus: 202,
  handler: ({ apiKeyCreatedByUserId, body, partnerCompanyId, request }) =>
    createPartnerApiClient({
      partnerCompanyId,
      apiKeyCreatedByUserId,
      idempotencyKey: request.headers.get("idempotency-key"),
      input: body,
    }),
});
