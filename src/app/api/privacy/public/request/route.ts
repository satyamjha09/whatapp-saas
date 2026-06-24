import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicPrivacyVerification } from "@/server/services/public-privacy-portal.service";
import {
  createRequestBodyErrorResponse,
  readRequestJsonWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";
import { getRequestIp } from "@/server/utils/request-ip";

const PublicPrivacyRequestSchema = z.object({
  email: z.string().email().max(320),
  phoneNumber: z.string().min(8).max(20),
  countryCode: z.string().min(1).max(5).default("91"),
  intent: z.enum(["CONTACT_EXPORT", "CONTACT_DELETE"]),
  reason: z.string().max(1000).optional().nullable(),
});

export async function POST(request: Request) {
  let body;

  try {
    body = PublicPrivacyRequestSchema.parse(
      await readRequestJsonWithLimit({
        request,
        maxBytes: REQUEST_BODY_LIMITS.json(),
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Invalid privacy request",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return createRequestBodyErrorResponse({
      request,
      error,
      source: "public-privacy-portal",
    });
  }

  try {
    await createPublicPrivacyVerification({
      email: body.email,
      phoneNumber: body.phoneNumber,
      countryCode: body.countryCode,
      intent: body.intent,
      reason: body.reason,
      requesterIp: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit privacy request",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Please check your email to confirm your privacy request.",
  });
}
