import { revalidateTag, unstable_cache } from "next/cache";
import { encryptText } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { SaveWhatsAppCredentialsInput } from "@/server/validators/whatsapp.validator";

const WHATSAPP_ACCOUNT_CACHE_TAG = "whatsapp-account";

const safeWhatsAppAccountSelect = {
  id: true,
  companyId: true,
  wabaId: true,
  businessName: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  phoneNumbers: {
    select: {
      id: true,
      companyId: true,
      whatsAppAccountId: true,
      phoneNumberId: true,
      displayPhoneNumber: true,
      verifiedName: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

export const getWhatsAppAccountByCompany = unstable_cache(
  async function getWhatsAppAccountByCompany(companyId: string) {
  return prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
    },
    select: safeWhatsAppAccountSelect,
  });
  },
  ["whatsapp-account-by-company"],
  {
    revalidate: 60,
    tags: [WHATSAPP_ACCOUNT_CACHE_TAG],
  },
);

export async function createWhatsAppAccountForCompany(
  companyId: string,
  businessName: string,
) {
  const existingAccount = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
    },
  });

  if (existingAccount) {
    throw new Error("Company already has a WhatsApp account setup");
  }

  const account = await prisma.whatsAppAccount.create({
    data: {
      companyId,
      businessName,
      status: "PENDING",
    },
    select: safeWhatsAppAccountSelect,
  });

  revalidateTag(WHATSAPP_ACCOUNT_CACHE_TAG, "max");

  return account;
}

export async function saveWhatsAppCredentialsForCompany(
  companyId: string,
  input: SaveWhatsAppCredentialsInput,
) {
  const existingAccount = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
    },
  });

  if (!existingAccount) {
    throw new Error("WhatsApp account setup not found");
  }

  const account = await prisma.whatsAppAccount.update({
    where: {
      id: existingAccount.id,
    },
    data: {
      wabaId: input.wabaId,
      accessToken: encryptText(input.accessToken),
      status: "CONNECTED",
      phoneNumbers: {
        create: {
          companyId,
          phoneNumberId: input.phoneNumberId,
          displayPhoneNumber: input.displayPhoneNumber,
          verifiedName: input.verifiedName,
        },
      },
    },
    select: safeWhatsAppAccountSelect,
  });

  revalidateTag(WHATSAPP_ACCOUNT_CACHE_TAG, "max");

  return account;
}
