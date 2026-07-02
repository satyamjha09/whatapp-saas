import { z } from "zod";

export const CreatePublishRequestInputSchema = z.object({
  publishNotes: z.string().trim().max(500).optional(),
});

export const ListPublishRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "SUPERSEDED"]).optional(),
  flowId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const ApprovePublishRequestInputSchema = z.object({
  reviewNote: z.string().trim().max(500).optional(),
});

export const RejectPublishRequestInputSchema = z.object({
  rejectionReason: z.string().trim().min(3, "Rejection reason must be at least 3 characters.").max(500),
});

export type CreatePublishRequestInput = z.infer<typeof CreatePublishRequestInputSchema>;
export type ListPublishRequestsQuery = z.infer<typeof ListPublishRequestsQuerySchema>;
export type ApprovePublishRequestInput = z.infer<typeof ApprovePublishRequestInputSchema>;
export type RejectPublishRequestInput = z.infer<typeof RejectPublishRequestInputSchema>;
