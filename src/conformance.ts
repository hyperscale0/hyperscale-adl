/**
 * Partner-bank conformance: the certification gate an adapter passes before it
 * may serve the family live. Registry load validation
 * (`createProviderAdapterRegistry`) proves a declaration is well-formed; this
 * module proves it is OPERABLE against the Bank Reference Model -- the
 * bank-agnostic contract distilled from observed bank behavior. Every rule
 * names the operational failure it prevents, and every rule fails closed: a
 * fact the adapter leaves unestablished is a finding, never a default.
 *
 * The checks are declaration-level on purpose. A partner-bank adapter is a
 * declaration (bindings, operation map, webhook plans, profile facts); the
 * runtime that executes it is generic. What certification must prove is that
 * the declared facts are complete enough for that runtime to poll, classify,
 * reconcile, and dedupe without guessing.
 */

import type {
  PartnerBankAdapterProfile,
  ProviderAdapter,
  ProviderAdapterVocabulary,
  ProviderOperationBinding,
  ProviderResourceBinding,
} from "./index.js";
import { statementAvailabilities } from "./vocabulary.js";

/**
 * Every rule this suite can report. Grows append-only: a released code is
 * never renamed or removed, so consumers may switch on codes without a
 * fallback arm going stale. `conformance/cases.json` must exercise all of
 * them, and `test/conformance-cases.spec.ts` fails when one is unexercised.
 */
export const partnerBankConformanceCodes = [
  "partner_bank_profile_missing",
  "operation_map_empty",
  "required_operation_missing",
  "response_envelope_unclassified",
  "response_envelope_unconfirmed",
  "status_enquiry_missing",
  "status_enquiry_without_rest_egress",
  "egress_direction_incoherent",
  "lifecycle_terminals_incomplete",
  "lifecycle_intake_missing",
  "lifecycle_spelling_blank",
  "lifecycle_spelling_conflict",
  "duplicate_verdicts_unmapped",
  "statement_debit_reference_unestablished",
  "statement_formats_empty",
  "statement_window_missing",
  "statement_window_incomplete",
  "charges_unestablished",
  "charge_narrative_unestablished",
  "vat_narrative_unestablished",
  "value_date_offset_invalid",
  "cutoff_window_regression",
  "cutoff_clock_invalid",
  "resource_binding_missing",
] as const;

export type PartnerBankConformanceCode =
  (typeof partnerBankConformanceCodes)[number];

export interface PartnerBankConformanceFinding {
  readonly code: PartnerBankConformanceCode;
  readonly message: string;
  /** Dotted location inside the adapter declaration, for the fix. */
  readonly path: string;
}

/**
 * The Bank Reference Model's operation floor per bank capability: the
 * commands an adapter must bind before the capability is served at all. An
 * adapter cannot dodge a command-level rule by not declaring the command.
 * Capabilities outside this table carry no floor beyond a non-empty map.
 */
const brmRequiredOperations: Readonly<Record<string, readonly string[]>> = {
  bank_credit: ["deposit.record"],
  beneficiary_verification: ["beneficiary.verify"],
  financial_address_provisioning: ["financial_address.activate"],
  payout_execution: ["payout.submit"],
};

/**
 * Every conformance finding for one adapter. The profile-independent checks
 * (operations, egress coherence, bindings) run even when the profile is
 * missing, so one run reports everything it can see; a missing profile leads
 * the list. An empty result is the certification. Callers wanting a hard
 * stop use `certifyPartnerBankAdapter`.
 */
export function partnerBankConformanceFindings<
  Vocabulary extends ProviderAdapterVocabulary,
>(
  adapter: ProviderAdapter<Vocabulary>,
): readonly PartnerBankConformanceFinding[] {
  const declarationFindings = [
    ...operationFindings(adapter),
    ...bindingFindings(adapter),
  ];
  const profile = adapter.profile;
  if (!profile) {
    return [
      {
        code: "partner_bank_profile_missing",
        message:
          "no partner-bank profile is declared, so none of the bank facts " +
          "(lifecycle vocabulary, statement identity, windows, charges) " +
          "exist for the runtime to operate from",
        path: "profile",
      },
      ...declarationFindings,
    ];
  }

  return [
    ...declarationFindings,
    ...lifecycleFindings(profile),
    ...statementFindings(profile),
    ...chargeFindings(profile),
    ...windowFindings(profile),
  ];
}

/** Throw with every finding listed; return silently on a certified adapter. */
export function certifyPartnerBankAdapter<
  Vocabulary extends ProviderAdapterVocabulary,
>(adapter: ProviderAdapter<Vocabulary>): void {
  const findings = partnerBankConformanceFindings(adapter);
  if (findings.length === 0) return;
  const lines = findings.map(
    (finding) => `  - [${finding.code}] ${finding.path}: ${finding.message}`,
  );
  throw new Error(
    `${adapter.provider}:${adapter.capability} failed partner-bank ` +
      `conformance (${findings.length} finding${findings.length === 1 ? "" : "s"}):\n` +
      lines.join("\n"),
  );
}

function operationFindings<Vocabulary extends ProviderAdapterVocabulary>(
  adapter: ProviderAdapter<Vocabulary>,
): PartnerBankConformanceFinding[] {
  const findings: PartnerBankConformanceFinding[] = [];
  const bindings = Object.entries(adapter.operationMap).filter(
    (entry): entry is [string, ProviderOperationBinding<Vocabulary>] =>
      entry[1] !== undefined,
  );

  // An adapter with no operations serves nothing, and a rule scoped to a
  // command must not be dodgeable by deleting the command.
  if (bindings.length === 0) {
    findings.push({
      code: "operation_map_empty",
      message:
        "no operations are bound, so the capability cannot be served and " +
        "every command-level rule is vacuously green",
      path: "operationMap",
    });
  }
  for (const required of brmRequiredOperations[adapter.capability] ?? []) {
    if (bindings.some(([operation]) => operation === required)) continue;
    findings.push({
      code: "required_operation_missing",
      message:
        `capability ${adapter.capability} must bind ${required}; without ` +
        "it the capability's command surface does not exist",
      path: `operationMap.${required}`,
    });
  }

  // A provider response exists to classify only where the runtime sends the
  // provider a command and reads an answer: tenant-initiated bindings on an
  // outbound egress mode. Observation-recorded settlements carry no response
  // of their own, and an envelope declared there would be a borrowed fact.
  const outboundEgress =
    adapter.egress === "rest" || adapter.egress === "sync_clearance";

  for (const [operation, binding] of bindings) {
    const path = `operationMap.${operation}`;
    const commandCarriesResponse =
      outboundEgress && binding.direction === "tenant_initiated";

    // An absent class on a real command means the runtime cannot tell
    // acceptance from rejection, and `unconfirmed_until_live` is the honest
    // authoring state for exactly that gap -- neither may serve live,
    // because a rejection read as silence strands money in flight.
    if (commandCarriesResponse && !binding.envelope) {
      findings.push({
        code: "response_envelope_unclassified",
        message:
          "no response envelope class is declared, so the runtime cannot " +
          "classify this command's outcome",
        path: `${path}.envelope`,
      });
    }
    if (binding.envelope === "unconfirmed_until_live") {
      findings.push({
        code: "response_envelope_unconfirmed",
        message:
          "the envelope class is declared unconfirmed; certification is the " +
          "licence to serve live, so the class must be established first",
        path: `${path}.envelope`,
      });
    }

    // Poll-first read-after-write: a REST command's response can be lost
    // after the bank acted on it. Without an authoritative status enquiry
    // the adapter's only options are guessing or double-submitting.
    if (
      adapter.egress === "rest" &&
      binding.direction === "tenant_initiated" &&
      !binding.statusEnquiry
    ) {
      findings.push({
        code: "status_enquiry_missing",
        message:
          "a tenant-initiated REST command declares no status enquiry, so a " +
          "lost response can only be resolved by guessing or resubmitting",
        path: `${path}.statusEnquiry`,
      });
    }
    // The exemption is earned by the egress mode, never by authoring
    // silence: an enquiry path on an adapter that performs no REST egress
    // is a plan the runtime can never execute.
    if (adapter.egress !== "rest" && binding.statusEnquiry) {
      findings.push({
        code: "status_enquiry_without_rest_egress",
        message:
          `a status enquiry is declared but egress is ${adapter.egress}, ` +
          "so the runtime has no transport to execute it",
        path: `${path}.statusEnquiry`,
      });
    }
    // Sending nothing (`none`) or reconciling from files (`batch_reconcile`)
    // cannot carry a tenant-initiated command; declaring one there promises
    // an outbound call the egress mode cannot make.
    if (
      (adapter.egress === "none" || adapter.egress === "batch_reconcile") &&
      binding.direction === "tenant_initiated"
    ) {
      findings.push({
        code: "egress_direction_incoherent",
        message:
          `a tenant-initiated command is bound but egress is ` +
          `${adapter.egress}, which performs no per-command outbound call`,
        path: `${path}.direction`,
      });
    }
  }
  return findings;
}

function lifecycleFindings(
  profile: PartnerBankAdapterProfile,
): PartnerBankConformanceFinding[] {
  const findings: PartnerBankConformanceFinding[] = [];
  const path = "profile.lifecycleVocabulary";
  const canonicalStates = new Set(Object.values(profile.lifecycleVocabulary));

  // Tri-state settlement is the model's spine: a submitted payment ends
  // processed, failed, or returned, and the poll lane owns the terminals. A
  // vocabulary that cannot spell one of them leaves that ending unclassifiable
  // and the payout polling forever.
  const missingTerminals = (
    ["processed", "failed", "returned"] as const
  ).filter((state) => !canonicalStates.has(state));
  if (missingTerminals.length > 0) {
    findings.push({
      code: "lifecycle_terminals_incomplete",
      message:
        `no bank spelling maps to ${missingTerminals.join(", ")}; a payment ` +
        "ending there would be unclassifiable and poll forever",
      path,
    });
  }

  // An ack proves the bank took the instruction, never that money moved.
  // Without an intake state every ack would have to be graded terminal or
  // dropped.
  if (!canonicalStates.has("received") && !canonicalStates.has("accepted")) {
    findings.push({
      code: "lifecycle_intake_missing",
      message:
        "no bank spelling maps to received or accepted, so an " +
        "acknowledgement has no non-terminal state to land on",
      path,
    });
  }

  // Banks spell one verdict several ways (case drift, trailing spaces), so
  // runtimes match spellings after trimming and upper-casing. A spelling that
  // is empty after that normalization matches nothing; two spellings that
  // collide under it while naming different canonical states make the
  // classification order-dependent.
  const normalized = new Map<string, { spelling: string; state: string }>();
  for (const [spelling, state] of Object.entries(profile.lifecycleVocabulary)) {
    const token = spelling.trim().toUpperCase();
    if (token.length === 0) {
      findings.push({
        code: "lifecycle_spelling_blank",
        message:
          "a lifecycle spelling is empty after trimming, so it can never " +
          "match a bank status token",
        path,
      });
      continue;
    }
    const existing = normalized.get(token);
    if (existing && existing.state !== state) {
      findings.push({
        code: "lifecycle_spelling_conflict",
        message:
          `"${spelling}" and "${existing.spelling}" normalize to the same ` +
          `token but map to ${state} and ${existing.state}`,
        path: `${path}.${spelling}`,
      });
      continue;
    }
    normalized.set(token, { spelling, state });
  }

  // The dedupe spine is reference-based by load law (a non-empty dedupeKeys
  // list), so the bank answers a crash-recovery resubmission with a duplicate
  // verdict graded against the original's outcome. An adapter that cannot
  // classify those verdicts reads its own recovery as a fresh failure.
  if (
    !canonicalStates.has("duplicate_original_succeeded") ||
    !canonicalStates.has("duplicate_original_rejected")
  ) {
    findings.push({
      code: "duplicate_verdicts_unmapped",
      message:
        "the vocabulary cannot classify duplicate verdicts, so a recovery " +
        "resubmission over the dedupe spine reads as a fresh failure",
      path,
    });
  }

  return findings;
}

function statementFindings(
  profile: PartnerBankAdapterProfile,
): PartnerBankConformanceFinding[] {
  const findings: PartnerBankConformanceFinding[] = [];

  // Statements are bank truth; reconciliation has nothing to prove the ledger
  // against without at least one fetchable format.
  if (profile.statementFormats.length === 0) {
    findings.push({
      code: "statement_formats_empty",
      message:
        "no statement format is declared, so reconciliation has no bank " +
        "truth to prove the ledger against",
      path: "profile.statementFormats",
    });
  }

  // A statement debit line carries two references -- the bank's own entry
  // reference and the client reference the instruction was sent with -- and
  // banks disagree about which comes back. Left unestablished, every payout
  // the platform instructed looks like an unexplained debit.
  if (!profile.statementDebitReference) {
    findings.push({
      code: "statement_debit_reference_unestablished",
      message:
        "which reference ties a statement debit to its instruction is not " +
        "established, so every instructed payout reads as an unexplained " +
        "debit",
      path: "profile.statementDebitReference",
    });
  }

  return findings;
}

function chargeFindings(
  profile: PartnerBankAdapterProfile,
): PartnerBankConformanceFinding[] {
  const findings: PartnerBankConformanceFinding[] = [];
  const charges = profile.charges;

  // The profile allows an absent charge model as honest authoring; a
  // certified adapter cannot leave it open, because the bank's own charge
  // debits would land as unexplained statement lines.
  if (!charges) {
    return [
      {
        code: "charges_unestablished",
        message:
          "the bank's charge billing is unmodeled, so its own charge debits " +
          "would land as unexplained statement lines",
        path: "profile.charges",
      },
    ];
  }

  // Post-hoc charges arrive as bank-initiated debits recognized only by their
  // narrative wording; a separate VAT line is its own debit with its own
  // wording. Each mode in play needs at least one declared prefix.
  const chargeNarratives = charges.narratives?.charge ?? [];
  if (charges.posting === "post_hoc" && chargeNarratives.length === 0) {
    findings.push({
      code: "charge_narrative_unestablished",
      message:
        "charges post after the payment but no charge narrative prefix is " +
        "declared, so the bank's charge debits are unrecognizable",
      path: "profile.charges.narratives.charge",
    });
  }
  const vatNarratives = charges.narratives?.vat ?? [];
  if (charges.vat === "separate_line" && vatNarratives.length === 0) {
    findings.push({
      code: "vat_narrative_unestablished",
      message:
        "VAT arrives as its own ledger line but no VAT narrative prefix is " +
        "declared, so the tax debits are unrecognizable",
      path: "profile.charges.narratives.vat",
    });
  }

  return findings;
}

function windowFindings(
  profile: PartnerBankAdapterProfile,
): PartnerBankConformanceFinding[] {
  const findings: PartnerBankConformanceFinding[] = [];
  const cutoff = profile.windows.paymentCutoff;
  const beforeDays = valueDateOffsetDays(cutoff.beforeCutoffValueDate);
  const afterDays = valueDateOffsetDays(cutoff.afterCutoffValueDate);

  // The type says `D+<number>`, but a plain-JS consumer can send anything
  // ("T+1", "D+1.5"), and a malformed offset must be a finding rather than a
  // NaN that slides through every comparison below.
  if (beforeDays === null) {
    findings.push({
      code: "value_date_offset_invalid",
      message:
        `"${cutoff.beforeCutoffValueDate}" is not a D+<days> offset with a ` +
        "non-negative whole number of days",
      path: "profile.windows.paymentCutoff.beforeCutoffValueDate",
    });
  }
  if (afterDays === null) {
    findings.push({
      code: "value_date_offset_invalid",
      message:
        `"${cutoff.afterCutoffValueDate}" is not a D+<days> offset with a ` +
        "non-negative whole number of days",
      path: "profile.windows.paymentCutoff.afterCutoffValueDate",
    });
  }

  // Registry load validates the cutoff clock too, but certification is the
  // public gate a third-party adapter author runs, so it must not stay green
  // on a clock the runtime would misread. Intl.DateTimeFormat reads an
  // undefined timeZone as the runtime default, so presence comes before
  // validity.
  if (typeof cutoff.time !== "string" || !/^\d{2}:\d{2}$/.test(cutoff.time)) {
    findings.push({
      code: "cutoff_clock_invalid",
      message:
        `paymentCutoff.time "${String(cutoff.time)}" is not an HH:MM ` +
        "wall-clock time",
      path: "profile.windows.paymentCutoff.time",
    });
  }
  if (!isValidTimeZone(cutoff.timeZone)) {
    findings.push({
      code: "cutoff_clock_invalid",
      message:
        `paymentCutoff.timeZone "${String(cutoff.timeZone)}" is not a valid ` +
        "IANA time zone, so the cutoff cannot be read on the bank's clock",
      path: "profile.windows.paymentCutoff.timeZone",
    });
  }

  // Missing the cutoff can only push value later, and the bank must be able
  // to honor its own after-cutoff value date within its forward window. Two
  // independent facts, reported independently.
  if (beforeDays !== null && afterDays !== null && afterDays < beforeDays) {
    findings.push({
      code: "cutoff_window_regression",
      message:
        `after-cutoff value date D+${afterDays} is earlier than ` +
        `before-cutoff D+${beforeDays}; missing a cutoff cannot move value ` +
        "earlier",
      path: "profile.windows.paymentCutoff",
    });
  }
  if (afterDays !== null && profile.windows.valueDateMaxDaysAhead < afterDays) {
    findings.push({
      code: "cutoff_window_regression",
      message:
        `the forward window ends ${profile.windows.valueDateMaxDaysAhead} ` +
        `days out but the after-cutoff value date needs D+${afterDays}`,
      path: "profile.windows.valueDateMaxDaysAhead",
    });
  }

  // Every declared statement format needs its fetch window, and an
  // end-of-day format pages over history, so its window needs the paging
  // facts (how far back, how many days per request).
  for (const format of profile.statementFormats) {
    const window = profile.windows.statements[format];
    if (!window) {
      findings.push({
        code: "statement_window_missing",
        message:
          `statement format ${format} is declared but has no fetch window, ` +
          "so the runtime cannot schedule its retrieval",
        path: `profile.windows.statements.${format}`,
      });
      continue;
    }
    // TS requires availability, but a plain-JS consumer can send a window
    // without one or with a spelling outside the enum, and every rule below
    // branches on it -- an unrecognized value must not slide through green.
    if (
      !(statementAvailabilities as readonly unknown[]).includes(
        window.availability,
      )
    ) {
      findings.push({
        code: "statement_window_incomplete",
        message:
          `statement format ${format} declares availability ` +
          `"${String(window.availability)}", which is not one of ` +
          `${statementAvailabilities.join(", ")}, so the runtime cannot ` +
          "schedule its retrieval",
        path: `profile.windows.statements.${format}.availability`,
      });
      continue;
    }
    if (
      window.availability === "T-1" &&
      (!isPositiveInteger(window.lookbackDays) ||
        !isPositiveInteger(window.statementDaysPerRequest))
    ) {
      findings.push({
        code: "statement_window_incomplete",
        message:
          `end-of-day format ${format} pages over history but declares no ` +
          "positive lookbackDays and statementDaysPerRequest",
        path: `profile.windows.statements.${format}`,
      });
    }
  }

  return findings;
}

function bindingFindings<Vocabulary extends ProviderAdapterVocabulary>(
  adapter: ProviderAdapter<Vocabulary>,
): PartnerBankConformanceFinding[] {
  const findings: PartnerBankConformanceFinding[] = [];
  const bindings = adapter.bindings as Readonly<
    Record<string, ProviderResourceBinding | undefined>
  >;
  const claimed = new Set<string>();

  const require = (kind: string, path: string) => {
    if (bindings[kind] !== undefined || claimed.has(kind)) return;
    claimed.add(kind);
    // Provider facts commit onto platform resources through a declared match
    // mode; a resource the adapter settles without one has no lawful way to
    // bind the bank's answer.
    findings.push({
      code: "resource_binding_missing",
      message:
        `resource kind ${kind} is settled by this adapter but declares no ` +
        "binding mode, so provider facts have no lawful way to commit",
      path,
    });
  };

  for (const binding of Object.values(adapter.operationMap) as (
    | ProviderOperationBinding<Vocabulary>
    | undefined
  )[]) {
    if (!binding) continue;
    require(binding.resourceKind, `bindings.${binding.resourceKind}`);
  }
  for (const plan of Object.values(adapter.webhookMap)) {
    require(plan.resourceKind, `bindings.${plan.resourceKind}`);
  }

  return findings;
}

/** Parse `D+<days>`; null for anything that is not a whole-day offset. */
function valueDateOffsetDays(offset: `D+${number}`): number | null {
  const match = /^D\+(0|[1-9]\d*)$/.exec(offset);
  return match ? Number(match[1]) : null;
}

function isPositiveInteger(value: number | undefined): boolean {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

/** The type says string, but a plain-JS consumer can send anything. */
function isValidTimeZone(timeZone: unknown): boolean {
  if (typeof timeZone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
