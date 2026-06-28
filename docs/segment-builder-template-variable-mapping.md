# Segment Builder + Template Variable Mapping

This module lets users build reusable campaign recipient segments and map WhatsApp template variables from contact data.

## Environment

```env
SEGMENT_BUILDER_ENABLED="true"
SEGMENT_BUILDER_MAX_PREVIEW_CONTACTS="1000"
SEGMENT_BUILDER_MAX_RULES="25"
SEGMENT_BUILDER_CACHE_MINUTES="10"
TEMPLATE_VARIABLE_MAPPING_ENABLED="true"
TEMPLATE_VARIABLE_MAPPING_REQUIRE_ALL_VARIABLES="true"
TEMPLATE_VARIABLE_MAPPING_SAMPLE_COUNT="5"
```

## Segment Builder

Segments support rules such as:

```txt
marketing consent = GRANTED
source contains website
tag equals hot lead
created_at after 2026-01-01
last_message_at after 2026-01-01
```

Match modes:

```txt
ALL = every rule must match
ANY = at least one rule must match
```

The local contact schema currently supports phone, name, email, source, tags, consent, created date, and last reply date. City and custom field rule types exist in the schema for forward compatibility, but the service rejects them until matching contact columns exist.

## Variable Mapping

Template:

```txt
Hello {{name}}, your invoice {{1}} is ready.
```

Mapping:

```txt
name -> Contact field: name
1 -> Static value or system value
```

Supported mapping sources:

```txt
CONTACT_FIELD
STATIC_VALUE
SYSTEM_VALUE
CUSTOM_FIELD
```

`CUSTOM_FIELD` is stored for compatibility but requires a future contact custom-fields column to resolve values.

## Campaign Flow

```txt
Segment Builder -> Template Variable Mapping -> Bulk Send Safety -> Queue Campaign
```

The bulk message endpoint accepts `segmentId`. When present, recipients are built from the active segment and saved template mappings, then passed through the existing bulk send quotas, consent checks, wallet checks, and queueing pipeline.
