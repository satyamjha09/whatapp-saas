# Campaign Throughput Guard

Campaign Throughput Guard controls campaign send speed and protects bulk sends from provider rate limits and WhatsApp quality damage.

## Environment

```env
CAMPAIGN_THROUGHPUT_GUARD_ENABLED="true"
CAMPAIGN_THROUGHPUT_DEFAULT_PER_MINUTE="60"
CAMPAIGN_THROUGHPUT_DEFAULT_PER_HOUR="1000"
CAMPAIGN_THROUGHPUT_MIN_DELAY_MS="250"
CAMPAIGN_THROUGHPUT_SLOW_MODE_MULTIPLIER="0.25"
CAMPAIGN_THROUGHPUT_AUTO_SLOWDOWN_ENABLED="true"
CAMPAIGN_THROUGHPUT_AUTO_PAUSE_ON_QUALITY_ERROR="true"
CAMPAIGN_THROUGHPUT_RATE_LIMIT_COOLDOWN_MINUTES="30"
CAMPAIGN_THROUGHPUT_REDIS_PREFIX="campaign-throughput"
```

## Modes

```txt
NORMAL
SLOW
PAUSED
```

## Worker Behavior

Before each campaign message send:

```txt
Campaign Throughput Guard
Provider Send
Failure Intelligence
```

If the guard denies a send slot, the message is returned to `RETRY_PENDING` and requeued with a delay.

## Auto-Slowdown

When a provider rate limit is detected:

```txt
NORMAL -> SLOW
cooldown applied
future messages delayed
```

## Auto-Pause

When quality or policy errors are detected:

```txt
Campaign throughput mode -> PAUSED
admin review required before continuing
```

This repository does not include the campaign-control pause service named in the original rollout brief, so auto-pause is enforced at the throughput policy layer.

## Dashboard

```txt
/dashboard/campaigns/throughput
```
