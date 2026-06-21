import { encryptText } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import type { CompleteWhatsAppEmbeddedSignupInput } from "@/server/validators/whatsapp-embedded-signup.validator";

type MetaError = {
  message?: string;
  type?: string;
  code?: number;
};

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: MetaError;
};

type MetaPhoneNumberResponse = {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  error?: MetaError;
};

type MetaSubscribedAppsResponse = {
  success?: boolean;
  error?: MetaError;
};

function getMetaGraphBaseUrl() {
  const version = process.env.WHATSAPP_API_VERSION ?? "v25.0";

  return `https://graph.facebook.com/${version}`;
}

export async function subscribeAppToWabaWebhooks(
  accessToken: string,
  wabaId: string,
) {
  const url = new URL(`${getMetaGraphBaseUrl()}/${wabaId}/subscribed_apps`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as MetaSubscribedAppsResponse;

  if (!response.ok || data.success !== true) {
    throw new Error(
      data.error?.message ?? "Unable to subscribe app to WABA webhooks",
    );
  }

  return { subscribed: true as const };
}

export async function exchangeEmbeddedSignupCodeForToken(code: string) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (
    !appId ||
    !appSecret ||
    appId === "your_meta_app_id" ||
    appSecret === "your_meta_app_secret"
  ) {
    throw new Error("Meta app credentials are not configured");
  }

  const url = new URL(`${getMetaGraphBaseUrl()}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const data = (await response.json()) as MetaTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error?.message ?? "Unable to exchange Meta authorization code",
    );
  }

  return data.access_token;
}

export async function getMetaPhoneNumberDetails(
  accessToken: string,
  phoneNumberId: string,
) {
  const url = new URL(`${getMetaGraphBaseUrl()}/${phoneNumberId}`);
  url.searchParams.set(
    "fields",
    "display_phone_number,verified_name,quality_rating",
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as MetaPhoneNumberResponse;

  if (!response.ok || !data.id) {
    throw new Error(
      data.error?.message ?? "Unable to fetch WhatsApp phone number details",
    );
  }

  return {
    phoneNumberId: data.id,
    displayPhoneNumber: data.display_phone_number ?? "",
    verifiedName: data.verified_name ?? null,
    qualityRating: data.quality_rating ?? null,
  };
}

export async function completeWhatsAppEmbeddedSignup(
  companyId: string,
  input: CompleteWhatsAppEmbeddedSignupInput,
) {
  const [conflictingWaba, conflictingPhoneNumber] = await Promise.all([
    prisma.whatsAppAccount.findFirst({
      where: {
        wabaId: input.wabaId,
        companyId: { not: companyId },
      },
      select: { id: true },
    }),
    prisma.whatsAppPhoneNumber.findFirst({
      where: {
        phoneNumberId: input.phoneNumberId,
        companyId: { not: companyId },
      },
      select: { id: true },
    }),
  ]);

  if (conflictingWaba) {
    throw new Error("This WhatsApp Business Account is already connected");
  }

  if (conflictingPhoneNumber) {
    throw new Error("This WhatsApp phone number is already connected");
  }

  const accessToken = await exchangeEmbeddedSignupCodeForToken(input.code);
  const webhookSubscription = await subscribeAppToWabaWebhooks(
    accessToken,
    input.wabaId,
  );
  const phoneDetails = await getMetaPhoneNumberDetails(
    accessToken,
    input.phoneNumberId,
  );
  const encryptedAccessToken = encryptText(accessToken);

  const result = await prisma.$transaction(async (tx) => {
    const existingAccount = await tx.whatsAppAccount.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });

    const account = existingAccount
      ? await tx.whatsAppAccount.update({
          where: { id: existingAccount.id },
          data: {
            wabaId: input.wabaId,
            accessToken: encryptedAccessToken,
            status: "CONNECTED",
          },
        })
      : await tx.whatsAppAccount.create({
          data: {
            companyId,
            wabaId: input.wabaId,
            accessToken: encryptedAccessToken,
            status: "CONNECTED",
          },
        });

    const phoneNumber = await tx.whatsAppPhoneNumber.upsert({
      where: { phoneNumberId: input.phoneNumberId },
      update: {
        companyId,
        whatsAppAccountId: account.id,
        displayPhoneNumber: phoneDetails.displayPhoneNumber,
        verifiedName: phoneDetails.verifiedName,
        qualityRating: phoneDetails.qualityRating,
      },
      create: {
        companyId,
        whatsAppAccountId: account.id,
        phoneNumberId: input.phoneNumberId,
        displayPhoneNumber: phoneDetails.displayPhoneNumber,
        verifiedName: phoneDetails.verifiedName,
        qualityRating: phoneDetails.qualityRating,
      },
    });

    return { account, phoneNumber };
  });

  return {
    accountId: result.account.id,
    wabaId: result.account.wabaId,
    status: result.account.status,
    phoneNumberId: result.phoneNumber.phoneNumberId,
    displayPhoneNumber: result.phoneNumber.displayPhoneNumber,
    verifiedName: result.phoneNumber.verifiedName,
    qualityRating: result.phoneNumber.qualityRating,
    webhooksSubscribed: webhookSubscription.subscribed,
  };
}
