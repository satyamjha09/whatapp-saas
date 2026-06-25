# Default Trial Plan + Platform Plan Assignment

This feature assigns a default trial plan when a company is created and gives
platform admins a control surface for plan assignment, extension, suspension,
and cancellation.

## Environment

```env
DEFAULT_COMPANY_PLAN_CODE="trial"
DEFAULT_COMPANY_TRIAL_DAYS="14"
COMPANY_PLAN_ASSIGNMENT_ENABLED="true"
COMPANY_PLAN_REQUIRE_ACTIVE_ACCESS="true"
```

## Data Model

- `CompanyPlanAssignment` stores the current and historical plan records for a
  company.
- `CompanyPlanAssignmentEvent` stores an audit-style timeline for plan changes.
- Current plans are identified by `isCurrent = true`.
- Supported statuses are `TRIAL`, `ACTIVE`, `EXPIRED`, `CANCELED`, and
  `SUSPENDED`.

## Signup Flow

When signup creates or reuses a company owner workspace, the system calls
`assignDefaultTrialPlan`. Existing current assignments are preserved, so the
operation is safe to retry.

Signup -> Company -> Default Trial Assignment -> Onboarding

## Access Gate

Dashboard and tenant access require an active plan when
`COMPANY_PLAN_REQUIRE_ACTIVE_ACCESS` is enabled. Trial and active statuses are
allowed. Expired, canceled, suspended, or missing plans are blocked.

The customer-facing plan page at `/dashboard/account/plan` is intentionally
excluded from the gate so customers can view their current status and reach
billing actions.

## Platform Admin Control

Platform admins can manage a company's current plan from the platform company
detail screen:

- Assign a trial or active plan.
- Extend the trial period.
- Suspend a plan with a reason.
- Cancel the current plan.

Each action writes a plan event and an audit log entry.

## Health Checks

System health now reports plan assignment counts, trial counts, active plan
counts, expired plans, suspended plans, and whether plan assignment is enabled.
