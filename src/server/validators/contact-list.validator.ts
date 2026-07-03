import { z } from "zod";

export const CreateContactListSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
});

export const UpdateContactListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const ContactListMembersSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1).max(1000),
});

export const ContactListContactsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const BulkContactActionSchema = z
  .object({
    action: z.enum(["ADD_TO_LIST", "REMOVE_FROM_LIST", "ADD_TAG", "REMOVE_TAG"]),
    contactIds: z.array(z.string().min(1)).min(1).max(1000),
    listId: z.string().min(1).optional(),
    tagName: z.string().min(1).max(60).optional(),
  })
  .refine(
    (input) =>
      input.action === "ADD_TO_LIST" || input.action === "REMOVE_FROM_LIST"
        ? Boolean(input.listId)
        : true,
    { message: "listId is required for list actions." },
  )
  .refine(
    (input) =>
      input.action === "ADD_TAG" || input.action === "REMOVE_TAG"
        ? Boolean(input.tagName)
        : true,
    { message: "tagName is required for tag actions." },
  );

export type BulkContactActionInput = z.infer<typeof BulkContactActionSchema>;
