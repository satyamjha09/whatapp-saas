import { encryptText } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { SaveWhatsAppCredentialsInput } from "@/server/validators/whatsapp.validator";

export async function getWhatsAppAccountByCompany(companyId: string) {
  return prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
    },
    include: {
      phoneNumbers: true,
    },
  });
}

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
  });

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
    include: {
      phoneNumbers: true,
    },
  });

  return account;
}
