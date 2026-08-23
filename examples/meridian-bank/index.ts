/**
 * Meridian Bank: a complete, certified adapter for a bank that does not
 * exist. Every endpoint, status token, and charge narrative below is
 * invented. It is here to be read top to bottom and copied.
 *
 * The order of the file is the order you write one:
 *
 *   1. the vocabulary -- the closed operation, resource, and webhook unions
 *      your product uses;
 *   2. the profile -- what the bank does, as facts;
 *   3. the config -- where the credentials live, never what they are;
 *   4. the adapters -- one per capability, validated at import.
 *
 * `docs/authoring-guide.md` explains every field. `fixtures/` holds the
 * bank's own bytes, and `example.spec.ts` proves the declaration matches
 * them.
 */

import {
  createProviderAdapterRegistry,
  type PartnerBankAdapterProfile,
  type ProviderAdapterVocabulary,
  type ProviderConfig,
} from "@hyperscale0/adl";

/**
 * The slice of the platform vocabulary this bank serves, spelled as closed
 * literal unions. Nothing here comes from a private import: the operation and
 * resource names are the published ones.
 */
export interface MeridianVocabulary extends ProviderAdapterVocabulary {
  readonly capability: "payout_execution" | "bank_credit";
  readonly domain: "payouts" | "deposits";
  readonly meter: "external_payout";
  readonly obligation:
    | "payout_submission"
    | "payout_execution"
    | "payout_return"
    | "bank_credit";
  readonly operation:
    | "payout.submit"
    | "payout.complete"
    | "payout.fail"
    | "payout.return"
    | "deposit.record";
  readonly resource: "payout" | "deposit";
  readonly webhookOperation: "payout.complete" | "deposit.record";
  readonly webhookResource: "payout" | "deposit";
  readonly webhookResourceId: "payoutId" | "depositId";
}

const defineMeridianAdapters =
  createProviderAdapterRegistry<MeridianVocabulary>();

/**
 * Meridian as its documentation and its sandbox describe it. Each fact is
 * something a runtime would otherwise have to guess, and a guess here is a
 * stranded payment.
 */
export const meridianProfile = {
  kind: "partner_bank",
  wireCodec: "rest_json",
  auth: {
    // Machine-to-machine client credentials, plus a detached signature over
    // the request body that Meridian verifies with the channel certificate.
    envelope: "oauth2_client_credentials",
    signing: "detached_signature",
  },
  idempotencySpine: {
    // Meridian grades a replay on the instruction id we mint, and refuses a
    // second payment carrying a payment reference it has already settled.
    dedupeKeys: ["instructionId", "paymentReference"],
    instructionId: { maxLength: 32 },
    endToEndId: { maxLength: 32 },
    paymentReference: { maxLength: 20 },
  },
  /**
   * Meridian's own status tokens on the left, the canonical states on the
   * right. Runtimes match after trimming and upper-casing, so a token that
   * only differs by case or padding needs no second entry.
   *
   * Both replay verdicts are spelled: without them a crash-recovery
   * resubmission reads as a fresh failure and the payout is instructed twice.
   */
  lifecycleVocabulary: {
    QUEUED: "received",
    IN_REVIEW: "received",
    AUTHORISED: "accepted",
    SETTLED: "processed",
    DECLINED: "failed",
    RECALLED: "returned",
    REPLAY_SETTLED: "duplicate_original_succeeded",
    REPLAY_DECLINED: "duplicate_original_rejected",
  },
  executedReadBack: {
    fxRate: "final_status_only",
    // Meridian never moves a payment to another rail behind our back.
    railSubstitution: "none",
  },
  charges: {
    // The bank raises its fee and its tax as two separate debits, each
    // recognizable only by the wording it prints. Prefixes, because the
    // trailing part names the payment being charged for.
    narratives: {
      charge: ["MERIDIAN FEE"],
      vat: ["MERIDIAN TAX"],
    },
    posting: "post_hoc",
    vat: "separate_line",
  },
  windows: {
    paymentCutoff: {
      time: "16:30",
      // The bank's wall clock, not the platform's.
      timeZone: "Europe/Dublin",
      beforeCutoffValueDate: "D+0",
      afterCutoffValueDate: "D+1",
    },
    valueDateMaxDaysAhead: 30,
    statements: {
      // End of day pages over history, so it declares how far back the
      // archive goes and how many days one request may cover.
      camt_053: {
        availability: "T-1",
        lookbackDays: 90,
        statementDaysPerRequest: 7,
      },
      // Intraday is today or nothing, so it owes no paging facts.
      camt_052: { availability: "today_only" },
    },
  },
  // Meridian echoes the reference we sent, not its own entry id. Reading the
  // entry id instead would leave every payout we instructed looking like an
  // unexplained debit.
  statementDebitReference: "customer_reference",
  statementFormats: ["camt_053", "camt_052"],
  // The callback is a hint that a poll is due. Polling is the fact.
  notificationMechanisms: ["poll", "webhook"],
  financialAddressProvisioning: {
    mechanism: "api",
    quota: "none",
    pricing: "none",
  },
  limitFacts: {
    access: "read_only",
    dimensions: ["daily", "per_transaction"],
  },
} as const satisfies PartnerBankAdapterProfile;

/**
 * A locator, never a value. The registry validator refuses a blank locator
 * and has no field a secret could be written into.
 */
const meridianConfig = {
  baseUrl: "https://api.meridian-bank.example/v2",
  credentialRef: {
    source: "environment",
    name: "MERIDIAN_BANK_CREDENTIALS",
  },
} as const satisfies ProviderConfig;

/**
 * One adapter per capability, both carrying the same bank profile. The
 * registry validates shape at import; `example.spec.ts` runs conformance.
 */
export const meridianAdapters = defineMeridianAdapters([
  {
    provider: "meridian_bank",
    capability: "payout_execution",
    domain: "payouts",
    egress: "rest",
    operationMap: {
      "payout.submit": {
        // Read-after-write: a submit whose response we never saw is re-read
        // here by the reference Meridian minted, never resubmitted blind.
        statusEnquiry: {
          keys: "provider_reference",
          pathTemplate: "/v2/payments/{providerReference}",
        },
        // Meridian answers on the HTTP status and puts prose in the body of a
        // failure, so a 4xx is the rejection and the body is for humans.
        envelope: "http_status_error_body",
        operation: "payout.submit",
        obligationKind: "payout_submission",
        resourceKind: "payout",
        resourceIdPath: "payoutId",
        direction: "tenant_initiated",
        meter: "external_payout",
      },
      // The three endings. Nothing is sent for them: they record what the
      // poll lane observed, so they carry no envelope of their own.
      "payout.complete": {
        operation: "payout.complete",
        obligationKind: "payout_execution",
        resourceKind: "payout",
        resourceIdPath: "payoutId",
        direction: "system_settlement",
      },
      "payout.fail": {
        operation: "payout.fail",
        obligationKind: "payout_execution",
        resourceKind: "payout",
        resourceIdPath: "payoutId",
        direction: "system_settlement",
      },
      "payout.return": {
        operation: "payout.return",
        obligationKind: "payout_return",
        resourceKind: "payout",
        resourceIdPath: "payoutId",
        direction: "system_settlement",
      },
    },
    webhookMap: {
      "payout.settled": {
        eventKind: "payout.settled",
        operationName: "payout.complete",
        requiredPayloadFields: ["providerReference", "valueDate"],
        optionalPayloadFields: ["chargeAmount"],
        requiredFieldGroups: [],
        resourceIdField: "payoutId",
        resourceKind: "payout",
        timestampField: "completedAt",
      },
    },
    bindings: { payout: "claim" },
    config: meridianConfig,
    profile: meridianProfile,
  },
  {
    provider: "meridian_bank",
    capability: "bank_credit",
    domain: "deposits",
    // Incoming credits are learned by reading statements, so this capability
    // sends Meridian nothing.
    egress: "none",
    operationMap: {
      "deposit.record": {
        operation: "deposit.record",
        obligationKind: "bank_credit",
        resourceKind: "deposit",
        resourceIdPath: "depositId",
        direction: "system_settlement",
      },
    },
    webhookMap: {
      "deposit.received": {
        eventKind: "deposit.received",
        operationName: "deposit.record",
        requiredPayloadFields: ["financialAddressId", "amount", "currency"],
        optionalPayloadFields: ["remitterName"],
        requiredFieldGroups: [],
        resourceIdField: "depositId",
        resourceKind: "deposit",
        timestampField: "receivedAt",
      },
    },
    bindings: { deposit: "strict" },
    config: meridianConfig,
    profile: meridianProfile,
  },
]);
