import { CalendarClock, Filter, RotateCcw, Send } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import type { MessageStatus } from "@/generated/prisma/enums";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  fieldClass,
  labelClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import CancelScheduledSingleMessageButton from "./cancel-scheduled-single-message-button";

type ScheduledSingleMessagesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const scheduleDateFilters = ["today", "tomorrow", "this-week"] as const;
const messageTypeFilters = [
  "TEMPLATE",
  "TEXT",
  "MEDIA",
  "LOCATION",
  "INTERACTIVE",
] as const;
const statusFilters = [
  "ALL",
  "QUEUED",
  "SENDING",
  "RETRY_PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "CANCELED",
] as const;

type ScheduleDateFilter = (typeof scheduleDateFilters)[number] | "";
type MessageTypeFilter = (typeof messageTypeFilters)[number] | "";
type StatusFilter = (typeof statusFilters)[number];

type ScheduledFilters = {
  when: ScheduleDateFilter;
  type: MessageTypeFilter;
  status: StatusFilter;
  search: string;
};

function getParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function includesValue<T extends string>(
  values: readonly T[],
  value: string | undefined,
): value is T {
  return Boolean(value && values.includes(value as T));
}

function normalizeFilters(
  params: Record<string, string | string[] | undefined> | undefined,
): ScheduledFilters {
  const when = getParam(params, "when");
  const type = getParam(params, "type");
  const status = getParam(params, "status");

  return {
    when: includesValue(scheduleDateFilters, when) ? when : "",
    type: includesValue(messageTypeFilters, type) ? type : "",
    status: includesValue(statusFilters, status) ? status : "QUEUED",
    search: getParam(params, "search")?.trim() ?? "",
  };
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getDateRange(when: ScheduleDateFilter) {
  if (!when) return null;

  const today = startOfDay(new Date());

  if (when === "today") {
    return { start: today, end: addDays(today, 1) };
  }

  if (when === "tomorrow") {
    const tomorrow = addDays(today, 1);
    return { start: tomorrow, end: addDays(tomorrow, 1) };
  }

  return { start: today, end: addDays(today, 7) };
}

function buildMessageTypeWhere(
  type: MessageTypeFilter,
): Prisma.MessageWhereInput | undefined {
  if (!type) return undefined;

  if (type === "TEMPLATE") {
    return { templateId: { not: null } };
  }

  if (type === "TEXT") {
    return {
      templateId: null,
      OR: [
        { metadata: { equals: Prisma.DbNull } },
        { metadata: { equals: Prisma.JsonNull } },
      ],
    };
  }

  return {
    templateId: null,
    metadata: {
      path: ["messageType"],
      equals: type,
    },
  };
}

function buildWhere(companyId: string, filters: ScheduledFilters) {
  const dateRange = getDateRange(filters.when);
  const messageTypeWhere = buildMessageTypeWhere(filters.type);
  const search = filters.search;

  return {
    companyId,
    direction: "OUTBOUND",
    scheduledAt: {
      not: null,
      ...(dateRange ? { gte: dateRange.start, lt: dateRange.end } : {}),
    },
    ...(filters.status !== "ALL"
      ? { status: filters.status as MessageStatus }
      : {}),
    ...(messageTypeWhere ? { AND: [messageTypeWhere] } : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { body: { contains: search, mode: "insensitive" } },
            { toPhoneNumber: { contains: search, mode: "insensitive" } },
            {
              contact: {
                name: { contains: search, mode: "insensitive" },
              },
            },
            {
              contact: {
                phoneNumber: { contains: search, mode: "insensitive" },
              },
            },
            {
              contact: {
                countryCode: { contains: search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.MessageWhereInput;
}

function getMetadataMessageType(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata.messageType;
  return typeof value === "string" ? value : null;
}

function getMessageTypeLabel(message: {
  templateId: string | null;
  metadata: Prisma.JsonValue | null;
}) {
  if (message.templateId) return "Template";

  const metadataType = getMetadataMessageType(message.metadata);
  if (metadataType === "MEDIA") return "Media";
  if (metadataType === "LOCATION") return "Location";
  if (metadataType === "INTERACTIVE") return "Interactive";

  return "Text";
}

export default async function ScheduledSingleMessagesPage({
  searchParams,
}: ScheduledSingleMessagesPageProps) {
  const filters = normalizeFilters(await searchParams);
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  const where = buildWhere(context.membership.companyId, filters);
  const [messages, filteredCount] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: 100,
      include: {
        contact: {
          select: {
            countryCode: true,
            name: true,
            phoneNumber: true,
          },
        },
        template: {
          select: {
            language: true,
            name: true,
          },
        },
      },
    }),
    prisma.message.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Scheduled Single Messages"
        description="Upcoming one-to-one WhatsApp messages waiting for their scheduled send time."
        actions={
          <Link href="/dashboard/messages/send" className={actionButtonClass()}>
            <Send className="mr-2 h-4 w-4" />
            Schedule Message
          </Link>
        }
      />

      <form
        action="/dashboard/scheduled/single-messages"
        className="mb-6 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label htmlFor="scheduled-when" className={labelClass}>
              Schedule Date
            </label>
            <select
              id="scheduled-when"
              name="when"
              defaultValue={filters.when}
              className={fieldClass}
            >
              <option value="">All dates</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="this-week">This week</option>
            </select>
          </div>

          <div>
            <label htmlFor="scheduled-type" className={labelClass}>
              Message Type
            </label>
            <select
              id="scheduled-type"
              name="type"
              defaultValue={filters.type}
              className={fieldClass}
            >
              <option value="">All types</option>
              <option value="TEMPLATE">Template</option>
              <option value="TEXT">Text</option>
              <option value="MEDIA">Media</option>
              <option value="LOCATION">Location</option>
              <option value="INTERACTIVE">Interactive</option>
            </select>
          </div>

          <div>
            <label htmlFor="scheduled-status" className={labelClass}>
              Status
            </label>
            <select
              id="scheduled-status"
              name="status"
              defaultValue={filters.status}
              className={fieldClass}
            >
              <option value="ALL">All statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="SENDING">Sending</option>
              <option value="RETRY_PENDING">Retry pending</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>

          <div className="xl:col-span-2">
            <label htmlFor="scheduled-search" className={labelClass}>
              Contact / Phone Search
            </label>
            <input
              id="scheduled-search"
              name="search"
              defaultValue={filters.search}
              placeholder="Name, phone, message, or system ID"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" className={actionButtonClass()}>
            <Filter className="mr-2 h-4 w-4" />
            Apply Filters
          </button>
          <Link
            href="/dashboard/scheduled/single-messages"
            className={actionButtonClass("secondary")}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Link>
        </div>
      </form>

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Scheduled messages"
            description={`Showing ${messages.length.toLocaleString("en-IN")} of ${filteredCount.toLocaleString("en-IN")} matching message${filteredCount === 1 ? "" : "s"}.`}
          />
        </div>

        {messages.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No scheduled single messages match these filters.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Scheduled For</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Template / Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Body</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {messages.map((message) => (
                  <tr key={message.id}>
                    <td className="px-5 py-4">
                      <StatusPill tone="blue">
                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                        {message.scheduledAt?.toLocaleString()}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#081B3A]">
                        {message.contact.name ?? "Unnamed contact"}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        +{message.contact.countryCode}{" "}
                        {message.contact.phoneNumber}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      <p className="font-semibold text-[#081B3A]">
                        {getMessageTypeLabel(message)}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {message.template
                          ? `${message.template.name} / ${message.template.language}`
                          : "Session message"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(message.status)}>
                        {message.status}
                      </StatusPill>
                    </td>
                    <td className="max-w-sm px-5 py-4 text-[#526173]">
                      <p className="line-clamp-2 whitespace-pre-wrap">
                        {message.body || "-"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {message.createdAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/dashboard/messages/${message.id}`}
                          className="font-semibold text-[#128C7E] hover:underline"
                        >
                          View
                        </Link>
                        {canManage ? (
                          <CancelScheduledSingleMessageButton
                            messageId={message.id}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
