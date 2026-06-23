import { z } from "zod";
import { createPublicApiMutationRoute } from "@/server/public-api/public-api-route";
import { createQueuedPublicTemplateMessage } from "@/server/services/message.service";
import { createAuditLog } from "@/server/services/audit.service";

const SendTemplateSchema = z.object({
  to: z.string().trim().min(8).max(20).regex(/^\d+$/),
  templateName: z.string().trim().min(1).max(200),
  language: z.string().trim().min(2).max(20).default("en_US"),
  bodyParameters: z.array(z.string().trim().min(1)).default([]),
  contactName: z.string().trim().min(2).max(100).optional(),
});

export const POST = createPublicApiMutationRoute({
  schema: SendTemplateSchema,
  requiredScope: "MESSAGES_WRITE",
  successStatus: 201,
  async handler({ body, companyId, apiKeyId }) {
    const message = await createQueuedPublicTemplateMessage(companyId, {
      to: body.to,
      templateName: body.templateName,
      language: body.language,
      variables: body.bodyParameters,
      contactName: body.contactName,
    });

    await createAuditLog({
      companyId,
      action: "public_api_v1.message.queued",
      entityType: "Message",
      entityId: message.id,
      metadata: {
        apiKeyId,
        templateName: body.templateName,
        language: body.language,
      },
    });

    return { messageId: message.id, status: message.status };
  },
});
