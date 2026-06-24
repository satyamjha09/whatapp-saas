import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPublicApiMutationRoute } from "@/server/public-api/public-api-route";
import { recordContactConsent } from "@/server/services/contact-consent.service";
import { getRequestIp } from "@/server/utils/request-ip";

const PublicConsentSchema = z.object({
  phoneNumber: z.string().trim().min(7).max(20),
  countryCode: z.string().trim().min(1).max(5).default("91"),
  type: z.enum(["WHATSAPP_MARKETING", "WHATSAPP_UTILITY", "WHATSAPP_SERVICE"]),
  status: z.enum(["GRANTED", "REVOKED"]),
  evidenceText: z.string().max(2000).optional().nullable(),
  evidenceUrl: z.string().url().optional().nullable(),
});

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export const POST = createPublicApiMutationRoute({
  schema: PublicConsentSchema,
  requiredScope: "CONTACTS_WRITE",
  successStatus: 201,
  async handler({ body, companyId, request }) {
    const contact = await prisma.contact.findFirst({
      where: {
        companyId,
        phoneNumber: digits(body.phoneNumber),
        countryCode: digits(body.countryCode),
      },
    });

    if (!contact) {
      throw new Error("Contact not found");
    }

    const event = await recordContactConsent({
      companyId,
      contactId: contact.id,
      type: body.type,
      status: body.status,
      source: "PUBLIC_API",
      evidenceText: body.evidenceText,
      evidenceUrl: body.evidenceUrl,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return {
      consentEventId: event?.id,
      contactId: contact.id,
      type: body.type,
      status: body.status,
    };
  },
});
