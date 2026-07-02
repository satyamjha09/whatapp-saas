export type DashboardNavItem = {
  label: string;
  href: string;
};

export type DashboardNavGroup = {
  label: string;
  href?: string;
  items?: DashboardNavItem[];
};

export const dashboardNavigation: DashboardNavGroup[] = [
  { label: "Dashboard", href: "/dashboard" },
  {
    label: "Connected Accounts",
    href: "/dashboard/whatsapp",
  },
  { label: "Templates", href: "/dashboard/templates" },
  {
    label: "Contact",
    items: [
      { label: "Contacts List", href: "/dashboard/contacts" },
      { label: "Import Contacts", href: "/dashboard/contacts/import" },
      { label: "Contact Groups", href: "/dashboard/contacts/groups" },
      { label: "Contact Settings", href: "/dashboard/contacts/settings" },
      { label: "Blocked Contacts", href: "/dashboard/contacts/blocked" },
      { label: "Contact Addresses", href: "/dashboard/contacts/addresses" },
    ],
  },
  {
    label: "Send Message",
    items: [
      { label: "Single", href: "/dashboard/messages/send" },
      { label: "Bulk Message", href: "/dashboard/messages/bulk" },
      { label: "Canned Message", href: "/dashboard/inbox/quick-replies" },
    ],
  },
  {
    label: "Automation",
    items: [
      { label: "Templates Library", href: "/dashboard/automation/templates" },
      { label: "Builder", href: "/dashboard/automation/builder" },
      { label: "Publish Approvals", href: "/dashboard/automation/approvals" },
      { label: "Execution Logs", href: "/dashboard/automation/executions" },
      { label: "Chatbots", href: "/dashboard/automation/chatbots" },
    ],
  },
  {
    label: "Scheduled Items",
    items: [
      {
        label: "Single Messages",
        href: "/dashboard/scheduled/single-messages",
      },
      { label: "Campaigns", href: "/dashboard/scheduled/campaigns" },
      { label: "Chatbots", href: "/dashboard/scheduled/chatbots" },
    ],
  },
  { label: "Inbox", href: "/dashboard/inbox" },
  {
    label: "Reports",
    items: [
      { label: "Messages", href: "/dashboard/reports/messages" },
      { label: "Campaigns", href: "/dashboard/reports/campaigns" },
      {
        label: "Campaign Analytics",
        href: "/dashboard/analytics/campaigns",
      },
      { label: "Calling Reports", href: "/dashboard/reports/calling" },
      { label: "Chatbot Executions", href: "/dashboard/reports/chatbots" },
      { label: "Catalog Orders", href: "/dashboard/reports/catalog-orders" },
      {
        label: "Payment Transactions",
        href: "/dashboard/reports/payment-transactions",
      },
    ],
  },
  { label: "Analytics", href: "/dashboard/reports" },
  {
    label: "Money",
    items: [
      { label: "Credit Center", href: "/dashboard/billing" },
      {
        label: "Subscription",
        href: "/dashboard/billing/subscription",
      },
      { label: "Current Plan", href: "/dashboard/account/plan" },
      { label: "Upgrade Plan", href: "/dashboard/billing/upgrade" },
      { label: "Invoices", href: "/dashboard/billing/invoices" },
      {
        label: "Refunds",
        href: "/dashboard/billing/refunds",
      },
      {
        label: "Export Center",
        href: "/dashboard/billing/export-center",
      },
      {
        label: "Billing Ops",
        href: "/dashboard/billing/ops",
      },
      {
        label: "Billing Profile",
        href: "/dashboard/billing/profile",
      },
      {
        label: "Billing Emails",
        href: "/dashboard/billing/email-deliveries",
      },
      {
        label: "Billing Analytics",
        href: "/dashboard/billing/analytics",
      },
      { label: "Usage Quotas", href: "/dashboard/billing/usage-quotas" },
      {
        label: "Subscription Renewals",
        href: "/dashboard/billing/subscription-renewals",
      },
      {
        label: "WhatsApp Credits",
        href: "/dashboard/billing/whatsapp-credits",
      },
      { label: "AI Credits", href: "/dashboard/billing/ai-credits" },
      {
        label: "Calling Credits",
        href: "/dashboard/billing/calling-credits",
      },
    ],
  },
  {
    label: "WhatsApp Items",
    items: [
      { label: "Catalogs", href: "/dashboard/catalogs" },
      { label: "Flows", href: "/dashboard/whatsapp/flows" },
      {
        label: "Payment Configurations",
        href: "/dashboard/whatsapp/payment-configurations",
      },
      { label: "WhatsApp Groups", href: "/dashboard/whatsapp/groups" },
    ],
  },
  {
    label: "Integrations & Utilities",
    items: [
      { label: "Integrations", href: "/dashboard/integrations" },
      { label: "ChatGPT / OpenAI", href: "/dashboard/integrations/openai" },
      {
        label: "Google Sheets",
        href: "/dashboard/integrations/google-sheets",
      },
      { label: "Developer", href: "/dashboard/developer" },
      { label: "Clone Items", href: "/dashboard/tools/clone-items" },
      {
        label: "WhatsApp Chat Link",
        href: "/dashboard/tools/whatsapp-chat-link",
      },
      {
        label: "WhatsApp Widget",
        href: "/dashboard/tools/whatsapp-widget",
      },
      {
        label: "Template Match Logs",
        href: "/dashboard/templates/match-logs",
      },
    ],
  },
  { label: "Notifications", href: "/dashboard/notifications" },
  {
    label: "Notification Preferences",
    href: "/dashboard/notifications/preferences",
  },
  {
    label: "Workspace Settings",
    items: [
      { label: "Profile", href: "/dashboard/settings/profile" },
      { label: "Onboarding", href: "/dashboard/onboarding" },
      { label: "Company", href: "/dashboard/settings/company" },
      { label: "Team", href: "/dashboard/settings/team" },
      { label: "Roles & Permissions", href: "/dashboard/team/roles" },
      { label: "API Keys", href: "/dashboard/developer/api-keys" },
      {
        label: "Developer Webhooks",
        href: "/dashboard/developer/webhooks",
      },
      {
        label: "Webhook Outbox",
        href: "/dashboard/developer/webhooks/outbox",
      },
      { label: "Privacy Center", href: "/dashboard/system/privacy" },
      {
        label: "Compliance Evidence",
        href: "/dashboard/system/compliance",
      },
      { label: "Data Retention", href: "/dashboard/system/data-retention" },
      { label: "Feature Entitlements", href: "/dashboard/system/entitlements" },
      { label: "System Health", href: "/dashboard/system/health" },
      { label: "Audit Logs", href: "/dashboard/settings/audit-logs" },
    ],
  },
  {
    label: "Production Checklist",
    href: "/dashboard/production-checklist",
  },
];
