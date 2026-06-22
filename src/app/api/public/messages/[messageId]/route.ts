import { NextResponse } from "next/server";
import {
  authenticatePublicApiRequest,
  requirePublicApiScope,
} from "@/server/auth/public-api";
import { getMessageByCompany } from "@/server/services/message.service";

type PublicMessageStatusRouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: PublicMessageStatusRouteContext,
) {
  try {
    const auth = await authenticatePublicApiRequest(request);

    if (!auth.success) {
      return auth.response;
    }

    const { apiKeyRecord } = auth;
    const scopeResponse = await requirePublicApiScope({
      request,
      apiKeyRecord,
      requiredScope: "MESSAGES_READ",
    });

    if (scopeResponse) {
      return scopeResponse;
    }

    const { messageId } = await params;

    const message = await getMessageByCompany(
      messageId,
      apiKeyRecord.companyId,
    );

    if (!message) {
      return NextResponse.json(
        { success: false, message: "Message not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: message.id,
        status: message.status,
        direction: message.direction,
        toPhoneNumber: message.toPhoneNumber,
        body: message.body,
        variables: message.variables,
        metaMessageId: message.metaMessageId,
        template: message.template
          ? {
              id: message.template.id,
              name: message.template.name,
              language: message.template.language,
            }
          : null,
        contact: {
          id: message.contact.id,
          name: message.contact.name,
          countryCode: message.contact.countryCode,
          phoneNumber: message.contact.phoneNumber,
        },
        events: message.events.map((event) => ({
          id: event.id,
          status: event.status,
          raw: event.raw,
          createdAt: event.createdAt,
        })),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
    });
  } catch (error) {
    console.error("PUBLIC_GET_MESSAGE_STATUS_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch message status" },
      { status: 500 },
    );
  }
}
