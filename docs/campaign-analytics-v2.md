# Campaign Analytics v2

Campaign Analytics v2 tracks campaign funnel metrics, replies, opt-outs, and usage cost from real message and ledger data.

## Dashboard

```txt
/dashboard/analytics/campaigns
/dashboard/analytics/campaigns/[campaignId]
```

## Metrics

- Total contacts
- Sent
- Delivered
- Read
- Failed
- Replies
- Opt-outs
- Total usage cost
- Sent rate
- Delivered rate
- Read rate
- Reply rate
- Opt-out rate
- Failure rate

## Reply Attribution

Inbound messages from campaign contacts are attributed to a campaign when they arrive inside the configured campaign reply window.

```env
CAMPAIGN_REPLY_ATTRIBUTION_WINDOW_HOURS="168"
```

## Scheduled Sync

The maintenance worker syncs recent campaign analytics every 15 minutes.

## CSV Export

```txt
/api/reports/campaign-analytics/export
```

## Environment

```env
CAMPAIGN_ANALYTICS_V2_ENABLED="true"
CAMPAIGN_REPLY_ATTRIBUTION_WINDOW_HOURS="168"
CAMPAIGN_ANALYTICS_SYNC_LIMIT="50"
```
