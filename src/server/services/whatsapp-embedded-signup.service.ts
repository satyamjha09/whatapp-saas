import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  encryptSecret,
  getActiveEncryptionKeyId,
} from "@/server/security/secret-encryption";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  CompleteWhatsAppEmbeddedSignupInput,
  SaveWhatsAppEmbeddedSignupEventInput,
} from "@/server/validators/whatsapp-embedded-signup.validator";

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
  messaging_limit_tier?: string;
  code_verification_status?: string;
  name_status?: string;
  platform_type?: string;
  throughput?: unknown;
  health_status?: unknown;
  status?: string;
  error?: MetaError;
};

type MetaPhoneNumbersResponse = {
  data?: MetaPhoneNumberResponse[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
  error?: MetaError;
};

type MetaSubscribedAppsResponse = {
  success?: boolean;
  error?: MetaError;
};

type MetaDebugTokenResponse = {
  data?: {
    granular_scopes?: Array<{
      scope?: string;
      target_ids?: string[];
    }>;
  };
  error?: MetaError;
};

type MetaBusiness = {
  id?: string;
  name?: string;
};

type MetaBusinessesResponse = {
  data?: MetaBusiness[];
  error?: MetaError;
};

type MetaWaba = {
  id?: string;
  name?: string;
};

type MetaWabasResponse = {
  data?: MetaWaba[];
  error?: MetaError;
};

type MetaPhoneNumberDetails = {
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string | null;
  qualityRating: string | null;
  messagingLimitTier: string | null;
  numberType: string | null;
  codeVerificationStatus: string | null;
  nameStatus: string | null;
  platformType: string | null;
  throughput: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  healthStatus: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  canSendMessage: string | null;
};

type DiscoveredWaba = {
  businessId: string | null;
  businessName: string | null;
  wabaId: string;
  wabaName: string | null;
  phoneNumbers: MetaPhoneNumberDetails[];
  source: string;
};

function getMetaGraphBaseUrl() {
  const version = process.env.WHATSAPP_API_VERSION ?? "v25.0";

  return `https://graph.facebook.com/${version}`;
}

function safeJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return JSON.parse(
    JSON.stringify(redactSensitiveData(value)),
  ) as Prisma.InputJsonValue;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metaErrorMessage(data: { error?: MetaError }, fallback: string) {
  return data.error?.message ?? fallback;
}

function normalizePhoneNumber(
  phoneNumber: MetaPhoneNumberResponse,
): MetaPhoneNumberDetails | null {
  if (!phoneNumber.id) return null;

  const healthStatus =
    phoneNumber.health_status && typeof phoneNumber.health_status === "object"
      ? (phoneNumber.health_status as Record<string, unknown>)
      : null;
  const canSendMessage =
    stringOrNull(healthStatus?.can_send_message) ??
    stringOrNull(healthStatus?.canSendMessage) ??
    stringOrNull(phoneNumber.status);

  return {
    phoneNumberId: phoneNumber.id,
    displayPhoneNumber: phoneNumber.display_phone_number ?? "",
    verifiedName: phoneNumber.verified_name ?? null,
    qualityRating: phoneNumber.quality_rating ?? null,
    messagingLimitTier: phoneNumber.messaging_limit_tier ?? null,
    numberType: phoneNumber.platform_type ?? null,
    codeVerificationStatus: phoneNumber.code_verification_status ?? null,
    nameStatus: phoneNumber.name_status ?? null,
    platformType: phoneNumber.platform_type ?? null,
    throughput: safeJson(phoneNumber.throughput),
    healthStatus: safeJson(phoneNumber.health_status),
    canSendMessage,
  };
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

export async function exchangeEmbeddedSignupCodeForToken(
  code: string,
  redirectUri?: string | null,
) {
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
  if (redirectUri) {
    url.searchParams.set("redirect_uri", redirectUri);
  }

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

export async function getMetaPhoneNumbers(accessToken: string, wabaId: string) {
  const seenCursors = new Set<string>();
  let after: string | undefined;
  const phoneNumbers: MetaPhoneNumberDetails[] = [];

  do {
    const url = new URL(`${getMetaGraphBaseUrl()}/${wabaId}/phone_numbers`);
    url.searchParams.set(
      "fields",
      "id,display_phone_number,verified_name,quality_rating",
    );
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const data = (await response.json()) as MetaPhoneNumbersResponse;

    if (!response.ok || data.error) {
      throw new Error(
        metaErrorMessage(data, "Unable to fetch WhatsApp phone number details"),
      );
    }

    phoneNumbers.push(
      ...(data.data ?? [])
        .map((item) => normalizePhoneNumber(item))
        .filter((item): item is MetaPhoneNumberDetails => Boolean(item)),
    );

    const nextCursor = data.paging?.next
      ? data.paging.cursors?.after
      : undefined;

    if (!nextCursor || seenCursors.has(nextCursor)) {
      after = undefined;
    } else {
      seenCursors.add(nextCursor);
      after = nextCursor;
    }
  } while (after);

  return phoneNumbers;
}

export async function getMetaPhoneNumberDetails(
  accessToken: string,
  wabaId: string,
  phoneNumberId: string,
) {
  const phoneNumbers = await getMetaPhoneNumbers(accessToken, wabaId);
  const phoneNumber = phoneNumbers.find(
    (item) => item.phoneNumberId === phoneNumberId,
  );

  if (phoneNumber) {
    return phoneNumber;
  }

  throw new Error("Selected phone number does not belong to the selected WABA");
}

async function fetchMetaJson<T>(url: URL, accessToken: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as T & { error?: MetaError };

  if (!response.ok || data.error) {
    throw new Error(metaErrorMessage(data, "Meta Graph request failed"));
  }

  return data;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function discoverWabasFromDebugToken(accessToken: string) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return [];
  }

  const url = new URL(`${getMetaGraphBaseUrl()}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  try {
    const data = await fetchMetaJson<MetaDebugTokenResponse>(url, accessToken);
    const targetIds =
      data.data?.granular_scopes
        ?.filter((scope) => scope.scope?.includes("whatsapp"))
        .flatMap((scope) => scope.target_ids ?? []) ?? [];

    return uniqueValues(targetIds);
  } catch {
    return [];
  }
}

async function discoverBusinessWabas(accessToken: string) {
  const baseUrl = getMetaGraphBaseUrl();
  const businessesUrl = new URL(`${baseUrl}/me/businesses`);
  businessesUrl.searchParams.set("fields", "id,name");
  businessesUrl.searchParams.set("limit", "100");

  try {
    const businesses = await fetchMetaJson<MetaBusinessesResponse>(
      businessesUrl,
      accessToken,
    );
    const discovered: DiscoveredWaba[] = [];

    for (const business of businesses.data ?? []) {
      if (!business.id) continue;

      for (const edge of [
        "owned_whatsapp_business_accounts",
        "client_whatsapp_business_accounts",
      ]) {
        const url = new URL(`${baseUrl}/${business.id}/${edge}`);
        url.searchParams.set("fields", "id,name");
        url.searchParams.set("limit", "100");

        try {
          const wabas = await fetchMetaJson<MetaWabasResponse>(url, accessToken);

          for (const waba of wabas.data ?? []) {
            if (!waba.id) continue;

            let phoneNumbers: MetaPhoneNumberDetails[] = [];

            try {
              phoneNumbers = await getMetaPhoneNumbers(accessToken, waba.id);
            } catch {
              phoneNumbers = [];
            }

            discovered.push({
              businessId: business.id,
              businessName: business.name ?? null,
              wabaId: waba.id,
              wabaName: waba.name ?? null,
              phoneNumbers,
              source: edge,
            });
          }
        } catch {
          continue;
        }
      }
    }

    return discovered;
  } catch {
    return [];
  }
}

async function discoverEmbeddedSignupAssets(accessToken: string) {
  const discovered = new Map<string, DiscoveredWaba>();

  for (const wabaId of await discoverWabasFromDebugToken(accessToken)) {
    let phoneNumbers: MetaPhoneNumberDetails[] = [];

    try {
      phoneNumbers = await getMetaPhoneNumbers(accessToken, wabaId);
    } catch {
      phoneNumbers = [];
    }

    discovered.set(wabaId, {
      businessId: null,
      businessName: null,
      wabaId,
      wabaName: null,
      phoneNumbers,
      source: "debug_token",
    });
  }

  for (const waba of await discoverBusinessWabas(accessToken)) {
    const existing = discovered.get(waba.wabaId);

    discovered.set(waba.wabaId, {
      ...waba,
      phoneNumbers:
        waba.phoneNumbers.length > 0
          ? waba.phoneNumbers
          : existing?.phoneNumbers ?? [],
      source: existing ? `${existing.source},${waba.source}` : waba.source,
    });
  }

  return [...discovered.values()];
}

function resolveDiscoveredSignupSelection({
  discovered,
  phoneNumberId,
  wabaId,
}: {
  discovered: DiscoveredWaba[];
  wabaId: string | null;
  phoneNumberId: string | null;
}) {
  const wabasWithPhones = discovered.filter(
    (item) => item.phoneNumbers.length > 0,
  );
  const allPhones = wabasWithPhones.flatMap((waba) =>
    waba.phoneNumbers.map((phone) => ({ waba, phone })),
  );

  if (wabaId) {
    const selectedWaba = discovered.find((item) => item.wabaId === wabaId);

    if (!selectedWaba) {
      throw new Error(
        "Selected WhatsApp Business Account was not found in Meta discovery",
      );
    }

    const selectedPhone = phoneNumberId
      ? selectedWaba.phoneNumbers.find(
          (phone) => phone.phoneNumberId === phoneNumberId,
        )
      : selectedWaba.phoneNumbers[0];

    if (!selectedPhone) {
      throw new Error(
        "Selected WhatsApp Business Account has no discoverable phone number",
      );
    }

    return {
      wabaId: selectedWaba.wabaId,
      phoneNumberId: selectedPhone.phoneNumberId,
      phoneDetails: selectedWaba.phoneNumbers,
      discoverySource: selectedWaba.source,
    };
  }

  if (phoneNumberId) {
    const match = allPhones.find(
      ({ phone }) => phone.phoneNumberId === phoneNumberId,
    );

    if (!match) {
      throw new Error("Selected phone number was not found in Meta discovery");
    }

    return {
      wabaId: match.waba.wabaId,
      phoneNumberId: match.phone.phoneNumberId,
      phoneDetails: match.waba.phoneNumbers,
      discoverySource: match.waba.source,
    };
  }

  if (wabasWithPhones.length === 1) {
    const selectedWaba = wabasWithPhones[0];
    const selectedPhone = selectedWaba?.phoneNumbers[0];

    if (!selectedWaba || !selectedPhone) {
      throw new Error(
        "Meta returned authorization code but no WhatsApp phone number could be discovered.",
      );
    }

    return {
      wabaId: selectedWaba.wabaId,
      phoneNumberId: selectedPhone.phoneNumberId,
      phoneDetails: selectedWaba.phoneNumbers,
      discoverySource: selectedWaba.source,
    };
  }

  if (allPhones.length === 1) {
    const match = allPhones[0];

    if (!match) {
      throw new Error(
        "Meta returned authorization code but no WhatsApp phone number could be discovered.",
      );
    }

    return {
      wabaId: match.waba.wabaId,
      phoneNumberId: match.phone.phoneNumberId,
      phoneDetails: match.waba.phoneNumbers,
      discoverySource: match.waba.source,
    };
  }

  if (allPhones.length > 1) {
    throw new Error(
      "Meta returned authorization code but no selected WABA/phone. Multiple WhatsApp phone numbers were discovered, so please finish phone selection in the Meta popup.",
    );
  }

  throw new Error(
    "Meta returned authorization code but no WhatsApp Business Account or phone number could be discovered.",
  );
}

export async function recordWhatsAppEmbeddedSignupEvent({
  companyId,
  userId,
  whatsAppAccountId,
  input,
}: {
  companyId: string;
  userId?: string | null;
  whatsAppAccountId?: string | null;
  input: SaveWhatsAppEmbeddedSignupEventInput;
}) {
  return prisma.whatsAppEmbeddedSignupEvent.create({
    data: {
      companyId,
      userId: userId || null,
      whatsAppAccountId: whatsAppAccountId || null,
      flowSessionId: input.flowSessionId,
      eventType: input.eventType,
      currentStep: input.currentStep,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      payload:
        input.payload === undefined ? Prisma.JsonNull : safeJson(input.payload),
    },
  });
}

export async function completeWhatsAppEmbeddedSignup(
  companyId: string,
  input: CompleteWhatsAppEmbeddedSignupInput,
  actorUserId?: string,
) {
  try {
    await recordWhatsAppEmbeddedSignupEvent({
      companyId,
      userId: actorUserId,
      input: {
        flowSessionId: input.flowSessionId,
        eventType: "SERVER_COMPLETE_STARTED",
        currentStep: null,
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        payload: {
          tokenExchangeStrategy: input.redirectUri
            ? "hosted_redirect_with_redirect_uri"
            : "embedded_signup_js_sdk_without_redirect_uri",
          redirectUriProvided: Boolean(input.redirectUri),
        },
      },
    });

    const accessToken = await exchangeEmbeddedSignupCodeForToken(
      input.code,
      input.redirectUri,
    );
    let resolvedWabaId = input.wabaId;
    let resolvedPhoneNumberId = input.phoneNumberId;
    let phoneDetails: MetaPhoneNumberDetails[];
    let discoverySource = "embedded_signup_postmessage";

    if (!resolvedWabaId || !resolvedPhoneNumberId) {
      const discovered = await discoverEmbeddedSignupAssets(accessToken);
      const resolvedSelection = resolveDiscoveredSignupSelection({
        discovered,
        wabaId: resolvedWabaId,
        phoneNumberId: resolvedPhoneNumberId,
      });

      resolvedWabaId = resolvedSelection.wabaId;
      resolvedPhoneNumberId = resolvedSelection.phoneNumberId;
      phoneDetails = resolvedSelection.phoneDetails;
      discoverySource = resolvedSelection.discoverySource;

      await recordWhatsAppEmbeddedSignupEvent({
        companyId,
        userId: actorUserId,
        input: {
          flowSessionId: input.flowSessionId,
          eventType: "SERVER_DISCOVERY_USED",
          currentStep: null,
          wabaId: resolvedWabaId,
          phoneNumberId: resolvedPhoneNumberId,
          payload: {
            discoverySource,
            discoveredWabaCount: discovered.length,
            discoveredPhoneCount: discovered.reduce(
              (sum, item) => sum + item.phoneNumbers.length,
              0,
            ),
          },
        },
      });
    } else {
      phoneDetails = await getMetaPhoneNumbers(accessToken, resolvedWabaId);
    }

    if (!resolvedWabaId || !resolvedPhoneNumberId) {
      throw new Error(
        "Meta did not return the WABA and phone number details. Please try again.",
      );
    }

    const finalWabaId = resolvedWabaId;
    const finalPhoneNumberId = resolvedPhoneNumberId;

    const conflictingWaba = await prisma.whatsAppAccount.findFirst({
      where: {
        wabaId: finalWabaId,
        companyId: { not: companyId },
      },
      select: { id: true },
    });

    if (conflictingWaba) {
      throw new Error("This WhatsApp Business Account is already connected");
    }

    const selectedPhone = phoneDetails.find(
      (item) => item.phoneNumberId === finalPhoneNumberId,
    );

    if (!selectedPhone) {
      throw new Error("Selected phone number does not belong to the selected WABA");
    }

    const orderedPhoneDetails = [
      selectedPhone,
      ...phoneDetails.filter(
        (item) => item.phoneNumberId !== finalPhoneNumberId,
      ),
    ];
    const conflictingPhoneNumbers = await prisma.whatsAppPhoneNumber.findMany({
      where: {
        phoneNumberId: {
          in: orderedPhoneDetails.map((item) => item.phoneNumberId),
        },
        companyId: { not: companyId },
      },
      select: { phoneNumberId: true },
    });
    const conflictingPhoneNumberIds = new Set(
      conflictingPhoneNumbers
        .map((item) => item.phoneNumberId)
        .filter((item): item is string => Boolean(item)),
    );
    const connectablePhoneDetails = orderedPhoneDetails.filter(
      (item) => !conflictingPhoneNumberIds.has(item.phoneNumberId),
    );

    if (connectablePhoneDetails.length === 0) {
      throw new Error("This WhatsApp phone number is already connected");
    }

    const webhookSubscription = await subscribeAppToWabaWebhooks(
      accessToken,
      finalWabaId,
    );
    const encryptedAccessToken = encryptSecret({
      plaintext: accessToken,
      purpose: "whatsapp_access_token",
    });
    const accessTokenKeyId = getActiveEncryptionKeyId();
    const accessTokenEncryptedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const existingAccount = await tx.whatsAppAccount.findFirst({
        where: { companyId },
        orderBy: { createdAt: "asc" },
      });

      const account = existingAccount
        ? await tx.whatsAppAccount.update({
          where: { id: existingAccount.id },
          data: {
            wabaId: finalWabaId,
            accessToken: encryptedAccessToken,
            accessTokenKeyId,
            accessTokenEncryptedAt,
            status: "CONNECTED",
          },
        })
        : await tx.whatsAppAccount.create({
            data: {
              companyId,
              wabaId: finalWabaId,
              accessToken: encryptedAccessToken,
              accessTokenKeyId,
              accessTokenEncryptedAt,
              status: "CONNECTED",
            },
          });

      const phones = [];

      for (const phone of orderedPhoneDetails) {
        if (conflictingPhoneNumberIds.has(phone.phoneNumberId)) {
          phones.push({
            ...phone,
            success: false,
            skipped: false,
            messages: [],
            error: {
              message:
                "This WhatsApp phone number is already connected to another workspace",
            },
          });
          continue;
        }

        const phoneData = {
          companyId,
          whatsAppAccountId: account.id,
          displayPhoneNumber: phone.displayPhoneNumber,
          verifiedName: phone.verifiedName,
          qualityRating: phone.qualityRating,
          messagingLimitTier: phone.messagingLimitTier,
          numberType: phone.numberType,
          codeVerificationStatus: phone.codeVerificationStatus,
          nameStatus: phone.nameStatus,
          platformType: phone.platformType,
          throughput: phone.throughput,
          healthStatus: phone.healthStatus,
          canSendMessage: phone.canSendMessage,
          lastStatusError: null,
        };

        await tx.whatsAppPhoneNumber.upsert({
          where: { phoneNumberId: phone.phoneNumberId },
          update: phoneData,
          create: {
            ...phoneData,
            phoneNumberId: phone.phoneNumberId,
          },
        });

        phones.push({
          ...phone,
          success: true,
          skipped: false,
          messages: [
            phone.phoneNumberId === finalPhoneNumberId
              ? "Selected phone number connected"
              : "Additional WABA phone number connected",
          ],
          error: null,
        });
      }

      return { account, phones };
    });

    const selectedResult =
      result.phones.find((item) => item.phoneNumberId === finalPhoneNumberId) ??
      result.phones.find((item) => item.success);

    await recordWhatsAppEmbeddedSignupEvent({
      companyId,
      userId: actorUserId,
      whatsAppAccountId: result.account.id,
      input: {
        flowSessionId: input.flowSessionId,
        eventType: "SERVER_COMPLETE_SUCCEEDED",
        currentStep: null,
        wabaId: finalWabaId,
        phoneNumberId: finalPhoneNumberId,
        payload: {
          discoverySource,
          phones: result.phones.map((phone) => ({
            phoneNumberId: phone.phoneNumberId,
            success: phone.success,
            skipped: phone.skipped,
            messages: phone.messages,
            error: phone.error,
          })),
          webhooksSubscribed: webhookSubscription.subscribed,
        },
      },
    });

    return {
      accountId: result.account.id,
      wabaId: result.account.wabaId,
      status: result.account.status,
      phoneNumberId: selectedResult?.phoneNumberId ?? finalPhoneNumberId,
      displayPhoneNumber: selectedResult?.displayPhoneNumber ?? "",
      verifiedName: selectedResult?.verifiedName ?? null,
      qualityRating: selectedResult?.qualityRating ?? null,
      webhooksSubscribed: webhookSubscription.subscribed,
      phones: result.phones,
    };
  } catch (error) {
    await recordWhatsAppEmbeddedSignupEvent({
      companyId,
      userId: actorUserId,
      input: {
        flowSessionId: input.flowSessionId,
        eventType: "SERVER_COMPLETE_FAILED",
        currentStep: null,
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Unable to complete embedded signup",
        },
      },
    }).catch(() => undefined);

    throw error;
  }
}

export async function getMetaPhoneNumberStatus(
  accessToken: string,
  phoneNumberId: string,
) {
  const baseUrl = `${getMetaGraphBaseUrl()}/${phoneNumberId}`;
  const url = new URL(baseUrl);
  url.searchParams.set(
    "fields",
    [
      "id",
      "display_phone_number",
      "verified_name",
      "quality_rating",
      "messaging_limit_tier",
      "code_verification_status",
      "name_status",
      "platform_type",
      "throughput",
    ].join(","),
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as MetaPhoneNumberResponse;

  if (!response.ok || data.error) {
    const fallbackUrl = new URL(baseUrl);
    fallbackUrl.searchParams.set(
      "fields",
      "id,display_phone_number,verified_name,quality_rating",
    );
    const fallbackResponse = await fetch(fallbackUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const fallbackData =
      (await fallbackResponse.json()) as MetaPhoneNumberResponse;

    if (!fallbackResponse.ok || fallbackData.error) {
      throw new Error(
        metaErrorMessage(fallbackData, "Unable to fetch WhatsApp phone status"),
      );
    }

    const normalized = normalizePhoneNumber(fallbackData);

    if (!normalized) {
      throw new Error("Meta did not return phone number status");
    }

    return normalized;
  }

  const healthUrl = new URL(baseUrl);
  healthUrl.searchParams.set("fields", "health_status");
  const healthResponse = await fetch(healthUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (healthResponse.ok) {
    const healthData = (await healthResponse.json()) as MetaPhoneNumberResponse;
    data.health_status = healthData.health_status;
  }

  const normalized = normalizePhoneNumber(data);

  if (!normalized) {
    throw new Error("Meta did not return phone number status");
  }

  return normalized;
}

export async function checkWhatsAppPhoneNumberStatus({
  companyId,
  phoneNumberId,
}: {
  companyId: string;
  phoneNumberId: string;
}) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
      status: "CONNECTED",
      phoneNumbers: {
        some: {
          phoneNumberId,
        },
      },
    },
    include: {
      phoneNumbers: {
        where: {
          phoneNumberId,
        },
        take: 1,
      },
    },
  });
  const phoneNumber = account?.phoneNumbers[0];

  if (!account?.accessToken || !phoneNumber?.phoneNumberId) {
    throw new Error("WhatsApp credentials are incomplete");
  }

  try {
    const status = await getMetaPhoneNumberStatus(
      decryptSecret({
        encrypted: account.accessToken,
        purpose: "whatsapp_access_token",
      }),
      phoneNumber.phoneNumberId,
    );

    await prisma.whatsAppPhoneNumber.update({
      where: {
        id: phoneNumber.id,
      },
      data: {
        displayPhoneNumber: status.displayPhoneNumber,
        verifiedName: status.verifiedName,
        qualityRating: status.qualityRating,
        messagingLimitTier: status.messagingLimitTier,
        numberType: status.numberType,
        codeVerificationStatus: status.codeVerificationStatus,
        nameStatus: status.nameStatus,
        platformType: status.platformType,
        throughput: status.throughput,
        healthStatus: status.healthStatus,
        canSendMessage: status.canSendMessage,
        lastStatusCheckAt: new Date(),
        lastStatusError: null,
      },
    });

    return status;
  } catch (error) {
    await prisma.whatsAppPhoneNumber.update({
      where: {
        id: phoneNumber.id,
      },
      data: {
        lastStatusCheckAt: new Date(),
        lastStatusError:
          error instanceof Error
            ? error.message
            : "Unable to fetch WhatsApp phone status",
      },
    });

    throw error;
  }
}
