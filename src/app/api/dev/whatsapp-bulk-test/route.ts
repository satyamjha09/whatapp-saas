import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBulkTemplateMessages } from "@/server/services/bulk-message.service";

const testRecipients = [
  { countryCode: "91", phoneNumber: "8178444398", name: "Test 8178444398" },
  { countryCode: "91", phoneNumber: "8826826645", name: "Test 8826826645" },
  { countryCode: "91", phoneNumber: "8373946470", name: "Test 8373946470" },
  { countryCode: "91", phoneNumber: "8375938947", name: "Test 8375938947" },
];

function assertDevOnly() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "Developer WhatsApp bulk test is disabled in production." },
      { status: 404 },
    );
  }

  return null;
}

export async function POST() {
  try {
    const devOnlyResponse = assertDevOnly();
    if (devOnlyResponse) return devOnlyResponse;

    const company = await prisma.company.findFirst({
      where: {
        status: "ACTIVE",
        whatsAppAccounts: {
          some: {
            status: "CONNECTED",
            accessToken: { not: null },
            phoneNumbers: {
              some: { phoneNumberId: { not: null } },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { message: "No connected WhatsApp company found. Run the dev seed first." },
        { status: 400 },
      );
    }

    const template = await prisma.template.findFirst({
      where: {
        companyId: company.id,
        name: "hello_world",
        language: "en_US",
        status: "APPROVED",
      },
      select: {
        id: true,
        name: true,
        language: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { message: "Approved hello_world template not found. Run the dev seed first." },
        { status: 400 },
      );
    }

    const result = await sendBulkTemplateMessages(company.id, {
      templateId: template.id,
      recipients: testRecipients.map((recipient) => ({
        ...recipient,
        bodyParameters: [],
      })),
      bodyParameters: [],
      groupId: null,
      scheduledAt: null,
    });

    return NextResponse.json({
      message: "Developer bulk messages queued successfully.",
      company,
      template,
      result: {
        batchId: result.batch.id,
        requestedCount: result.requestedCount,
        queuedCount: result.queuedCount,
        failedCount: result.failedCount,
        skippedDuplicateCount: result.skippedDuplicateCount,
        skippedBlockedCount: result.skippedBlockedCount,
        missingMarketingConsent: result.missingMarketingConsent,
        status: result.batch.status,
      },
    });
  } catch (error) {
    console.error("DEV_WHATSAPP_BULK_TEST_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to queue developer bulk messages.",
      },
      { status: 500 },
    );
  }
}
