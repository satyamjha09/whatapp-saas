import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      billingPlan: true,
      wallet: { select: { balancePaise: true } },
      whatsAppAccounts: {
        select: {
          id: true,
          status: true,
          wabaId: true,
          accessToken: true,
          phoneNumbers: {
            select: {
              id: true,
              phoneNumberId: true,
              displayPhoneNumber: true,
              verifiedName: true,
            },
          },
        },
      },
      templates: {
        where: { status: "APPROVED" },
        select: {
          id: true,
          name: true,
          language: true,
          category: true,
          status: true,
          variables: true,
          body: true,
        },
        take: 20,
      },
    },
    take: 20,
  });

  console.log(
    JSON.stringify(
      companies.map((company) => ({
        id: company.id,
        name: company.name,
        status: company.status,
        billingPlan: company.billingPlan,
        walletBalancePaise: company.wallet?.balancePaise ?? null,
        whatsAppAccounts: company.whatsAppAccounts.map((account) => ({
          id: account.id,
          status: account.status,
          wabaId: account.wabaId,
          hasAccessToken: Boolean(account.accessToken),
          phoneNumbers: account.phoneNumbers,
        })),
        approvedTemplates: company.templates,
      })),
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
