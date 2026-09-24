/** Closed value sets an adapter declaration may use. This module imports nothing. */

export const providerKeyPattern = /^[a-z][a-z0-9_.-]{0,79}$/;

export type ProviderOperationDirection =
  | "tenant_initiated"
  | "system_settlement";

export type ProviderResourceBinding =
  | "strict"
  | "claim"
  | "confirmation_only"
  | "evidence_only";

export const subjectFieldTypes = [
  "money",
  "ref",
  "date",
  "duration",
  "text",
  "integer",
  "percent",
  "boolean",
  "enum",
  "list",
] as const;

export type SubjectFieldType = (typeof subjectFieldTypes)[number];
