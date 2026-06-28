# Campaign Reply Attribution + Conversion Tracking

This module connects inbound WhatsApp replies back to the campaign that caused them.

## Environment

```env
CAMPAIGN_REPLY_ATTRIBUTION_ENABLED="true"
CAMPAIGN_REPLY_ATTRIBUTION_WINDOW_DAYS="14"
CAMPAIGN_REPLY_AUTO_CLASSIFY_ENABLED="true"
CAMPAIGN_REPLY_AUTO_OPT_OUT_ENABLED="true"
CAMPAIGN_REPLY_AUTO_CREATE_FOLLOW_UP_ENABLED="true"
CAMPAIGN_CONVERSION_TRACKING_ENABLED="true"
```

## Attribution Rule

When an inbound message arrives:

```txt
Find the latest outbound campaign message
for the same contact
within the attribution window.
```

Then create:

```txt
CampaignReplyAttribution
CampaignConversionEvent
CampaignFollowUpTask when needed
```

## Reply Intent

```txt
POSITIVE
NEGATIVE
QUESTION
OPT_OUT
NEUTRAL
UNKNOWN
```

## Conversion Events

```txt
REPLY_RECEIVED
POSITIVE_REPLY
DEMO_BOOKED
MEETING_DONE
PAYMENT_RECEIVED
LEAD_WON
LEAD_LOST
OPT_OUT
```

## Dashboard

```txt
/dashboard/campaigns/replies
```

## Why This Matters

Campaign success is not only delivery rate. A useful campaign report must show who replied, which campaign caused the reply, who opted out, who needs follow-up, which leads converted, and revenue value when available.
