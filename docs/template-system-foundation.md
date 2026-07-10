# Template System Foundation

## Current Repo Audit

The project has one source-of-truth database model for WhatsApp templates: `Template` in `prisma/schema.prisma`. Related features already depend on it:

- Template creation: `src/app/api/templates/route.ts`
- Meta approval submission: `src/server/services/meta-template.service.ts`
- Meta template sync: `src/server/services/whatsapp-template-sync.service.ts`
- Submission validation: `src/server/services/whatsapp-template-validation.service.ts`
- Template status worker: `src/workers/template-status-sync.worker.ts`
- Campaign and bulk selectors: campaign/bulk services query `Template` with `status: "APPROVED"`
- Automation SEND_TEMPLATE: `src/server/services/automation-template.service.ts` and automation builder forms use approved template APIs
- Runtime sending: `src/workers/message.worker.ts`
- Permissions: `src/server/auth/rbac-route-permissions.ts` gates template submit/sync routes
- Plan limits: `src/server/config/billing-plans.ts` and `usage-quota.service.ts` gate template creation/sync

## Shared Architecture

Use `src/lib/whatsapp-template/template-definition.ts` for all new template work.

The canonical draft shape is:

- `templateType`
- `templateCategory`
- `templateName`
- `languageCode`
- `status`
- `metaTemplateId`
- `header`
- `body`
- `footer`
- `buttons`
- `variables`
- `examples`
- `rejectionReason`
- `qualityStatus`
- `submittedAt`
- `approvedAt`
- `lastSyncedAt`

The database keeps the existing single `Template` model. Existing database field aliases are normalized in one place:

- `name` -> `templateName`
- `language` -> `languageCode`
- `category` -> `templateCategory`
- `qualityScore` -> `qualityStatus`
- `lastSubmittedAt` -> `submittedAt`
- `components` -> header/body/footer/buttons and Meta component payload

## Rules For Future Editors

Do not create a second template model or a second parser. New editors should:

1. Save drafts through `buildStoredTemplateComponents`.
2. Read drafts through `canonicalizeTemplateDraft`.
3. Build Meta submission payloads through `buildMetaTemplateComponents`.
4. Read variable keys through `buildTemplateVariableKeys`.
5. Validate Meta readiness through `validateTemplateForMetaSubmission`.

Meta approval requires public HTTPS media/button URLs and example values for variables.

## Variable Engine

Use `src/lib/whatsapp-template/template-variable-engine.ts` for variable logic across templates, campaigns, automation, Tally, Google Sheets, and API values.

Shared helpers:

- `extractVariables`
- `validateVariableSequence`
- `buildVariableMetadata`
- `renderPreview`
- `buildMetaExamples`
- `resolveCampaignVariables`
- `resolveAutomationVariables`

Rules:

- Numeric variables are checked per component, so body variables can start at `{{1}}` even when the header also uses `{{1}}`.
- Sample values are required for every detected variable before submission.
- Preview rendering must leave no unresolved placeholders in production send paths.
