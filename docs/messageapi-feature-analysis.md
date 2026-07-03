# MessageAPI Feature Analysis

Date: 2026-06-30

This analysis is for building a MessageAPI-like WhatsApp SaaS experience in metawhat / Red Lava.

## Scope And Sources

What was inspected:

- Public marketing site: `https://messageapi.in`
- Public app shell: `https://meta.messageapi.in/ConnectedAccount`
- Public dashboard JavaScript chunks exposed by the app shell, especially `MainApp-UCko9oxW.js`
- Local metawhat codebase at `C:\metawhat\whatsapp-saas`

Limitation:

- The authenticated in-app browser tab could not be controlled from this thread because the browser automation hook was not exposed. So this analysis is based on public page content, route/chunk names, API path names visible in the client bundle, and the local codebase scan.

## Executive Summary

MessageAPI is not just a send-message panel. It is a full WhatsApp business operating system with:

- Meta WhatsApp onboarding and connected account management
- Template creation, sync, insights, groups, AI variations, and predefined templates
- Single, bulk, CSV, contact-filter, scheduled, and drip campaign sending
- Two-way team inbox with notes, assignments, canned replies, media, interactive messages, and payment fields
- Contact CRM with labels, attributes, filters, imports, groups, addresses, blocked contacts, and notes
- Google Sheets integration for campaigns, triggers, and reminders
- Catalog, catalog order, WhatsApp payment, UPI, and transaction workflows
- Chatbot builder, chatbot execution tracking, scheduled chatbot messages
- Wallet, subscription, charges, AI credits, calling charges, invoices, plan migration, and reseller margin controls
- API keys, API documentation, webhooks, WhatsApp widget, click-to-chat, ChatGPT/OpenAI, TradeIndia, and white-label/reseller controls

metawhat already has many enterprise-grade foundations that MessageAPI appears to have, and in some areas metawhat is stronger: multi-tenant architecture, RBAC, entitlements, compliance evidence, data retention, privacy center, billing reconciliation, status/incident tooling, worker health, developer webhooks, and public API idempotency.

The biggest competitor-parity gaps are product-facing modules that are currently placeholders or missing from navigation:

- Google Sheets automation
- Catalog/product/order workflows
- WhatsApp payment/UPI configuration and payment transaction reports
- WhatsApp Groups product surface
- Scheduled items management pages
- Chatbot builder/execution UI
- Drip campaign UI
- Reseller/white-label/domain/theme controls
- ERP/POS/Tally/Busy/mobile-printer workflows
- Voice calling and call pricing/reporting

## MessageAPI Feature Inventory

### 1. Connected WhatsApp Account

Observed routes and chunks:

- `/ConnectedAccount`
- `/ConnectedAccount/Postpaid`
- `EmbeddedSignupFacebook`
- `EmbeddedSignupAudit`
- `WabaTokens`
- `PhoneFeature`
- `PhoneFeatureAudit`
- `WabaSettings`

Feature meaning:

- Embedded Meta signup flow
- Connect WABA and phone numbers
- Track phone number status and plan activation
- Audit embedded signup events
- Manage WABA tokens/settings
- Postpaid onboarding path
- Troubleshooting and reconnect flows

Recommended metawhat target:

- Keep `/dashboard/whatsapp/connect` as the primary flow.
- Add a clear connected-account dashboard with phone number, WABA ID, business ID, webhook status, template sync status, quality rating, messaging limits, and token health.
- Add an onboarding audit trail and "fix connection" checklist.

### 2. Dashboard And Operating Overview

Observed:

- `/DashBoard`
- `/AdminDashboard`
- `/ResellerDashboard`
- `Analytics`
- `MessageStats`

Feature meaning:

- Role-specific dashboards for customer, admin, and reseller
- KPI tiles for messaging, wallet, plan, campaigns, and account health
- Recent activity and reporting shortcuts

metawhat state:

- Strong existing dashboard in `src/app/dashboard/page.tsx`
- Tracks messages sent, delivery rate, contacts, open inbox, wallet balance, message status mix, campaign performance, and recent activity

Recommended target:

- Add account-health widgets: WABA status, webhook health, template sync, wallet low-balance warning, plan expiry, failed campaign insights.
- Add role-specific dashboards for platform admin and partner/reseller workspaces.

### 3. Templates

Observed routes/chunks:

- `/ListTemplate`
- `/ListTemplate/CreateTemplate`
- `/ListTemplate/Insight`
- `/ListTemplate/TS/details`
- `/ListTemplate/TemplateGroupManagement`
- `/ListTemplate/TemplateGroupManagement/create`
- `/ListTemplate/TemplateGroupManagement/edit`
- `/ListTemplate/TemplateGroupManagement/detail`
- `/ListTemplate/TemplateGroupManagement/AiVariation`
- `/ListTemplate/TemplateGroupManagement/Run`
- `/preDefineTemplate`
- `/PatternMatchLogs`
- `/PatternMatchLogs/:logId`
- `AllTemplateDetails`
- `SelectedTemplateInsights`
- `TemplateGroupAiVariation`
- `PatternMatchLogList`
- `PatternMatchLogDetail`

Feature meaning:

- Create and sync Meta templates
- Submit templates for approval
- View template status and insights
- Manage template groups
- Generate AI variations
- Use predefined template library
- Match inbound text/patterns to template automation

metawhat state:

- Good foundation: `/dashboard/templates`, `/dashboard/templates/create`, template sync, submit button, status table, variable mapping models and docs
- Placeholder: template match logs route

Recommended target:

- Add template detail/insight page parity: send count, delivered/read/failed, campaigns using template, rejection reason, last synced time.
- Add predefined template library for common India SMB flows: payment reminder, invoice, warranty, order confirmation, dispatch, appointment, feedback, festival promotion.
- Add template groups for campaigns and drip sequences.
- Build template match logs if inbound automation is planned.

### 4. Sending And Campaigns

Observed routes/chunks:

- `/SendMessages`
- `/SendBulkMessage`
- `/SendCsvMessage`
- `/SendBulkMessageUsingContactFilters`
- `/SendCannedMessage`
- `SendTextMessage`
- `SendVideoMessage`
- `SendInteractiveMessage`
- `SendCatalogsMessage`
- `SendLocationRequestMessage`
- `SendBulkMessageUsingCSV`
- `UploadCSVForSendMessage`
- `PaymentMessageFields`
- `MetaSendMessageConfigs`
- `/DripCampaign`
- `/DripCampaign/Create`
- `/DripCampaign/Edit`

Feature meaning:

- Single message send
- Bulk send by pasted list
- Bulk send by CSV
- Bulk send by contact filters
- Canned messages
- Media and video messages
- Interactive messages
- Catalog messages
- Location request messages
- Payment messages
- Drip campaigns

metawhat state:

- Strong existing: single template send, bulk template send, campaign records, launch orchestrator, throughput guard, reply attribution, completion reports, failure intelligence
- Existing bulk page supports groups and templates
- Existing public API can send templates

Recommended target:

- Add first-class CSV import/send UI if not fully exposed in the product.
- Add contact-filter campaign builder UI using existing segment builder.
- Add scheduled send controls directly in composer.
- Add drip campaign UI on top of existing campaign sequence models.
- Add richer composer types: media, interactive buttons/lists, catalog product, location request, payment request.

### 5. Scheduled Items

Observed routes:

- `/ScheduledItems/ListMessage`
- `/ScheduledItems/ListCampaign`
- `/ScheduledItems/ChatbotsMessage`
- `ScheduleMessage`
- `ScheduleChatbotsMessage`
- `NextRunsModal`

Feature meaning:

- List and manage future single messages
- List and manage future campaigns
- List and manage scheduled chatbot messages
- Preview next run times

metawhat state:

- Navigation exists, but dynamic scheduled pages are placeholders:
  - `/dashboard/scheduled/single-messages`
  - `/dashboard/scheduled/campaigns`
  - `/dashboard/scheduled/chatbots`

Recommended target:

- Build scheduled item table with type, audience, template, scheduled time, timezone, next run, status, owner, cancel/resume actions.
- Reuse existing campaign scheduling and worker infrastructure where possible.

### 6. Inbox And Team Messaging

Observed routes/chunks:

- `/Inbox`
- `/Inbox/:waId`
- `EmbeddedInbox`
- `ContactDetails`
- `ContactNotesPanel`
- `SelectCannedMessage`
- `SendCannedMessage`
- `BulkPropertyPickerModal`
- `InboxSettings`

Feature meaning:

- Two-way inbox
- Contact side panel
- Notes
- Assignment controls
- Canned replies
- Send templates/media/interactives from inbox
- Embedded inbox mode for iframe/CRM embedding
- Inbox settings

metawhat state:

- Strong existing: inbox list/detail, reply, notes, tags, saved views, status, priority, assignee, snooze, SLA, quick replies, realtime events

Recommended target:

- Add embedded inbox mode if partners need to embed metawhat inside ERP/CRM.
- Add inbox settings page if not yet functional.
- Add sales pipeline/customer stage fields to the contact side panel.
- Add conversation-level conversion attribution for campaigns.

### 7. Contacts And CRM

Observed routes/chunks:

- `/Contact/Contacts`
- `/Contact/ContactLabel`
- `/Contact/ContactAttribute`
- `/Contact/ContactFilters`
- `/Contact/ContactFilters/Create`
- `/Contact/ContactFilters/Update`
- `/Contact/ContactAddresses`
- `/Contact/BlockContact`
- `ContactImportModal`
- `CreateContactFilter`
- `ContactFilters`
- `ContactLabels`
- `ContactAttributes`

Feature meaning:

- Contact list and detail
- Labels/tags
- Custom attributes
- Dynamic filters
- Saved filter creation/update
- Contact addresses
- Blocked contacts
- Imports

metawhat state:

- Strong existing: contacts, import jobs, groups, segments, CRM page, consent ledger, contact activity
- Placeholders: blocked contacts, contact addresses, contact settings

Recommended target:

- Make labels/attributes explicit product objects if segments currently cover only part of this need.
- Implement blocked contacts enforcement in send APIs and campaign preflight.
- Build contact addresses for billing/shipping/warranty use cases.
- Add field mapping for CSV and Google Sheets imports.

### 8. Google Sheets

Observed:

- `/GoogleSheets`
- `ListGoogleSheet`
- `EmbeddedSignupGoogle`
- `/api/v1/oath/google/connectedSheetAccount`
- Marketing site highlights WhatsApp + Google Sheet campaigns, triggers, reminders, and sending to unsaved numbers.

Feature meaning:

- Google OAuth
- Connect Google Sheet account
- List spreadsheets/sheets
- Map sheet columns to contacts/template variables
- Run campaigns from sheet rows
- Trigger messages from form/sheet submissions
- Schedule reminders from sheet data

metawhat state:

- `/dashboard/integrations/google-sheets` is placeholder

Recommended MVP:

- `GoogleConnection`: OAuth account, scopes, refresh token, connected email
- `GoogleSheetSource`: spreadsheet ID, sheet name, header row, selected columns
- `SheetCampaignMapping`: phone column, name column, template variable columns, consent column
- `SheetSyncJob`: manual sync and scheduled sync
- Send preview: show first 10 mapped rows and validation errors
- Import mode: sync rows into contacts/groups
- Campaign mode: send selected sheet rows through existing bulk campaign pipeline
- Trigger mode later: send on new row, changed status, due date, or form submission

### 9. Catalogs And Commerce

Observed routes/chunks:

- `/CatalogManager`
- `/Catalog/ItemsList`
- `/Catalog/Add`
- `/Catalog/Update`
- `/Catalog/Settings`
- `/Catalog/CatalogOrder`
- `CatalogConnectButton`
- `CatalogItemsList`
- `CatalogOrder`
- `SendCatalogsMessage`

Feature meaning:

- Connect catalog
- Manage catalog settings
- Product item list/add/update
- Send catalog/product messages
- View catalog orders

metawhat state:

- `/dashboard/catalogs` is placeholder
- Reports include catalog orders as placeholder

Recommended target:

- Start with catalog connection status and product list sync from Meta.
- Add product picker to composer.
- Add catalog order inbox/report view.
- Later add product import/export and ERP SKU mapping.

### 10. Payments, UPI, Wallets, And Billing

Observed routes/chunks:

- `/MetaPayments/CreditCenter`
- `/MetaPayments/MetaConfigs`
- `/MetaPayments/OrderPaymentDetails`
- `/MetaPayments/WhatsappChargesHistory`
- `/MetaPayments/WhatsappChargesHistory/AddBalance`
- `/MetaPayments/WhatsappChargesHistory/Ledger`
- `/MetaPayments/AiCredits`
- `/MetaPayments/AiCredits/AddBalance`
- `/MetaPayments/AiCredits/Spend`
- `/MetaPayments/AiCredits/Topups`
- `/MetaPayments/CallCharges`
- `/UPIConfig`
- `/UPITransaction`
- `/PaymentOverview`
- `/PaymentStatus`
- `/BuyPoints`
- `/BuyPoints/Wallet`
- `/BuyPoints/AiCredits`
- `/Subscription`
- `/Subscription/Wallet`
- `/Transaction`
- `IciciUpiConfig`
- `IciciUpiQrPayment`
- `IciciUpiTransaction`
- `DynamicPaymentFields`

Feature meaning:

- WhatsApp wallet
- AI wallet
- Calling charges
- Ledger and charge history
- UPI setup and transactions
- Payment status and overview
- Subscription and plan purchase
- Wallet recharge and point purchase

metawhat state:

- Strong existing: wallet, billing, subscriptions, Cashfree, invoices, refunds, usage quotas, scheduled plan changes, reconciliation, billing analytics
- Placeholder: WhatsApp payment configurations and payment transactions report
- Missing as product surfaces: AI wallet, call wallet/charges, UPI payment requests

Recommended target:

- Keep current Cashfree/subscription foundation.
- Add separate ledgers only if product truly needs WhatsApp credits, AI credits, and calling credits.
- Build payment configuration for WhatsApp payment messages only after confirming supported markets/provider requirements.
- Add wallet reservation and refund visibility for campaign sends.

### 11. Chatbots And Automation

Observed routes/chunks:

- `/Chatbot/BasicChatBot`
- `/Chatbot/AdvanceChatBot`
- `/Chatbot/AdvanceChatBot/:id`
- `/Chatbot/AdvanceChatBot/:id/:executionState`
- `/Chatbot/AdvanceChatBot/:id/:executionState/:executionId`
- `/Chatbot/ChatBotExecution`
- `ChatBotGenericNode`
- `ShowChatbotValidationErrors`
- `ScheduleChatbotsMessage`

Feature meaning:

- Basic chatbot builder
- Advanced visual chatbot builder
- Chatbot execution list/detail
- Node validation
- Scheduled chatbot messages

metawhat state:

- Chatbot reports/scheduled pages are placeholders
- WhatsApp Flows exist and are more official/productized than generic bot flows
- No obvious chatbot workflow builder UI in the current route list

Recommended target:

- Do not build a broad "ask anything" WhatsApp AI bot. Keep AI use business-specific: support triage, order status, lead qualification, FAQ from approved business knowledge, and human handoff.
- Build automation around WhatsApp Flows, template replies, quick replies, conditions, tags, assignment, and campaign reply attribution.
- Use existing campaign sequence models for drip/follow-up logic before creating a separate chatbot engine.

### 12. Integrations And Developer Platform

Observed routes/chunks:

- `/Integrations/Integrations`
- `/Integrations/ApiDocumentation`
- `/Integrations/ListApikey`
- `/Integrations/Webhook`
- `/Integrations/WhatsAppWidget`
- `/Integrations/Chatgpt`
- `/Integrations/Chatgpt/CreateConfig`
- `/Integrations/Chatgpt/UpdateConfig`
- `/Integrations/Chatgpt/VectorStores`
- `/Integrations/TradeIndia`
- `/Utility/WhatsAppClickToChat`
- `/Utility/SyncAcrossAccount`
- `ApiDocumentation`
- `Webhook`
- `WhatsAppWidgetGuide`
- `WhatsAppClickToChat`
- `TradeIndiaIntegration`
- `SyncAcrossAccount`

Feature meaning:

- API documentation
- API keys
- Webhooks
- Website WhatsApp widget
- Click-to-chat link generator
- ChatGPT/OpenAI config and vector stores
- TradeIndia integration
- Cross-account sync utilities

metawhat state:

- Strong existing: public API v1, API keys, developer webhooks, webhook outbox, logs, idempotency, docs route
- Placeholder: OpenAI and Google Sheets integration pages
- Placeholder: WhatsApp widget and chat link tools

Recommended target:

- Build developer docs UI around existing OpenAPI JSON.
- Add webhook delivery tester and replay UI if not fully exposed.
- Build WhatsApp widget generator and click-to-chat generator because they are low-cost, demo-friendly features.
- For OpenAI, keep configuration scoped to business workflows and avoid positioning as a general-purpose assistant inside WhatsApp.

### 13. Reporting And Analytics

Observed routes/chunks:

- `/Reporting/MessageReport`
- `/Reporting/CampaignsReport`
- `/Reporting/CampaignsReport/:campaignUploadFileId`
- `/Reporting/CallingReport`
- `SelectedCampaignReport`
- `CampaignsReport`
- `MessageReport`
- `CallingReport`
- `SelectedTemplateInsights`
- `PaymentOverview`
- `PaymentStatus`

Feature meaning:

- Message delivery reports
- Campaign reports and selected campaign detail
- Calling report
- Template insights
- Payment reports

metawhat state:

- Strong existing analytics services and pages for campaigns, campaign replies, failure insights, completion reports
- Specific report pages exist for messages and campaigns
- Placeholder generic reports: calling, chatbots, catalog orders, payment transactions

Recommended target:

- Build report exports as CSV/PDF for sales teams.
- Add delivery timeline per message and per recipient.
- Add template-level and campaign-level funnel: queued, sent, delivered, read, replied, converted, failed.
- Add calling/payment/catalog reports only after those modules are built.

### 14. Reseller, White Label, And Platform Admin

Observed routes/chunks:

- `/ResellerDashboard`
- `/Customer`
- `/Customer/:id`
- `/RCustomer/:id`
- `/AssignToCustomer`
- `/ResellerTransactions`
- `/ResellerTransactions/Wallet`
- `/ChargesHub`
- `/ChargesHub/CreateMargin`
- `/PlanMigration`
- `/ResellerPlanMigration`
- `/ResellerSkipPlans`
- `/whiteLabel`
- `/DomainSettings`
- `/FeatureManagement`
- `/AdminDashboard`
- `/AdminPlanMigration`
- `/AdminIntegrationsSettings`
- `/Support`
- `/SupportSettings`
- `/Settings/ThemeEditor`

Feature meaning:

- Reseller dashboard
- Child customer management
- Assign plans/wallet to customers
- Reseller transactions and wallet
- Margin rules
- Plan migrations
- White-label branding
- Domain settings
- Feature management
- Support settings
- Theme editor

metawhat state:

- Good platform foundation: company/partner model, platform company control, company plan assignment, audit logs, entitlements, billing profile
- Missing or not productized: full reseller dashboard, margin rules, white-label custom domain, theme editor, support settings

Recommended target:

- If reseller sales are important, build this after core customer parity.
- Start with partner workspace that can create/manage child companies, assign plans, view usage, and recharge wallet.
- Add white-label/custom domain later with clear operational boundaries.

### 15. ERP/POS/Tally/Busy And Mobile Printer

Observed marketing:

- "Send WhatsApp from any ERP or POS"
- Tally Prime, Tally ERP-9, Busy, Marg, Zoho, Wings compatibility
- Digital bill sender / mobile printer
- Send bills, invoices, warranty documents, ledgers, vouchers, reports
- QR warranty system
- Payment reminders
- Sales and purchase order automation

Feature meaning:

- Desktop/POS print interception or virtual printer workflow
- ERP integration for invoice/ledger/voucher PDFs
- Customer number extraction
- Automatic WhatsApp send after invoice generation
- QR warranty document generation
- Payment reminder automation

metawhat state:

- The current SaaS has messaging, contacts, wallet, templates, and campaigns.
- No obvious desktop printer/ERP agent module in the scanned app routes.

Recommended target:

- Treat ERP/POS integration as a separate companion product, not just a SaaS page.
- MVP options:
  - Simple public API + Tally/Busy connector documentation
  - Windows tray/print-watcher app that uploads PDF + phone + invoice metadata
  - CSV/Excel import path for invoice reminders
  - Webhook endpoint for ERP partners
- Use existing message worker and template send APIs after the ERP connector creates a send job.

### 16. RCS As Adjacent Channel

Observed marketing:

- Google RCS bulk promotions
- Text, image, video campaigns
- CTA buttons
- Positioned as cheaper and lower number-blocking risk than WhatsApp

Recommended target:

- Keep RCS out of the first WhatsApp parity milestone.
- Add as future multi-channel module if customers ask for promotional alternatives.

## Local metawhat Coverage Matrix

| Area | metawhat status | Priority | Recommendation |
|---|---:|---:|---|
| Multi-tenant SaaS | Strong | P0 | Keep as core advantage |
| Connected WhatsApp | Good | P0 | Add richer account health and audit UI |
| Templates | Good | P0 | Add insights, groups, predefined library, match logs |
| Single send | Good | P0 | Add more message types over time |
| Bulk campaigns | Good | P0 | Add CSV/filter/schedule polish |
| Contact groups | Good | P0 | Add labels/attributes/blocked/address settings |
| Contact import | Good | P0 | Add Google Sheets mapping later |
| Inbox | Strong | P0 | Add embedded mode and inbox settings |
| Reports | Partial | P1 | Finish message/campaign exports and placeholder reports |
| Scheduled items | Placeholder | P1 | Build list/cancel/resume screens |
| Google Sheets | Placeholder | P1 | Build OAuth, sheet mapping, sync, campaign send |
| Catalogs | Placeholder | P2 | Build connection, products, orders |
| WhatsApp payments | Placeholder | P2 | Build only after market/provider validation |
| Chatbots | Missing/partial | P2 | Prefer workflow automation and Flows first |
| Drip campaigns | Partial backend | P1 | Productize campaign sequence UI |
| API keys/public API | Strong | P0 | Add polished docs and examples |
| Developer webhooks | Strong | P1 | Add replay/test UX if needed |
| Widget/click-to-chat | Placeholder | P2 | Low-cost utility, good demo feature |
| Billing/wallet | Strong | P0 | Add WhatsApp/AI/call credit segmentation only if needed |
| Reseller/partner | Partial foundation | P2 | Build partner dashboard after customer parity |
| White-label | Missing | P3 | Build after reseller model is validated |
| ERP/POS/Tally/Busy | Missing | P1 | Build connector/API path for Indian SMB differentiation |
| Voice calling | Missing | P3 | Build only if Meta/market demand supports it |
| RCS | Missing | P3 | Future multi-channel expansion |

## Recommended Build Roadmap

### Phase 1: Core MessageAPI Parity Demo

Goal: show a complete customer journey from connect to send to report.

Build or polish:

- Connected WhatsApp account health page
- Template list/create/sync/submit/details
- Single send and bulk send with contacts/groups
- CSV send and contact-filter send
- Contacts, groups, import, labels/attributes
- Inbox with reply, notes, tags, assignee, status, quick replies
- Message and campaign reports with export
- Wallet/plan/current usage dashboard
- API docs and API key page

### Phase 2: Differentiating SMB Automation

Goal: match MessageAPI marketing promises for Indian SMBs.

Build:

- Google Sheets integration MVP
- ERP/POS/Tally/Busy connector strategy
- Payment reminders
- Invoice/ledger PDF send workflow
- QR warranty template/workflow
- Scheduled messages and scheduled campaigns
- Drip campaign UI

### Phase 3: Commerce And Advanced Automation

Goal: unlock high-value WhatsApp commerce and automation.

Build:

- Catalog connection and product sync
- Catalog message composer
- Catalog orders report
- WhatsApp payment configuration and payment reports if supported
- WhatsApp Flows builder polish
- Business-specific chatbot/workflow builder

### Phase 4: Partner, Reseller, And White Label

Goal: support agencies/resellers.

Build:

- Partner dashboard
- Child company creation and plan assignment
- Partner wallet/recharge ledger
- Margin rules
- White-label branding
- Custom domain/domain settings
- Theme editor
- Support impersonation/audit-safe customer support tools

## Suggested Data Models To Add

Only add these when the related phase starts.

Google Sheets:

- `GoogleConnection`
- `GoogleSheetSource`
- `GoogleSheetColumnMapping`
- `GoogleSheetSyncJob`
- `GoogleSheetSyncRow`
- `SheetCampaignRun`

Catalog:

- `CatalogConnection`
- `CatalogProduct`
- `CatalogProductSet`
- `CatalogOrder`
- `CatalogOrderItem`

Payments:

- `WhatsAppPaymentConfig`
- `WhatsAppPaymentRequest`
- `WhatsAppPaymentTransaction`
- `UpiProviderConfig`

Groups:

- `WhatsAppGroup`
- `WhatsAppGroupParticipant`
- `WhatsAppGroupMessage`

ERP/POS:

- `ErpConnection`
- `ErpDocument`
- `ErpDocumentSendJob`
- `WarrantyRegistration`
- `PaymentReminderRule`

Reseller/white-label:

- `PartnerCustomer`
- `PartnerWallet`
- `PartnerMarginRule`
- `WhiteLabelBranding`
- `CustomDomain`

## Product UX Notes

MessageAPI appears to use these UX patterns:

- Dense admin dashboard, not a marketing-style interface
- Left navigation with many operational modules
- Role-based menu visibility
- Tables with filters, search, status badges, and actions
- Modals/drawers for create/edit/import
- Phone/account selector in the app chrome
- Template/campaign/inbox workflows connected across screens
- Wallet and plan status visible throughout the product
- Embedded signup buttons for Meta/Google

Recommended metawhat UX direction:

- Keep the product quiet, dense, and work-focused.
- Reduce placeholder routes before adding more navigation.
- Make every major list page answer: what is the status, what failed, what needs action, what can the user do next?
- Add setup guides inside operational pages, not as marketing content.
- Treat wallet, plan, WhatsApp connection, and webhook health as always-visible operational signals.

## Compliance And Platform Notes

- WhatsApp templates and opt-in/consent should remain first-class. metawhat already has consent-ledger foundations; use them in imports, Google Sheets, and campaigns.
- AI should be business-workflow-specific, not a broad general-purpose WhatsApp assistant.
- Groups are now visible in Meta's current platform messaging as an official API area, but implementation should still be gated by eligibility, WABA status, permissions, and policy review.
- ERP/POS automation must avoid unofficial WhatsApp Web automation. Route sends through official WhatsApp Business Platform APIs.
- CSV/Google Sheets imports must track consent source, import source, and suppression/blocked-contact enforcement.

## Best Next Implementation Order

If the goal is "make like MessageAPI" quickly, do this order:

1. Finish placeholders already in navigation: Google Sheets, scheduled items, catalog, WhatsApp groups, payment configurations, widget/click-to-chat tools.
2. Productize drip campaigns and contact-filter campaigns using existing segment/campaign infrastructure.
3. Add template insights, predefined template library, and template groups.
4. Build ERP/POS/Tally/Busy connector MVP around public API and invoice PDF send jobs.
5. Add partner/reseller dashboard only after customer workflows are solid.

This order gives the fastest visible parity without wasting the strong backend platform already built in metawhat.
