# Legal Acceptance Gate

The Legal Acceptance Gate blocks dashboard and mutating Public API usage until a company accepts the latest required Trust Center documents.

## Environment

```env
TRUST_CENTER_REQUIRE_TERMS_ACCEPTANCE="true"
TRUST_CENTER_REQUIRE_ACCEPTANCE_FOR_PUBLIC_API="true"
TRUST_CENTER_REQUIRED_DOCUMENT_TYPES="TERMS_OF_SERVICE,PRIVACY_POLICY,DATA_PROCESSING_AGREEMENT"
```

When omitted, these settings default to the values above.

## Required Documents

The default required documents are Terms of Service, Privacy Policy, and Data Processing Agreement. Run `npm run trust:seed` after applying the database migration to publish the initial versions.

The latest published version of every configured type must be accepted. Publishing a newer version automatically requires companies to accept that version.

## Dashboard Behavior

Users with an incomplete company acceptance are redirected to `/dashboard/legal/acceptance`. The page displays each document's version and SHA-256 hash and links to the public document at `/trust/[slug]`.

## Public API Behavior

Authenticated mutating Public API v1 routes return HTTP 403 with error code `LEGAL_ACCEPTANCE_REQUIRED` until acceptance is complete. Read-only routes remain available.

## Acceptance Evidence

Each immutable acceptance records the company, accepting user, document ID and type, version, SHA-256 content hash, source, IP address, user agent, and acceptance timestamp. The accept-all action also creates a tamper-evident company audit log.
