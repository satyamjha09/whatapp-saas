import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { sendBulkTemplateMessageSchema } from "@/server/validators/bulk-message.validator";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";
import {
  createRequestBodyErrorResponse,
  readRequestJsonWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";

export async function POST(request: Request) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.campaignPreflight,
  });

  if (isRateLimitResponse(rateLimit)) {
    return rateLimit;
  }

  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!context.membership) {
    return NextResponse.json(
      { message: "Complete company onboarding first" },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await readRequestJsonWithLimit({
      request,
      maxBytes: REQUEST_BODY_LIMITS.bulkMessage(),
    });
  } catch (error) {
    return createRequestBodyErrorResponse({
      request,
      error,
      source: "campaign-preflight",
    });
  }

  const validation = sendBulkTemplateMessageSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        message: "Invalid bulk message details",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const input = validation.data;
  const template = await prisma.template.findFirst({
    where: {
      id: input.templateId,
      companyId: context.membership.companyId,
      status: "APPROVED",
    },
    select: {
      category: true,
    },
  });

  if (!template) {
    return NextResponse.json(
      { message: "Approved template not found" },
      { status: 400 },
    );
  }

  const plan = getBillingPlanConfig(context.membership.company.billingPlan);
  const groupRecipients = input.groupId
    ? await prisma.contactGroupMember.findMany({
        where: {
          groupId: input.groupId,
          group: {
            companyId: context.membership.companyId,
          },
        },
        take: plan.maxBulkRecipients + 1,
        include: {
          contact: true,
        },
      })
    : [];

  const contacts = input.groupId
    ? groupRecipients.map((member) => member.contact)
    : await prisma.contact.findMany({
        where: {
          companyId: context.membership.companyId,
          phoneNumber: {
            in: input.recipients.map((recipient) =>
              recipient.phoneNumber.replace(/\D/g, ""),
            ),
          },
        },
      });

  const contactByPhone = new Map(
    contacts.map((contact) => [contact.phoneNumber, contact]),
  );
  const uniquePhones = new Set(
    (input.groupId
      ? contacts.map((contact) => contact.phoneNumber)
      : input.recipients.map((recipient) =>
          recipient.phoneNumber.replace(/\D/g, ""),
        )
    ).filter(Boolean),
  );
  let missingMarketingConsent = 0;

  if (
    template.category === "MARKETING" &&
    process.env.CONSENT_LEDGER_ENABLED !== "false" &&
    process.env.CONSENT_REQUIRE_MARKETING_OPT_IN !== "false"
  ) {
    for (const phoneNumber of uniquePhones) {
      const contact = contactByPhone.get(phoneNumber);

      if (
        !contact ||
        contact.isBlocked ||
        contact.optedOutAt ||
        contact.marketingConsentStatus !== "GRANTED"
      ) {
        missingMarketingConsent += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    missingMarketingConsent,
  });
}
