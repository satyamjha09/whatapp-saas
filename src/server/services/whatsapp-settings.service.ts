import axios from "axios";
import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  encryptSecret,
  getActiveEncryptionKeyId,
} from "@/server/security/secret-encryption";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import { subscribeAppToWabaWebhooks } from "@/server/services/whatsapp-embedded-signup.service";
import { UpdateWhatsAppSettingsInput } from "@/server/validators/whatsapp-settings.validator";

export async function getWhatsAppSettingsByCompany(companyId: string) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
    },
    include: {
      phoneNumbers: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });

  if (!account) {
    return {
      accountId: null,
      status: "PENDING" as const,
      wabaId: "",
      hasAccessToken: false,
      phoneNumberId: "",
      displayPhoneNumber: "",
      verifiedName: "",
      qualityRating: "",
    };
  }

  const phoneNumber = account.phoneNumbers[0];

  return {
    accountId: account.id,
    status: account.status,
    wabaId: account.wabaId ?? "",
    hasAccessToken: Boolean(account.accessToken),
    phoneNumberId: phoneNumber?.phoneNumberId ?? "",
    displayPhoneNumber: phoneNumber?.displayPhoneNumber ?? "",
    verifiedName: phoneNumber?.verifiedName ?? "",
    qualityRating: phoneNumber?.qualityRating ?? "",
  };
}

export async function updateWhatsAppSettings(
  companyId: string,
  input: UpdateWhatsAppSettingsInput,
) {
  const existingAccount = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
    },
    include: {
      phoneNumbers: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });

  if (!existingAccount?.accessToken && !input.accessToken) {
    throw new Error("Access token is required for first setup");
  }

  const conflictingWaba = await prisma.whatsAppAccount.findFirst({
    where: {
      wabaId: input.wabaId,
      NOT: existingAccount
        ? {
            id: existingAccount.id,
          }
        : undefined,
    },
    select: {
      companyId: true,
    },
  });

  if (conflictingWaba && conflictingWaba.companyId !== companyId) {
    throw new Error("WABA ID is already connected to another workspace");
  }

  const conflictingPhone = await prisma.whatsAppPhoneNumber.findUnique({
    where: {
      phoneNumberId: input.phoneNumberId,
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (conflictingPhone && conflictingPhone.companyId !== companyId) {
    throw new Error(
      "Phone Number ID is already connected to another workspace",
    );
  }

  const encryptedToken = input.accessToken
    ? encryptSecret({
        plaintext: input.accessToken,
        purpose: "whatsapp_access_token",
      })
    : undefined;
  const accessTokenKeyId = encryptedToken ? getActiveEncryptionKeyId() : undefined;
  const accessTokenEncryptedAt = encryptedToken ? new Date() : undefined;

  await prisma.$transaction(async (tx) => {
    const account = existingAccount
      ? await tx.whatsAppAccount.update({
          where: {
            id: existingAccount.id,
          },
          data: {
            wabaId: input.wabaId,
            status: "CONNECTED",
            ...(encryptedToken
              ? {
                  accessToken: encryptedToken,
                  accessTokenKeyId,
                  accessTokenEncryptedAt,
                }
              : {}),
          },
        })
      : await tx.whatsAppAccount.create({
          data: {
            companyId,
            wabaId: input.wabaId,
            status: "CONNECTED",
            accessToken: encryptedToken,
            accessTokenKeyId,
            accessTokenEncryptedAt,
          },
        });

    const existingPhone = existingAccount?.phoneNumbers[0];

    if (existingPhone) {
      await tx.whatsAppPhoneNumber.update({
        where: {
          id: existingPhone.id,
        },
        data: {
          phoneNumberId: input.phoneNumberId,
          displayPhoneNumber: input.displayPhoneNumber,
        },
      });
    } else {
      await tx.whatsAppPhoneNumber.create({
        data: {
          companyId,
          whatsAppAccountId: account.id,
          phoneNumberId: input.phoneNumberId,
          displayPhoneNumber: input.displayPhoneNumber,
        },
      });
    }
  });

  return getWhatsAppSettingsByCompany(companyId);
}

export async function testWhatsAppConnection(companyId: string) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
    },
    include: {
      phoneNumbers: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });
  const phoneNumber = account?.phoneNumbers[0];

  if (!account?.accessToken || !account.wabaId || !phoneNumber?.phoneNumberId) {
    throw new Error("WhatsApp credentials are incomplete");
  }

  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const response = await axios.get(
    `https://graph.facebook.com/${apiVersion}/${phoneNumber.phoneNumberId}`,
    {
      params: {
        fields: "id,display_phone_number,verified_name,quality_rating",
      },
      headers: {
        Authorization: `Bearer ${decryptSecret({
          encrypted: account.accessToken,
          purpose: "whatsapp_access_token",
        })}`,
      },
    },
  );

  const displayPhoneNumber = String(
    response.data.display_phone_number ?? phoneNumber.displayPhoneNumber ?? "",
  );
  const verifiedName = String(response.data.verified_name ?? "");
  const qualityRating = String(response.data.quality_rating ?? "UNKNOWN");

  await prisma.whatsAppPhoneNumber.update({
    where: {
      id: phoneNumber.id,
    },
    data: {
      displayPhoneNumber,
      verifiedName: verifiedName || null,
      qualityRating,
    },
  });

  return {
    connected: true,
    phoneNumberId: String(response.data.id ?? phoneNumber.phoneNumberId),
    displayPhoneNumber,
    verifiedName,
    qualityRating,
  };
}

export async function subscribeCurrentWhatsAppAccountToWebhooks(
  companyId: string,
) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });

  if (!account?.wabaId || !account.accessToken) {
    throw new Error("WhatsApp account is not connected");
  }

  await subscribeAppToWabaWebhooks(
    await getWhatsAppAccessToken({ companyId }),
    account.wabaId,
  );

  return {
    subscribed: true as const,
    accountId: account.id,
    wabaId: account.wabaId,
  };
}
