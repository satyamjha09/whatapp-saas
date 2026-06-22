import { z } from "zod";
import { DEVELOPER_API_SCOPES } from "@/server/config/developer-api-scopes";
import { isValidIpAllowlistEntry } from "@/server/utils/ip-allowlist";

const scopeIds = DEVELOPER_API_SCOPES.map((scope) => scope.id) as [
  string,
  ...string[],
];

const apiKeyBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "API key name must be at least 2 characters")
    .max(100, "API key name must be less than 100 characters"),
  scopes: z.array(z.enum(scopeIds)).min(1, "Select at least one scope"),
  allowedIps: z
    .array(z.string().trim())
    .max(50, "You can add maximum 50 allowed IP entries")
    .default([])
    .refine(
      (items) => items.every((item) => isValidIpAllowlistEntry(item)),
      "Allowed IPs must be valid IP addresses or IPv4 CIDR ranges",
    ),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const createApiKeySchema = apiKeyBaseSchema;

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const updateApiKeySchema = apiKeyBaseSchema;

export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
