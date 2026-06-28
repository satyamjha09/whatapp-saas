# Campaign Failure Intelligence

Campaign Failure Intelligence explains why WhatsApp campaign messages failed and whether each group is safe to retry.

## Environment

```env
CAMPAIGN_FAILURE_INTELLIGENCE_ENABLED="true"
CAMPAIGN_FAILURE_AUTO_ANALYZE_ON_FAILURE="true"
CAMPAIGN_FAILURE_SAFE_RETRY_ENABLED="true"
CAMPAIGN_FAILURE_MAX_RETRY_PER_GROUP="5000"
CAMPAIGN_FAILURE_ANALYSIS_SAMPLE_SIZE="20"
CAMPAIGN_FAILURE_STALE_HOURS="24"
```

## Dashboard

```txt
/dashboard/campaigns/failures
```

## Categories

```txt
INVALID_PHONE
TEMPLATE_ERROR
TEMPLATE_VARIABLE_ERROR
INSUFFICIENT_WALLET
QUOTA_EXCEEDED
RATE_LIMIT
OUTSIDE_24H_WINDOW
CONTACT_OPTED_OUT
CONSENT_MISSING
PROVIDER_TIMEOUT
META_TEMPORARY
META_PERMANENT
WEBHOOK_ERROR
UNKNOWN
```

## Retry Safety

```txt
SAFE_TO_RETRY
RETRY_AFTER_FIX
DO_NOT_RETRY
```

Only `SAFE_TO_RETRY` groups can be retried directly from the dashboard.

## Examples

Invalid phone:

```txt
DO_NOT_RETRY
Fix contact number first.
```

Rate limit:

```txt
SAFE_TO_RETRY
Retry later or lower campaign throughput.
```

Template variable error:

```txt
RETRY_AFTER_FIX
Fix variable mapping and run dry run again.
```

## Legacy Failures

New failures write `Message.errorMessage`. Older rows are still analyzed from the latest failed `MessageEvent.raw.reason` when available.
