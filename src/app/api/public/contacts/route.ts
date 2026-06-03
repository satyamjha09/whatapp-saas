import { NextResponse } from "next/server";
import { authenticatePublicApiRequest } from "@/server/auth/public-api";
import { createAuditLog } from "@/server/services/audit.service";
import {
  getContactsByCompany,
  upsertContactForCompany,
} from "@/server/services/contact.service";
import { createContactSchema } from "@/server/validators/contact.validator";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePublicApiRequest(request);

    if (!auth.success) {
      return auth.response;
    }

    const { apiKeyRecord } = auth;

    const contacts = await getContactsByCompany(apiKeyRecord.companyId);

    return NextResponse.json({
      success: true,
      data: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        countryCode: contact.countryCode,
        phoneNumber: contact.phoneNumber,
        fullPhoneNumber: `${contact.countryCode}${contact.phoneNumber}`,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      })),
    });
  } catch (error) {
    console.error("PUBLIC_GET_CONTACTS_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch contacts" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatePublicApiRequest(request);

    if (!auth.success) {
      return auth.response;
    }

    const { apiKeyRecord } = auth;

    const body: unknown = await request.json();

    const validation = createContactSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid contact details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const contact = await upsertContactForCompany(
      apiKeyRecord.companyId,
      validation.data,
    );

    await createAuditLog({
      companyId: apiKeyRecord.companyId,
      actorUserId: apiKeyRecord.createdByUserId,
      action: "public_api.contact.upserted",
      entityType: "Contact",
      entityId: contact.id,
      metadata: {
        apiKeyId: apiKeyRecord.id,
        apiKeyName: apiKeyRecord.name,
        phoneNumber: contact.phoneNumber,
        countryCode: contact.countryCode,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Contact saved successfully",
        data: {
          id: contact.id,
          name: contact.name,
          countryCode: contact.countryCode,
          phoneNumber: contact.phoneNumber,
          fullPhoneNumber: `${contact.countryCode}${contact.phoneNumber}`,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("PUBLIC_CREATE_CONTACT_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to save contact" },
      { status: 500 },
    );
  }
}
