import { z } from "zod";

export const CustomerJourneyQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.string().optional(),
  source: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CustomerJourneyQueryInput = z.infer<typeof CustomerJourneyQuerySchema>;
