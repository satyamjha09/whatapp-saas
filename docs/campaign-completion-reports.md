# Campaign Completion Reports

Campaign Completion Reports generate the final evidence pack for WhatsApp bulk campaigns.

## Environment

```env
CAMPAIGN_COMPLETION_REPORTS_ENABLED="true"
CAMPAIGN_COMPLETION_AUTO_GENERATE_ENABLED="true"
CAMPAIGN_COMPLETION_STALE_HOURS="24"
CAMPAIGN_COMPLETION_MIN_AGE_MINUTES="5"
CAMPAIGN_REPORT_EXPORT_CSV_ENABLED="true"
CAMPAIGN_REPORT_AUTO_COMPLETE_CONTROL_STATE="true"
```

## Dashboard

```txt
/dashboard/campaigns/reports
```

## Report Contains

```txt
Total messages
Sent messages
Delivered messages
Read messages
Failed messages
Canceled messages
Delivery rate
Read rate
Failure rate
Estimated cost
Actual cost
Wallet reserved
Replies
Opt-outs
Failure insights
CSV export
```

## Completion Rule

A campaign is report-ready when:

```txt
queued messages = 0
sending messages = 0
total outbound campaign messages > 0
```

## CSV Export

The CSV includes message-level evidence:

```txt
message_id
contact_name
phone_last4
status
template_name
error_code
error_message
queued_at
sent_at
delivered_at
read_at
created_at
```
