import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  invalidateCachedUser,
  syncUser,
} from "@/server/services/auth.service";

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserWebhookData = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

function getPrimaryEmail(data: ClerkUserWebhookData) {
  return (
    data.email_addresses?.find(
      (email) => email.id === data.primary_email_address_id,
    )?.email_address ?? data.email_addresses?.[0]?.email_address
  );
}

function getFullName(data: ClerkUserWebhookData) {
  return [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
}

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request);

    if (
      event.type === "user.created" ||
      event.type === "user.updated" ||
      event.type === "user.deleted"
    ) {
      const data = event.data as ClerkUserWebhookData;

      if (event.type === "user.deleted") {
        await invalidateCachedUser(data.id);

        return NextResponse.json({
          message: "Clerk user cache invalidated",
        });
      }

      const email = getPrimaryEmail(data);

      if (!email) {
        return NextResponse.json(
          { message: "Clerk user has no email address" },
          { status: 400 },
        );
      }

      await syncUser({
        clerkUserId: data.id,
        email,
        name: getFullName(data),
        imageUrl: data.image_url ?? null,
      });

      return NextResponse.json({
        message: "Clerk user synced",
      });
    }

    return NextResponse.json({
      message: "Clerk webhook ignored",
    });
  } catch (error) {
    console.error(
      "CLERK_WEBHOOK_ERROR:",
      error instanceof Error ? error.message : error,
    );

    return NextResponse.json(
      { message: "Unable to process Clerk webhook" },
      { status: 400 },
    );
  }
}
