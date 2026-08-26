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

export const providerEgressModes = [
  "none",
  "rest",
  "batch_reconcile",
  "sync_clearance",
] as const;

/** Which reference a read-after-write status enquiry is keyed by. */
export const statusEnquiryKeys = [
  "instruction_id",
  "provider_reference",
] as const;

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

/**
 * How a provider expects to be authenticated. `oauth2_password` is the
 * resource-owner password grant (username/password against the provider's own
 * token service) and `bearer_out_of_band` is a static bearer whose issuance
 * the provider does not document. Both are observed in the wild, neither is
 * pretty.
 */
export const providerAuthEnvelopes = [
  "oauth2_client_credentials",
  "oauth2_password",
  "bearer_out_of_band",
  "mutual_tls",
  "signed_file",
] as const;

export const providerNotificationMechanisms = ["poll", "webhook"] as const;

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

export const partnerBankWireCodecs = [
  "rest_json",
  "iso20022_xml",
  "swift_mt",
] as const;

export const partnerBankSignings = [
  "jws",
  "detached_signature",
  "signed_file",
] as const;

/** The canonical states a bank's own status spellings must map onto. */
export const partnerBankLifecycleStates = [
  "received",
  "accepted",
  "processed",
  "failed",
  "returned",
  "duplicate_original_succeeded",
  "duplicate_original_rejected",
  "duplicate_suspected_rejected",
] as const;

export const partnerBankStatementFormats = [
  "mt940",
  "mt942",
  "camt_052",
  "camt_053",
  "obie_json",
] as const;

/** Which reference the bank grades a duplicate instruction against. */
export const partnerBankDedupeKeys = [
  "client",
  "instructionId",
  "endToEndId",
  "paymentReference",
] as const;

/** When a statement covering a period becomes fetchable. */
export const statementAvailabilities = ["T-1", "today_only"] as const;

/** Which reference on a statement debit line names the instruction behind it. */
export const statementDebitReferences = [
  "bank_reference",
  "customer_reference",
] as const;

export const chargePostings = ["post_hoc", "at_instruction"] as const;

export const chargeVatModes = ["separate_line", "included_in_charge"] as const;

export const fxRateReadBacks = ["final_status_only"] as const;

/**
 * Whether the executed read-back may name a different rail than the one
 * instructed. `none` is a real inhabitant: a bank that never substitutes.
 */
export const railSubstitutions = ["ips_to_sarie", "none"] as const;

export const limitAccessModes = ["read_only"] as const;

export const limitDimensions = [
  "daily",
  "per_transaction",
  "foreign_exchange",
] as const;

export const financialAddressMechanisms = ["api", "scheme_file"] as const;

export const financialAddressPricing = ["none", "per_address"] as const;

export const financialAddressQuotas = ["none", "provider_enforced"] as const;

export type ProviderOperationDirection =
  (typeof providerOperationDirections)[number];
export type ProviderResourceBinding = (typeof providerResourceBindings)[number];
export type ProviderEgressMode = (typeof providerEgressModes)[number];
export type StatusEnquiryKey = (typeof statusEnquiryKeys)[number];
export type ProviderResponseEnvelope =
  (typeof providerResponseEnvelopes)[number];
export type ProviderAuthEnvelope = (typeof providerAuthEnvelopes)[number];
export type ProviderNotificationMechanism =
  (typeof providerNotificationMechanisms)[number];
export type ProviderTimestampField = (typeof providerTimestampFields)[number];
export type PartnerBankWireCodec = (typeof partnerBankWireCodecs)[number];
export type PartnerBankSigning = (typeof partnerBankSignings)[number];
export type PartnerBankLifecycleState =
  (typeof partnerBankLifecycleStates)[number];
export type PartnerBankStatementFormat =
  (typeof partnerBankStatementFormats)[number];
export type PartnerBankDedupeKey = (typeof partnerBankDedupeKeys)[number];
export type StatementAvailability = (typeof statementAvailabilities)[number];
export type StatementDebitReference = (typeof statementDebitReferences)[number];
export type ChargePosting = (typeof chargePostings)[number];
export type ChargeVatMode = (typeof chargeVatModes)[number];
export type FxRateReadBack = (typeof fxRateReadBacks)[number];
export type RailSubstitution = (typeof railSubstitutions)[number];
export type LimitAccessMode = (typeof limitAccessModes)[number];
export type LimitDimension = (typeof limitDimensions)[number];
export type FinancialAddressMechanism =
  (typeof financialAddressMechanisms)[number];
export type FinancialAddressPricing = (typeof financialAddressPricing)[number];
export type FinancialAddressQuota = (typeof financialAddressQuotas)[number];

/** A value date expressed as banking days after the instruction date. */
export type ValueDateOffset = `D+${number}`;
