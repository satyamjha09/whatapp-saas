import { z } from "zod";

export const listInboxReplyApprovalsQuerySchema = z.object({
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"])
    .optional(),
});

export const rejectInboxReplyApprovalSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Rejection reason is required")
    .max(500, "Rejection reason cannot exceed 500 characters"),
});

export const cancelInboxReplyApprovalSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Cancellation reason cannot exceed 500 characters")
    .optional(),
});
