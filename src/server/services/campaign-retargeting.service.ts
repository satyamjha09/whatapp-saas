import { Prisma } from "@/generated/prisma/client";
import type { CampaignContactStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createContactSegment } from "@/server/services/contact-segment-builder.service";
import type { CampaignRetargetingPreset } from "@/server/validators/campaign-retargeting.validator";

type RetargetingConfig = {
  label: string;
  replyCondition: "ANY" | "REPLIED" | "NOT_REPLIED";
  statuses: CampaignContactStatus[];
};

export const CAMPAIGN_RETARGETING_PRESETS: Record<
  CampaignRetargetingPreset,
  RetargetingConfig
> = {
  DELIVERED_NOT_READ: {
    label: "Delivered but not read",
    replyCondition: "ANY",
    statuses: ["DELIVERED"],
  },
  FAILED: {
    label: "Failed / not delivered",
    replyCondition: "ANY",
    statuses: ["FAILED"],
  },
  NOT_REPLIED: {
    label: "Did not reply",
    replyCondition: "NOT_REPLIED",
    statuses: ["SENT", "DELIVERED", "READ"],
  },
  READ_NOT_REPLIED: {
    label: "Read but did not reply",
    replyCondition: "NOT_REPLIED",
    statuses: ["READ"],
  },
  REPLIED: {
    label: "Replied",
    replyCondition: "REPLIED",
    statuses: ["SENT", "DELIVERED", "READ"],
  },
};

function segmentRuleValues({
  campaignId,
  preset,
}: {
  campaignId: string;
  preset: CampaignRetargetingPreset;
}) {
  const config = CAMPAIGN_RETARGETING_PRESETS[preset];

  return {
    campaignId,
    replyCondition: config.replyCondition,
    statuses: config.statuses,
  };
}

export function buildCampaignOutcomeContactWhere({
  campaignId,
  companyId,
  preset,
}: {
  campaignId: string;
  companyId: string;
  preset: CampaignRetargetingPreset;
}): Prisma.ContactWhereInput {
  const config = CAMPAIGN_RETARGETING_PRESETS[preset];
  const where: Prisma.ContactWhereInput = {
    companyId,
    isBlocked: false,
    marketingConsentStatus: {
      not: "REVOKED",
    },
    campaignContacts: {
      some: {
        campaignId,
        companyId,
        status: {
          in: config.statuses,
        },
      },
    },
  };

  if (config.replyCondition === "REPLIED") {
    where.campaignReplyAttributions = {
      some: {
        campaignId,
        companyId,
        status: "ATTRIBUTED",
      },
    };
  }

  if (config.replyCondition === "NOT_REPLIED") {
    where.campaignReplyAttributions = {
      none: {
        campaignId,
        companyId,
        status: "ATTRIBUTED",
      },
    };
  }

  return where;
}

export async function previewCampaignRetargetingContacts({
  campaignId,
  companyId,
  preset,
}: {
  campaignId: string;
  companyId: string;
  preset: CampaignRetargetingPreset;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      companyId,
      id: campaignId,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const where = buildCampaignOutcomeContactWhere({
    campaignId,
    companyId,
    preset,
  });

  const [count, sampleContacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        countryCode: true,
        email: true,
        id: true,
        name: true,
        phoneNumber: true,
      },
      take: 10,
    }),
  ]);

  return {
    campaign,
    count,
    preset,
    presetLabel: CAMPAIGN_RETARGETING_PRESETS[preset].label,
    sampleContacts,
  };
}

export async function createCampaignOutcomeSegment({
  actorUserId,
  campaignId,
  companyId,
  preset,
  segmentName,
}: {
  actorUserId?: string | null;
  campaignId: string;
  companyId: string;
  preset: CampaignRetargetingPreset;
  segmentName?: string;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      companyId,
      id: campaignId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const config = CAMPAIGN_RETARGETING_PRESETS[preset];
  const segment = await createContactSegment({
    actorUserId,
    companyId,
    description: `Auto segment for retargeting campaign "${campaign.name}": ${config.label}`,
    matchMode: "ALL",
    name: segmentName?.trim() || `${campaign.name} - ${config.label}`,
    rules: [
      {
        field: "CAMPAIGN_OUTCOME",
        operator: "EQUALS",
        value: preset,
        values: segmentRuleValues({ campaignId, preset }),
      },
    ],
  });

  const preview = await previewCampaignRetargetingContacts({
    campaignId,
    companyId,
    preset,
  });

  return {
    preview,
    segment,
  };
}
