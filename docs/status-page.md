# Public Status Page & Trust Center

TallyKonnect includes a customer-facing status page to publish service status, active incidents, and maintenance schedules.

## Public Route

The public status page is exposed at:
- `/status`

This route is publicly accessible, SEO-optimized, and does not require authentication.

## Environment Configuration

```env
STATUS_PAGE_ENABLED="true"
STATUS_PAGE_PUBLIC_SLUG="tallykonnect"
STATUS_PAGE_BRAND_NAME="TallyKonnect Status"
STATUS_PAGE_SUPPORT_EMAIL="support@your-domain.com"
STATUS_PAGE_AUTO_SYNC_UPTIME="true"
```

## Seeding Components

To initialize the default status page and components ("Dashboard", "Public API", "WhatsApp Webhooks", and "Background Workers"), run:

```bash
npm run status:seed
```

## Admin Management

Administrators can monitor the status page configuration, view individual components, and review incident timelines at:
- `/dashboard/system/status-page`

## Component Status Sync

When `STATUS_PAGE_AUTO_SYNC_UPTIME` is set to `true`, a BullMQ maintenance job `status-page-sync` automatically runs every 5 minutes.
This job copies the status from corresponding `UptimeMonitor` entries (mapped by name or explicit ID) and updates the status of the status page components:
- `UP` $\rightarrow$ `OPERATIONAL`
- `DEGRADED` $\rightarrow$ `DEGRADED`
- `DOWN` $\rightarrow$ `MAJOR_OUTAGE`

## Manual Incident Posts

Administrators can create and update incidents via the following JSON POST endpoints:
- **Create Incident**: `POST /api/system/status-page/incidents`
- **Update Incident**: `POST /api/system/status-page/incidents/[incidentId]/updates`

Creating critical incidents automatically triggers platform-level incident escalation.
Uptime monitor recoveries will automatically mark their corresponding incidents as resolved.
