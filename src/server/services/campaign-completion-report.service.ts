import { MessageStatus, Prisma } from "@/generated/prisma/client";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class CampaignCompletionReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignCompletionReportError";
  }
}

function isEnabled() {
  return process.env.CAMPAIGN_COMPLETION_REPORTS_ENABLED !== "false";
}

function autoGenerateEnabled() {
  return process.env.CAMPAIGN_COMPLETION_AUTO_GENERATE_ENABLED !== "false";
}

function csvEnabled() {
  return process.env.CAMPAIGN_REPORT_EXPORT_CSV_ENABLED !== "false";
}

function autoCompleteControlState() {
  return process.env.CAMPAIGN_REPORT_AUTO_COMPLETE_CONTROL_STATE !== "false";
}

function staleHours() {
  const value = Number(process.env.CAMPAIGN_COMPLETION_STALE_HOURS ?? 24);
  return Number.isFinite(value) && value > 0 ? value : 24;
}

function minAgeMinutes() {
  const value = Number(process.env.CAMPAIGN_COMPLETION_MIN_AGE_MINUTES ?? 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(redactSensitiveData(value))) as Prisma.InputJsonValue;
}

function percent(part: number, total: number) {
  if (total <= 0) return new Prisma.Decimal(0);

  return new Prisma.Decimal((part / total) * 100);
}

function moneyPaise(value?: number | null) {
  return value ?? 0;
}

function eventTime(events: Array<{ status: MessageStatus; createdAt: Date }>, status: MessageStatus) {
  return events.find((event) => event.status === status)?.createdAt ?? null;
}

async function getMessageStatusCounts({
  campaignId,
  companyId,
}: {
  campaignId: string;
  companyId: string;
}) {
  const rows = await prisma.message.groupBy({
    by: ["status"],
    where: {
      campaignId,
      companyId,
      direction: "OUTBOUND",
    },
    _count: {
      id: true,
    },
  });

  const get = (status: MessageStatus) =>
    rows.find((row) => row.status === status)?._count.id ?? 0;

  const queuedMessages = get("QUEUED") + get("RETRY_PENDING");

  return {
    canceledMessages: get("CANCELED"),
    deliveredMessages: get("DELIVERED"),
    failedMessages: get("FAILED"),
    queuedMessages,
    raw: rows,
    readMessages: get("READ"),
    sendingMessages: get("SENDING"),
    sentMessages: get("SENT"),
    totalMessages: rows.reduce((sum, row) => sum + row._count.id, 0),
  };
}

async function getCampaignCostSummary({
  campaignId,
  companyId,
}: {
  campaignId: string;
  companyId: string;
}) {
  const [launchRun, reservations, messages] = await Promise.all([
    prisma.campaignLaunchRun
      .findFirst({
        where: {
          campaignId,
          companyId,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
      .catch(() => null),
    prisma.campaignWalletReservation
      .findMany({
        where: {
          campaignId,
          companyId,
        },
      })
      .catch(() => []),
    prisma.message.findMany({
      where: {
        campaignId,
        companyId,
        direction: "OUTBOUND",
      },
      select: {
        id: true,
      },
      take: 100_000,
    }),
  ]);

  const messageIds = messages.map((message) => message.id);
  const actualCostPaise =
    messageIds.length === 0
      ? 0
      : await prisma.messageUsageLedger
          .aggregate({
            where: {
              companyId,
              messageId: {
                in: messageIds,
              },
              status: "CHARGED",
            },
            _sum: {
              amountPaise: true,
            },
          })
          .then((result) => result._sum.amountPaise ?? 0)
          .catch(() => 0);

  return {
    actualCostPaise,
    estimatedCostPaise: moneyPaise(launchRun?.estimatedCostPaise),
    launchRun,
    reservations,
    walletReservedPaise: reservations
      .filter((item) => item.status === "RESERVED" || item.status === "CONSUMED")
      .reduce((sum, item) => sum + item.amountPaise, 0),
  };
}

async function getFailureSummary({
  campaignId,
  companyId,
}: {
  campaignId: string;
  companyId: string;
}) {
  const insights = await prisma.campaignFailureInsight
    .findMany({
      where: {
        campaignId,
        companyId,
      },
      orderBy: {
        failedMessageCount: "desc",
      },
    })
    .catch(() => []);

  return {
    criticalFailureCount: insights.filter((item) => item.severity === "CRITICAL").length,
    failureBreakdown: insights.map((item) => ({
      category: item.category,
      failedMessageCount: item.failedMessageCount,
      retrySafety: item.retrySafety,
      sampleErrorMessage: item.sampleErrorMessage,
      severity: item.severity,
      suggestedFix: item.suggestedFix,
    })),
    failureInsightCount: insights.length,
    safeRetryFailureGroups: insights.filter(
      (item) => item.retrySafety === "SAFE_TO_RETRY",
    ).length,
  };
}

async function getReplyAndOptOutSummary({
  campaignId,
  companyId,
}: {
  campaignId: string;
  companyId: string;
}) {
  const outbound = await prisma.message.findMany({
    where: {
      campaignId,
      companyId,
      direction: "OUTBOUND",
    },
    select: {
      contactId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 50_000,
  });

  const contactIds = Array.from(
    new Set(outbound.map((message) => message.contactId).filter(Boolean)),
  );

  if (contactIds.length === 0) {
    return {
      optOutCount: 0,
      replyCount: 0,
    };
  }

  const firstCampaignMessageAt = outbound[0]?.createdAt ?? new Date(0);

  const [replyCount, optOutCount, conversions] = await Promise.all([
    prisma.campaignReplyAttribution
      .count({
        where: {
          campaignId,
          companyId,
        },
      })
      .then(async (count) => {
        if (count > 0) return count;

        return prisma.message.count({
          where: {
            companyId,
            contactId: {
              in: contactIds,
            },
            createdAt: {
              gte: firstCampaignMessageAt,
            },
            direction: "INBOUND",
          },
        });
      }),
    prisma.contact.count({
      where: {
        companyId,
        id: {
          in: contactIds,
        },
        optedOutAt: {
          not: null,
        },
      },
    }),
    prisma.campaignConversionEvent
      .groupBy({
        by: ["type"],
        where: {
          campaignId,
          companyId,
        },
        _count: {
          id: true,
        },
        _sum: {
          valuePaise: true,
        },
      })
      .catch(() => []),
  ]);

  return {
    conversions: conversions.map((item) => ({
      count: item._count.id,
      type: item.type,
      valuePaise: item._sum.valuePaise ?? 0,
    })),
    optOutCount,
    replyCount,
  };
}

async function isCampaignComplete({
  campaignId,
  companyId,
}: {
  campaignId: string;
  companyId: string;
}) {
  const counts = await getMessageStatusCounts({
    campaignId,
    companyId,
  });
  const active = counts.queuedMessages + counts.sendingMessages;

  return {
    complete: counts.totalMessages > 0 && active === 0,
    counts,
  };
}

async function completeCampaignIfNeeded({
  campaignId,
  companyId,
  failedMessages,
}: {
  campaignId: string;
  companyId: string;
  failedMessages: number;
}) {
  if (!autoCompleteControlState()) return;

  await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      companyId,
      status: {
        in: ["SCHEDULED", "RUNNING"],
      },
    },
    data: {
      status: failedMessages > 0 ? "FAILED" : "COMPLETED",
    },
  });
}

export async function generateCampaignCompletionReport({
  actorUserId,
  campaignId,
  companyId,
  trigger = "MANUAL",
}: {
  actorUserId?: string | null;
  campaignId: string;
  companyId: string;
  trigger?: "MANUAL" | "AUTO";
}) {
  if (!isEnabled()) {
    throw new CampaignCompletionReportError("Campaign Completion Reports are disabled.");
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      companyId,
      id: campaignId,
    },
    select: {
      createdAt: true,
      id: true,
      scheduledAt: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!campaign) {
    throw new CampaignCompletionReportError("Campaign not found.");
  }

  const completion = await isCampaignComplete({
    campaignId,
    companyId,
  });
  const counts = completion.counts;

  if (!completion.complete) {
    throw new CampaignCompletionReportError(
      "Campaign is not complete yet. Queued or sending messages still exist.",
    );
  }

  const [cost, failures, replies] = await Promise.all([
    getCampaignCostSummary({
      campaignId,
      companyId,
    }),
    getFailureSummary({
      campaignId,
      companyId,
    }),
    getReplyAndOptOutSummary({
      campaignId,
      companyId,
    }),
  ]);

  const successfulMessages =
    counts.sentMessages + counts.deliveredMessages + counts.readMessages;
  const deliveryRate = percent(
    counts.deliveredMessages + counts.readMessages,
    counts.totalMessages,
  );
  const readRate = percent(counts.readMessages, counts.totalMessages);
  const failureRate = percent(counts.failedMessages, counts.totalMessages);
  const completedAt = new Date();
  const campaignStartedAt =
    cost.launchRun?.startedAt ?? campaign.scheduledAt ?? campaign.createdAt;

  const report = await prisma.campaignCompletionReport.upsert({
    where: {
      companyId_campaignId: {
        campaignId,
        companyId,
      },
    },
    create: {
      actualCostPaise: cost.actualCostPaise,
      campaignCompletedAt: completedAt,
      campaignId,
      campaignStartedAt,
      canceledMessages: counts.canceledMessages,
      companyId,
      costBreakdown: safeJson({
        actualCostPaise: cost.actualCostPaise,
        estimatedCostPaise: cost.estimatedCostPaise,
        walletReservedPaise: cost.walletReservedPaise,
      }),
      criticalFailureCount: failures.criticalFailureCount,
      deliveredMessages: counts.deliveredMessages,
      deliveryRate,
      estimatedCostPaise: cost.estimatedCostPaise,
      failedMessages: counts.failedMessages,
      failureBreakdown: safeJson(failures.failureBreakdown),
      failureInsightCount: failures.failureInsightCount,
      failureRate,
      generatedByUserId: actorUserId ?? null,
      optOutCount: replies.optOutCount,
      queuedMessages: counts.queuedMessages,
      readMessages: counts.readMessages,
      readRate,
      replyBreakdown: safeJson(replies),
      replyCount: replies.replyCount,
      safeRetryFailureGroups: failures.safeRetryFailureGroups,
      sendingMessages: counts.sendingMessages,
      sentMessages: counts.sentMessages,
      status: "GENERATED",
      statusBreakdown: safeJson(counts.raw),
      summary: safeJson({
        deliveryRate: deliveryRate.toNumber(),
        failureRate: failureRate.toNumber(),
        readRate: readRate.toNumber(),
        successfulMessages,
        totalMessages: counts.totalMessages,
      }),
      totalMessages: counts.totalMessages,
      trigger,
      walletReservedPaise: cost.walletReservedPaise,
    },
    update: {
      actualCostPaise: cost.actualCostPaise,
      campaignCompletedAt: completedAt,
      campaignStartedAt,
      canceledMessages: counts.canceledMessages,
      costBreakdown: safeJson({
        actualCostPaise: cost.actualCostPaise,
        estimatedCostPaise: cost.estimatedCostPaise,
        walletReservedPaise: cost.walletReservedPaise,
      }),
      criticalFailureCount: failures.criticalFailureCount,
      deliveredMessages: counts.deliveredMessages,
      deliveryRate,
      estimatedCostPaise: cost.estimatedCostPaise,
      failedMessages: counts.failedMessages,
      failureBreakdown: safeJson(failures.failureBreakdown),
      failureInsightCount: failures.failureInsightCount,
      failureRate,
      generatedAt: completedAt,
      generatedByUserId: actorUserId ?? undefined,
      optOutCount: replies.optOutCount,
      queuedMessages: counts.queuedMessages,
      readMessages: counts.readMessages,
      readRate,
      replyBreakdown: safeJson(replies),
      replyCount: replies.replyCount,
      safeRetryFailureGroups: failures.safeRetryFailureGroups,
      sendingMessages: counts.sendingMessages,
      sentMessages: counts.sentMessages,
      status: "GENERATED",
      statusBreakdown: safeJson(counts.raw),
      summary: safeJson({
        deliveryRate: deliveryRate.toNumber(),
        failureRate: failureRate.toNumber(),
        readRate: readRate.toNumber(),
        successfulMessages,
        totalMessages: counts.totalMessages,
      }),
      totalMessages: counts.totalMessages,
      trigger,
      walletReservedPaise: cost.walletReservedPaise,
    },
  });

  await completeCampaignIfNeeded({
    campaignId,
    companyId,
    failedMessages: counts.failedMessages,
  });

  await createAuditLog({
    action: "campaign.completion_report_generated",
    actorUserId: actorUserId ?? undefined,
    companyId,
    entityId: report.id,
    entityType: "CampaignCompletionReport",
    metadata: safeJson({
      actualCostPaise: cost.actualCostPaise,
      campaignId,
      failedMessages: counts.failedMessages,
      totalMessages: counts.totalMessages,
      trigger,
    }),
  }).catch(() => undefined);

  return report;
}

export async function generateCampaignReportCsv({
  actorUserId,
  campaignId,
  companyId,
  reportId,
}: {
  actorUserId?: string | null;
  campaignId: string;
  companyId: string;
  reportId: string;
}) {
  if (!csvEnabled()) {
    throw new CampaignCompletionReportError("Campaign CSV export is disabled.");
  }

  const report = await prisma.campaignCompletionReport.findFirst({
    where: {
      campaignId,
      companyId,
      id: reportId,
    },
  });

  if (!report) {
    throw new CampaignCompletionReportError("Campaign report not found.");
  }

  const messages = await prisma.message.findMany({
    where: {
      campaignId,
      companyId,
      direction: "OUTBOUND",
    },
    include: {
      contact: {
        select: {
          email: true,
          name: true,
          phoneNumber: true,
        },
      },
      events: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
          status: true,
        },
      },
      template: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 100_000,
  });

  const rows = messages.map((message) => ({
    message_id: message.id,
    contact_name: message.contact?.name ?? "",
    phone_last4: message.contact?.phoneNumber?.slice(-4) ?? "",
    email: message.contact?.email ?? "",
    status: message.status,
    template_name: message.template?.name ?? "",
    error_code: message.errorCode ?? "",
    error_message: message.errorMessage ?? "",
    queued_at: message.queuedAt?.toISOString() ?? eventTime(message.events, "QUEUED")?.toISOString() ?? "",
    sent_at: eventTime(message.events, "SENT")?.toISOString() ?? "",
    delivered_at: eventTime(message.events, "DELIVERED")?.toISOString() ?? "",
    read_at: eventTime(message.events, "READ")?.toISOString() ?? "",
    created_at: message.createdAt.toISOString(),
  }));

  const csv = rowsToCsv([
    [
      "message_id",
      "contact_name",
      "phone_last4",
      "email",
      "status",
      "template_name",
      "error_code",
      "error_message",
      "queued_at",
      "sent_at",
      "delivered_at",
      "read_at",
      "created_at",
    ],
    ...rows.map((row) => [
      row.message_id,
      row.contact_name,
      row.phone_last4,
      row.email,
      row.status,
      row.template_name,
      row.error_code,
      row.error_message,
      row.queued_at,
      row.sent_at,
      row.delivered_at,
      row.read_at,
      row.created_at,
    ]),
  ]);
  const filename = `campaign-report-${campaignId}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  const exportRow = await prisma.campaignReportExport.create({
    data: {
      campaignId,
      companyId,
      contentType: "text/csv; charset=utf-8",
      filename,
      format: "CSV",
      generatedByUserId: actorUserId ?? null,
      metadata: safeJson({
        generatedAt: new Date(),
      }),
      reportId,
      rowCount: rows.length,
      sizeBytes: Buffer.byteLength(csv, "utf8"),
    },
  });

  await createAuditLog({
    action: "campaign.report_csv_exported",
    actorUserId: actorUserId ?? undefined,
    companyId,
    entityId: exportRow.id,
    entityType: "CampaignReportExport",
    metadata: safeJson({
      campaignId,
      reportId,
      rowCount: rows.length,
    }),
  }).catch(() => undefined);

  return {
    contentType: "text/csv; charset=utf-8",
    csv,
    filename,
  };
}

export async function getCampaignCompletionReportDashboard({
  campaignId,
  companyId,
}: {
  campaignId?: string | null;
  companyId: string;
}) {
  const since24h = new Date(Date.now() - 86_400_000);
  const where = {
    companyId,
    ...(campaignId ? { campaignId } : {}),
  };

  const [reports, generated24h] = await Promise.all([
    prisma.campaignCompletionReport.findMany({
      where,
      include: {
        exports: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
        generatedByUser: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
      take: 100,
    }),
    prisma.campaignCompletionReport.count({
      where: {
        ...where,
        generatedAt: {
          gte: since24h,
        },
        status: "GENERATED",
      },
    }),
  ]);

  return {
    generated24h,
    reports,
  };
}

export async function autoGenerateCampaignCompletionReports() {
  if (!isEnabled() || !autoGenerateEnabled()) {
    return {
      checked: 0,
      generated: 0,
      skipped: true,
    };
  }

  const minAge = new Date(Date.now() - minAgeMinutes() * 60 * 1000);
  const staleCutoff = new Date(Date.now() - staleHours() * 60 * 60 * 1000);
  const candidates = await prisma.campaign.findMany({
    where: {
      completionReports: {
        none: {},
      },
      createdAt: {
        lte: minAge,
      },
      status: {
        in: ["SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"],
      },
      OR: [
        {
          updatedAt: {
            lte: minAge,
          },
        },
        {
          updatedAt: {
            lte: staleCutoff,
          },
        },
      ],
    },
    orderBy: {
      updatedAt: "asc",
    },
    select: {
      companyId: true,
      id: true,
    },
    take: 100,
  });

  let generated = 0;
  let failed = 0;

  for (const campaign of candidates) {
    try {
      await generateCampaignCompletionReport({
        campaignId: campaign.id,
        companyId: campaign.companyId,
        trigger: "AUTO",
      });
      generated += 1;
    } catch (error) {
      failed += 1;
      await prisma.campaignCompletionReport
        .upsert({
          where: {
            companyId_campaignId: {
              campaignId: campaign.id,
              companyId: campaign.companyId,
            },
          },
          create: {
            campaignId: campaign.id,
            companyId: campaign.companyId,
            failureReason:
              error instanceof Error ? error.message : "Unknown report generation error",
            status: "FAILED",
            trigger: "AUTO",
          },
          update: {
            failureReason:
              error instanceof Error ? error.message : "Unknown report generation error",
            generatedAt: new Date(),
            status: "FAILED",
            trigger: "AUTO",
          },
        })
        .catch(() => undefined);
    }
  }

  return {
    checked: candidates.length,
    failed,
    generated,
  };
}

export async function getCampaignCompletionReportHealth() {
  const since24h = new Date(Date.now() - 86_400_000);

  const [reportsTotal, generated24h, failed24h] = await Promise.all([
    prisma.campaignCompletionReport.count(),
    prisma.campaignCompletionReport.count({
      where: {
        generatedAt: {
          gte: since24h,
        },
        status: "GENERATED",
      },
    }),
    prisma.campaignCompletionReport.count({
      where: {
        generatedAt: {
          gte: since24h,
        },
        status: "FAILED",
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    failed24h,
    generated24h,
    isHealthy: isEnabled() && failed24h === 0,
    reportsTotal,
  };
}
