# Campaign Launch Orchestrator

Campaign Launch Orchestrator connects WhatsApp bulk campaign safety modules into one production workflow.

## Environment

```env
CAMPAIGN_LAUNCH_ORCHESTRATOR_ENABLED="true"
CAMPAIGN_LAUNCH_REQUIRE_CONFIRMED_DRY_RUN="true"
CAMPAIGN_LAUNCH_REQUIRE_WALLET_RESERVE="true"
CAMPAIGN_LAUNCH_BATCH_SIZE="500"
CAMPAIGN_LAUNCH_MAX_RECIPIENTS="50000"
CAMPAIGN_LAUNCH_IDEMPOTENCY_REQUIRED="true"
CAMPAIGN_LAUNCH_QUEUE_NAME="campaign-launch"
```

## Flow

```txt
Template
-> Segment
-> Variable Mapping
-> Dry Run
-> Confirm Launch
-> Wallet Reservation
-> Create CampaignContact and Message rows
-> Queue existing message worker
-> Campaign dashboard and reporting
```

## Safety

Campaign launch requires:

```txt
Approved template
Valid segment
Mapped template variables
Passed dry run
Enough wallet balance
Idempotency key
Subscription, plan, message quota, and usage quota checks
```

## Worker

Run locally:

```bash
npm run worker:campaign-launch
```

In production, run it through PM2:

```bash
pm2 start ecosystem.config.cjs --only campaign-launch-worker
```

## Important

The launch worker creates campaign contacts, message rows, wallet ledger rows, and jobs for the existing message worker. The existing message worker still sends WhatsApp messages and updates delivery state.

Launch runs are idempotent per `companyId`, `campaignId`, and `idempotencyKey`, so retrying Prepare Launch with the same key returns the existing run instead of creating duplicates.
