import { z } from "zod";

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color, for example #128C7E")
  .optional()
  .or(z.literal(""));

const urlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    if (value.startsWith("/")) return !value.startsWith("//");

    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)
      );
    } catch {
      return false;
    }
  }, "Use a public HTTPS URL or a safe app-relative path")
  .optional()
  .or(z.literal(""));

export const partnerBrandingDraftSchema = z.object({
  partnerCompanyId: z.string().trim().min(1, "Partner company is required"),
  appName: z.string().trim().min(2).max(60),
  companyName: z.string().trim().max(100).optional().or(z.literal("")),
  logoUrl: urlSchema,
  logoDarkUrl: urlSchema,
  markUrl: urlSchema,
  faviconUrl: urlSchema,
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  accentColor: colorSchema,
  backgroundColor: colorSchema,
  textColor: colorSchema,
  supportName: z.string().trim().max(100).optional().or(z.literal("")),
  supportEmail: z.string().trim().email().optional().or(z.literal("")),
  supportPhone: z.string().trim().max(30).optional().or(z.literal("")),
  loginHeading: z.string().trim().max(140).optional().or(z.literal("")),
  loginDescription: z.string().trim().max(280).optional().or(z.literal("")),
  hideMetaWhatBranding: z.coerce.boolean().default(false),
});

export const partnerBrandingApprovalSchema = z.object({
  partnerCompanyId: z.string().trim().min(1, "Partner company is required"),
  action: z.enum(["submit", "approve", "reject", "disable"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export type PartnerBrandingDraftInput = z.infer<typeof partnerBrandingDraftSchema>;
export type PartnerBrandingApprovalInput = z.infer<
  typeof partnerBrandingApprovalSchema
>;
