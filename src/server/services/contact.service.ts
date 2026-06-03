import { prisma } from "@/lib/prisma";
import { CreateContactInput } from "@/server/validators/contact.validator";

export async function getContactsByCompany(companyId: string) {
  return prisma.contact.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createContactForCompany(
  companyId: string,
  input: CreateContactInput,
) {
  const contact = await prisma.contact.create({
    data: {
      companyId,
      name: input.name || null,
      countryCode: input.countryCode,
      phoneNumber: input.phoneNumber,
    },
  });

  return contact;
}

export async function upsertContactForCompany(
  companyId: string,
  input: CreateContactInput,
) {
  const contact = await prisma.contact.upsert({
    where: {
      companyId_phoneNumber: {
        companyId,
        phoneNumber: input.phoneNumber,
      },
    },
    update: {
      name: input.name || null,
      countryCode: input.countryCode,
    },
    create: {
      companyId,
      name: input.name || null,
      countryCode: input.countryCode,
      phoneNumber: input.phoneNumber,
    },
  });

  return contact;
}
