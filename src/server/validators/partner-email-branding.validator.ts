import { z } from "zod";

const HOST_PATTERN =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeEmailDomain(input: string) {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0]
    ?.replace(/\.$/, "");

  if (!host || !HOST_PATTERN.test(host)) {
    throw new Error("Enter a valid public email domain, for example mail.partner.com.");
  }

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".ngrok-free.dev") ||
    host.endsWith(".local")
  ) {
    throw new Error("Use a production sender domain.");
  }

  return host;
}

export const partnerEmailBrandingDraftSchema = z.object({
  partnerCompanyId: z.string().min(1).optional(),
  fromName: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  fromAddress: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().max(255).optional(),
  ),
  replyTo: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().max(255).optional(),
  ),
  sendingDomain: z
    .preprocess(emptyToUndefined, z.string().max(253).optional())
    .transform((value, context) => {
      if (!value) return undefined;
      try {
        return normalizeEmailDomain(value);
      } catch (error) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            error instanceof Error ? error.message : "Sender domain is invalid.",
        });
        return z.NEVER;
      }
    }),
  footerText: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  logoUrl: z.preprocess(emptyToUndefined, z.string().trim().url().max(1000).optional()),
});

export const partnerEmailBrandingActionSchema = z.object({
  partnerCompanyId: z.string().min(1).optional(),
  action: z.enum(["check_dns", "verify", "disable"]),
});

export type PartnerEmailBrandingDraftInput = z.infer<
  typeof partnerEmailBrandingDraftSchema
>;

export type PartnerEmailBrandingActionInput = z.infer<
  typeof partnerEmailBrandingActionSchema
>;
