// Client-safe copy of the segment field/operator matrix. The server-side
// source of truth lives in contact-segment-builder.service.ts (SEGMENT_FIELD_OPERATORS);
// the API re-validates every rule, so drift here only affects UI options.

export type SegmentField =
  | "NAME"
  | "PHONE"
  | "EMAIL"
  | "COMPANY_NAME"
  | "CITY"
  | "SOURCE"
  | "TAG"
  | "OPTED_OUT"
  | "CREATED_AT"
  | "LAST_MESSAGE_AT"
  | "CUSTOM_FIELD"
  | "LEAD_SCORE";

export type SegmentOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "IN"
  | "EXISTS"
  | "NOT_EXISTS"
  | "BEFORE"
  | "AFTER"
  | "IN_LAST_DAYS"
  | "NOT_IN_LAST_DAYS"
  | "IS_TRUE"
  | "IS_FALSE"
  | "GREATER_THAN"
  | "LESS_THAN";

export type SegmentRuleDraft = {
  field: SegmentField;
  operator: SegmentOperator;
  customFieldKey?: string;
  value?: string;
};

export const FIELD_OPTIONS: Array<{
  value: SegmentField;
  label: string;
  operators: SegmentOperator[];
  valueType: "text" | "number" | "date" | "days" | "none-when-valueless";
}> = [
  {
    value: "NAME",
    label: "Name",
    operators: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "ENDS_WITH", "EXISTS", "NOT_EXISTS"],
    valueType: "text",
  },
  {
    value: "PHONE",
    label: "Phone number",
    operators: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "ENDS_WITH"],
    valueType: "text",
  },
  {
    value: "EMAIL",
    label: "Email",
    operators: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "EXISTS", "NOT_EXISTS"],
    valueType: "text",
  },
  {
    value: "COMPANY_NAME",
    label: "Company name",
    operators: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "EXISTS", "NOT_EXISTS"],
    valueType: "text",
  },
  {
    value: "CITY",
    label: "City",
    operators: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "EXISTS", "NOT_EXISTS"],
    valueType: "text",
  },
  {
    value: "SOURCE",
    label: "Source",
    operators: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS"],
    valueType: "text",
  },
  {
    value: "TAG",
    label: "Tag",
    operators: ["CONTAINS", "NOT_CONTAINS", "EQUALS", "EXISTS", "NOT_EXISTS"],
    valueType: "text",
  },
  {
    value: "OPTED_OUT",
    label: "Opted out",
    operators: ["IS_TRUE", "IS_FALSE"],
    valueType: "none-when-valueless",
  },
  {
    value: "CREATED_AT",
    label: "Created date",
    operators: ["BEFORE", "AFTER", "IN_LAST_DAYS", "NOT_IN_LAST_DAYS"],
    valueType: "date",
  },
  {
    value: "LAST_MESSAGE_AT",
    label: "Last reply date",
    operators: ["BEFORE", "AFTER", "IN_LAST_DAYS", "NOT_IN_LAST_DAYS", "EXISTS", "NOT_EXISTS"],
    valueType: "date",
  },
  {
    value: "CUSTOM_FIELD",
    label: "Custom attribute",
    operators: ["EQUALS", "NOT_EQUALS", "CONTAINS", "EXISTS", "NOT_EXISTS"],
    valueType: "text",
  },
  {
    value: "LEAD_SCORE",
    label: "Lead score",
    operators: ["EQUALS", "GREATER_THAN", "LESS_THAN"],
    valueType: "number",
  },
];

export const OPERATOR_LABELS: Record<SegmentOperator, string> = {
  EQUALS: "equals",
  NOT_EQUALS: "does not equal",
  CONTAINS: "contains",
  NOT_CONTAINS: "does not contain",
  STARTS_WITH: "starts with",
  ENDS_WITH: "ends with",
  IN: "is any of",
  EXISTS: "is not empty",
  NOT_EXISTS: "is empty",
  BEFORE: "before",
  AFTER: "after",
  IN_LAST_DAYS: "in the last N days",
  NOT_IN_LAST_DAYS: "not in the last N days",
  IS_TRUE: "is yes",
  IS_FALSE: "is no",
  GREATER_THAN: "greater than",
  LESS_THAN: "less than",
};

export const VALUELESS_OPERATORS: SegmentOperator[] = [
  "EXISTS",
  "NOT_EXISTS",
  "IS_TRUE",
  "IS_FALSE",
];

export function operatorNeedsValue(operator: SegmentOperator) {
  return !VALUELESS_OPERATORS.includes(operator);
}

export function valueInputType(field: SegmentField, operator: SegmentOperator) {
  if (operator === "IN_LAST_DAYS" || operator === "NOT_IN_LAST_DAYS") return "number";
  if (operator === "BEFORE" || operator === "AFTER") return "date";
  if (field === "LEAD_SCORE") return "number";
  return "text";
}

export const SEGMENT_PRESETS: Array<{
  name: string;
  description: string;
  matchMode: "ALL" | "ANY";
  rules: SegmentRuleDraft[];
}> = [
  {
    name: "All active contacts",
    description: "Everyone who has not opted out",
    matchMode: "ALL",
    rules: [{ field: "OPTED_OUT", operator: "IS_FALSE" }],
  },
  {
    name: "New contacts (7 days)",
    description: "Recently added or imported contacts",
    matchMode: "ALL",
    rules: [{ field: "CREATED_AT", operator: "IN_LAST_DAYS", value: "7" }],
  },
  {
    name: "Contacts with email",
    description: "Everyone with an email address",
    matchMode: "ALL",
    rules: [{ field: "EMAIL", operator: "EXISTS" }],
  },
  {
    name: "No reply yet",
    description: "Contacts who have never replied",
    matchMode: "ALL",
    rules: [{ field: "LAST_MESSAGE_AT", operator: "NOT_EXISTS" }],
  },
  {
    name: "Hot leads",
    description: "Lead score above 70",
    matchMode: "ALL",
    rules: [
      { field: "LEAD_SCORE", operator: "GREATER_THAN", value: "70" },
      { field: "OPTED_OUT", operator: "IS_FALSE" },
    ],
  },
];
