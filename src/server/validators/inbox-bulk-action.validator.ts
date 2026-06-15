import { z } from "zod";

export const bulkInboxActionSchema = z
  .object({
    contactIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one conversation")
      .max(50, "You can update up to 50 conversations at once"),
    action: z.enum([
      "SET_STATUS",
      "SET_PRIORITY",
      "SET_ASSIGNEE",
      "ADD_TAG",
      "REMOVE_TAG",
      "MARK_READ",
      "MARK_UNREAD",
      "SNOOZE",
      "UNSNOOZE",
    ]),
    status: z.enum(["OPEN", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    assignedToUserId: z.string().nullable().optional(),
    tagId: z.string().optional(),
    snoozedUntil: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "SET_STATUS" && !data.status) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Status is required",
      });
    }

    if (data.action === "SET_PRIORITY" && !data.priority) {
      ctx.addIssue({
        code: "custom",
        path: ["priority"],
        message: "Priority is required",
      });
    }

    if (
      data.action === "SET_ASSIGNEE" &&
      data.assignedToUserId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["assignedToUserId"],
        message: "Assignee is required",
      });
    }

    if (
      (data.action === "ADD_TAG" || data.action === "REMOVE_TAG") &&
      !data.tagId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["tagId"],
        message: "Tag is required",
      });
    }

    if (data.action === "SNOOZE" && !data.snoozedUntil) {
      ctx.addIssue({
        code: "custom",
        path: ["snoozedUntil"],
        message: "Snooze time is required",
      });
    }
  });

export type BulkInboxActionInput = z.infer<typeof bulkInboxActionSchema>;
