/**
 * Every closed value set an adapter declaration may use, as runtime arrays
 * with the types derived from them.
 *
 * One source of truth: the exported types below are `(typeof array)[number]`,
 * and `scripts/emit-spec.ts` builds `spec/manifest.schema.json` from the same
 * arrays. A value added here reaches the type checker and the published JSON
 * Schema in the same commit, so the two cannot drift.
 *
 * This module imports nothing, so both `index.ts` and `conformance.ts` can
 * read it without a load-order cycle.
 */

export const providerKeyPattern = /^[a-z][a-z0-9_.-]{0,79}$/;

export const providerOperationDirections = [
  "tenant_initiated",
  "system_settlement",
] as const;

export const providerResourceBindings = [
  "strict",
  "claim",
  "confirmation_only",
  "evidence_only",
] as const;

export const providerEgressModes = ["none", "rest", "sync_clearance"] as const;

/**
 * How one provider operation carries its outcome:
 *
 *   - `http_200_body_status` -- every response is HTTP 200 and the outcome
 *     classifies on a body status field, so a rejection can arrive as a
 *     status token inside a 200;
 *   - `http_status_error_body` -- the outcome rides the HTTP status and a
 *     failure carries a thin prose body (`{status, message}`);
 *   - `unconfirmed_until_live` -- the provider publishes no error sample at
 *     all, so the class is honestly unknown until first live traffic. An
 *     adapter must never borrow another provider's class to fill this in.
 */
export const providerResponseEnvelopes = [
  "http_200_body_status",
  "http_status_error_body",
  "unconfirmed_until_live",
] as const;

export const providerTimestampFields = [
  "activeAt",
  "completedAt",
  "failedAt",
  "returnedAt",
  "receivedAt",
  "clearedAt",
  "expiredAt",
  "voidedAt",
  "postedAt",
  "refundedAt",
] as const;

export type ProviderOperationDirection =
  (typeof providerOperationDirections)[number];
export type ProviderResourceBinding = (typeof providerResourceBindings)[number];
export type ProviderEgressMode = (typeof providerEgressModes)[number];
export type ProviderResponseEnvelope =
  (typeof providerResponseEnvelopes)[number];
export type ProviderTimestampField = (typeof providerTimestampFields)[number];
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
