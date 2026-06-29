import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  encryptSecret,
  getActiveEncryptionKeyId,
} from "@/server/security/secret-encryption";

const testRecipients = [
  { name: "Test 8178444398", countryCode: "91", phoneNumber: "8178444398" },
  { name: "Test 8826826645", countryCode: "91", phoneNumber: "8826826645" },
  { name: "Test 8373946470", countryCode: "91", phoneNumber: "8373946470" },
  { name: "Test 8375938947", countryCode: "91", phoneNumber: "8375938947" },
];

async function main() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be configured.",
    );
  }

  const company =
    (await prisma.company.findFirst({
      where: { name: "WhizCo" },
      orderBy: { createdAt: "desc" },
    })) ??
    (await prisma.company.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }));

  if (!company) {
    throw new Error("No active company found to seed.");
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      billingPlan: "STARTER",
      status: "ACTIVE",
      subscriptionStatus: "ACTIVE",
      monthlyMessageLimit: 1000,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      onboardingCompletedAt: company.onboardingCompletedAt ?? new Date(),
    },
  });

  await prisma.wallet.upsert({
    where: { companyId: company.id },
    update: { balancePaise: { increment: 10_000 } },
    create: {
      companyId: company.id,
      balancePaise: 10_000,
    },
  });

  const encryptedAccessToken = encryptSecret({
    plaintext: accessToken,
    purpose: "whatsapp_access_token",
  });

  const account = await prisma.whatsAppAccount.upsert({
    where: { wabaId: `dev-waba-${company.id}` },
    update: {
      companyId: company.id,
      businessName: `${company.name} Dev WhatsApp`,
      accessToken: encryptedAccessToken,
      accessTokenKeyId: getActiveEncryptionKeyId(),
      accessTokenEncryptedAt: new Date(),
      status: "CONNECTED",
    },
    create: {
      companyId: company.id,
      wabaId: `dev-waba-${company.id}`,
      businessName: `${company.name} Dev WhatsApp`,
      accessToken: encryptedAccessToken,
      accessTokenKeyId: getActiveEncryptionKeyId(),
      accessTokenEncryptedAt: new Date(),
      status: "CONNECTED",
    },
  });

  await prisma.whatsAppPhoneNumber.upsert({
    where: { phoneNumberId },
    update: {
      companyId: company.id,
      whatsAppAccountId: account.id,
      displayPhoneNumber: phoneNumberId,
      verifiedName: `${company.name} Dev Phone`,
      qualityRating: "UNKNOWN",
    },
    create: {
      companyId: company.id,
      whatsAppAccountId: account.id,
      phoneNumberId,
      displayPhoneNumber: phoneNumberId,
      verifiedName: `${company.name} Dev Phone`,
      qualityRating: "UNKNOWN",
    },
  });

  const template = await prisma.template.upsert({
    where: {
      companyId_name_language: {
        companyId: company.id,
        name: "hello_world",
        language: "en_US",
      },
    },
    update: {
      category: "UTILITY",
      status: "APPROVED",
      body: "Hello World",
      variables: [],
      metaTemplateId: "dev-hello-world",
    },
    create: {
      companyId: company.id,
      name: "hello_world",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      body: "Hello World",
      variables: [],
      metaTemplateId: "dev-hello-world",
    },
  });

  const group = await prisma.contactGroup.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Developer WhatsApp Test",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: "Developer WhatsApp Test",
      description: "Seeded test numbers for WhatsApp bulk testing.",
    },
  });

  for (const recipient of testRecipients) {
    const contact = await prisma.contact.upsert({
      where: {
        companyId_phoneNumber: {
          companyId: company.id,
          phoneNumber: recipient.phoneNumber,
        },
      },
      update: {
        name: recipient.name,
        countryCode: recipient.countryCode,
        utilityConsentStatus: "GRANTED",
        utilityConsentAt: new Date(),
        utilityConsentSource: "DASHBOARD",
        marketingConsentStatus: "GRANTED",
        marketingConsentAt: new Date(),
        marketingConsentSource: "DASHBOARD",
      },
      create: {
        companyId: company.id,
        name: recipient.name,
        countryCode: recipient.countryCode,
        phoneNumber: recipient.phoneNumber,
        utilityConsentStatus: "GRANTED",
        utilityConsentAt: new Date(),
        utilityConsentSource: "DASHBOARD",
        marketingConsentStatus: "GRANTED",
        marketingConsentAt: new Date(),
        marketingConsentSource: "DASHBOARD",
      },
    });

    await prisma.contactGroupMember.upsert({
      where: {
        groupId_contactId: {
          groupId: group.id,
          contactId: contact.id,
        },
      },
      update: {},
      create: {
        groupId: group.id,
        contactId: contact.id,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        companyId: company.id,
        companyName: company.name,
        templateId: template.id,
        templateName: template.name,
        contactGroupId: group.id,
        contactGroupName: group.name,
        recipientCount: testRecipients.length,
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
