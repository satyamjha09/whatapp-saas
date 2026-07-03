# Contact Import Foundation (Import & Broadcast Suite — Phase 16A)

Step 1 of the Import & Broadcast Suite. Users import contacts from CSV/XLSX,
map columns, validate phone numbers, resolve duplicates, assign tags/lists,
and import in the background with live progress.

## Flow

1. **Upload** — `POST /api/contacts/import/upload` (multipart `file`).
   Parses the file (CSV via papaparse, XLSX via exceljs), stores every raw row
   as a `ContactImportRow` (`PENDING`), auto-detects column mapping from
   common header names, and returns headers + first 20 sample rows.
2. **Mapping** — `POST /api/contacts/import/[jobId]/mapping`.
   Saves column mapping, default country code, duplicate strategy
   (`SKIP_EXISTING` | `UPDATE_EXISTING` | `CREATE_NEW_ONLY`), tags, and
   list assignment (`contactListId` or `createListName`).
3. **Validate** — `POST /api/contacts/import/[jobId]/validate`.
   Normalizes phones, marks rows `VALID` / `INVALID` / `DUPLICATE`
   (both in-file and against existing contacts), returns a summary with
   row-level errors and warnings. Job becomes `READY`.
4. **Start** — `POST /api/contacts/import/[jobId]/start`.
   Resolves/creates the contact list, sets `IMPORTING`, and enqueues
   `contact-import-queue` (BullMQ, jobId `contact-import:{companyId}:{importId}`,
   3 attempts, exponential backoff).
5. **Worker** — `src/workers/contact-import.worker.ts`
   (`npm run worker:contact-import`, PM2 `tallykonnect-contact-import-worker`).
   Processes rows in batches of 100, refreshes job counters per batch for
   live progress, honours mid-run cancellation, and finalizes the job.
6. **Progress / rows** — `GET /api/contacts/import/[jobId]` and
   `GET /api/contacts/import/[jobId]/rows?status=&page=&pageSize=`.
7. **Cancel** — `POST /api/contacts/import/[jobId]/cancel` (any non-terminal
   state; the worker stops between batches).

## Contact safety rules

- All queries are scoped by `companyId`; imports are tenant-isolated.
- `UPDATE_EXISTING` only writes **non-empty** values — an existing name/email
  is never wiped by a blank cell.
- `optedOutAt`, `isBlocked`, and unsubscribe state are never touched.
- Marketing consent is only upgraded `UNKNOWN → GRANTED` (never overwrites
  `DENIED`/`REVOKED`, never applied to opted-out contacts), and consent events
  are recorded via the consent ledger with proof.
- Tags (`InboxTag`) and custom attributes are merged, never replaced.
- Contact creation is guarded by the `(companyId, phoneNumber)` unique key;
  a P2002 race (e.g. worker retry) falls back to skip, so retries never
  duplicate contacts. Row status transitions make reprocessing idempotent.

## Phone normalization

`src/lib/contacts/phone-normalizer.ts` — accepts `+CC`, `00CC`, bare national
numbers (default country code applied, company default falls back to `+91`),
numbers with the CC embedded without `+`, strips formatting and national-zero
prefixes, rejects letters and out-of-range lengths. Contacts store
`countryCode` and national `phoneNumber` separately (send format is
`${countryCode}${phoneNumber}`).

## Limits

- File: `.csv`/`.xlsx`, max `CONTACT_IMPORT_MAX_FILE_MB` (default 10MB).
- Rows: `CONTACT_IMPORT_MAX_ROWS` (default 10,000).
- Total contacts: `CONTACT_IMPORT_MAX_TOTAL_CONTACTS` (default 100,000).
  TODO: replace with plan entitlements when contact limits land in plan gating.

## Data model

Reuses `ContactImportJob` / `ContactImportRow` (extended with wizard statuses,
counters, mapping/settings columns) plus `ContactGroup` as "lists" and
`InboxTag` as tags. `Contact` gained `city` and `customAttributes Json`.
Migrations: `20260702175452_add_contact_import_foundation`,
`20260702180654_add_contact_city_custom_attributes`.

## UI

- `/dashboard/contacts/import` — 4-step wizard (Upload → Map columns →
  Review → Import) + recent imports.
- `/dashboard/contacts/import/[importId]` — live progress + row details.
- Components under `src/components/contacts/import/`.
- Sample file: `public/samples/contact-import-sample.csv`.

## Audit actions

`contacts.import_uploaded`, `contacts.import_mapping_saved`,
`contacts.import_validated`, `contacts.import_started`,
`contacts.import_completed`, `contacts.import_failed`,
`contacts.import_cancelled`.

## Explicitly out of scope (later phases)

No broadcasts, no WhatsApp/Meta API calls, no wallet debits, no campaigns.
