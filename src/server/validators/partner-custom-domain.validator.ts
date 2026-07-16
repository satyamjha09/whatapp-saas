import { z } from "zod";

const HOST_PATTERN =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeCustomDomain(input: string) {
  const trimmed = input.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const host = withoutProtocol.split("/")[0]?.split(":")[0]?.replace(/\.$/, "");

  if (!host || !HOST_PATTERN.test(host)) {
    throw new Error("Enter a valid public domain, for example app.partner.com.");
  }

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metawhat.in" ||
    host.endsWith(".ngrok-free.dev") ||
    host.endsWith(".local")
  ) {
    throw new Error("Use a production customer-facing domain.");
  }

  return host;
}

export const partnerCustomDomainCreateSchema = z.object({
  partnerCompanyId: z.string().min(1).optional(),
  domain: z
    .string()
    .min(4)
    .max(253)
    .transform((value, context) => {
      try {
        return normalizeCustomDomain(value);
      } catch (error) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            error instanceof Error ? error.message : "Domain is invalid.",
        });
        return z.NEVER;
      }
    }),
});

export const partnerCustomDomainActionSchema = z.object({
  partnerCompanyId: z.string().min(1).optional(),
  domainId: z.string().min(1),
  action: z.enum([
    "verify_dns",
    "submit",
    "approve",
    "reject",
    "disable",
    "check_health",
  ]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export type PartnerCustomDomainCreateInput = z.infer<
  typeof partnerCustomDomainCreateSchema
>;

export type PartnerCustomDomainActionInput = z.infer<
  typeof partnerCustomDomainActionSchema
>;
