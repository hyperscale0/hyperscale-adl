import {
  providerKeyPattern,
  statementAvailabilities,
  type ChargePosting,
  type ChargeVatMode,
  type FinancialAddressMechanism,
  type FinancialAddressPricing,
  type FinancialAddressQuota,
  type FxRateReadBack,
  type LimitAccessMode,
  type LimitDimension,
  type PartnerBankDedupeKey,
  type PartnerBankLifecycleState,
  type PartnerBankSigning,
  type PartnerBankStatementFormat,
  type PartnerBankWireCodec,
  type ProviderAuthEnvelope,
  type ProviderEgressMode,
  type ProviderNotificationMechanism,
  type ProviderOperationDirection,
  type ProviderResourceBinding,
  type ProviderResponseEnvelope,
  type ProviderTimestampField,
  type RailSubstitution,
  type StatementAvailability,
  type StatementDebitReference,
  type StatusEnquiryKey,
  type ValueDateOffset,
} from "./vocabulary.js";

export {
  certifyPartnerBankAdapter,
  partnerBankConformanceCodes,
  partnerBankConformanceFindings,
  type PartnerBankConformanceCode,
  type PartnerBankConformanceFinding,
} from "./conformance.js";

export { statementAvailabilities };
export type {
  ProviderEgressMode,
  ProviderOperationDirection,
  ProviderResourceBinding,
  ProviderResponseEnvelope,
};

export interface ProviderAdapterVocabulary {
  readonly capability: string;
  readonly domain: string;
  readonly meter: string;
  readonly obligation: string;
  readonly operation: string;
  readonly resource: string;
  readonly webhookOperation: string;
  readonly webhookResource: string;
  readonly webhookResourceId: string;
}

export interface ProviderAdapter<
  Vocabulary extends ProviderAdapterVocabulary = ProviderAdapterVocabulary,
> {
  readonly bindings: Partial<
    Record<Vocabulary["resource"], ProviderResourceBinding>
  >;
  readonly capability: Vocabulary["capability"];
  readonly config: ProviderConfig;
  readonly domain?: Vocabulary["domain"];
  readonly egress: ProviderEgressMode;
  readonly operationMap: Partial<
    Record<Vocabulary["operation"], ProviderOperationBinding<Vocabulary>>
  >;
  readonly profile?: PartnerBankAdapterProfile;
  readonly provider: string;
  readonly webhookMap: Readonly<
    Record<string, ProviderWebhookTransitionPlan<Vocabulary>>
  >;
}

export interface ProviderOperationBinding<
  Vocabulary extends ProviderAdapterVocabulary = ProviderAdapterVocabulary,
> {
  /**
   * Authoritative read-after-write status enquiry for a command whose response
   * may have been lost. Presence is an explicit provider-readiness commitment;
   * runtimes must never infer enquiry support from the command URL.
   */
  readonly statusEnquiry?: {
    readonly keys: StatusEnquiryKey;
    readonly pathTemplate: string;
  };
  /**
   * How THIS operation's response carries its outcome. Per operation, never
   * per provider and never inherited from another provider's class: one real
   * provider answers two ways, wrapping six of seven endpoints in
   * `{status, message, data}` while the seventh returns a bare object. Absent
   * means the class is not established yet -- an unclassified operation, not
   * a silent `http_200_body_status`.
   */
  readonly envelope?: ProviderResponseEnvelope;
  readonly operation: Vocabulary["operation"];
  readonly direction: ProviderOperationDirection;
  readonly meter?: Vocabulary["meter"];
  readonly obligationKind: Vocabulary["obligation"];
  readonly resourceIdPath: string;
  readonly resourceKind: Vocabulary["resource"];
}

export interface ProviderWebhookTransitionPlan<
  Vocabulary extends ProviderAdapterVocabulary = ProviderAdapterVocabulary,
> {
  readonly eventKind: string;
  readonly operationName: Vocabulary["webhookOperation"];
  readonly optionalPayloadFields: readonly string[];
  readonly requiredFieldGroups: readonly (readonly string[])[];
  readonly requiredPayloadFields: readonly string[];
  readonly resourceIdField: Vocabulary["webhookResourceId"];
  readonly resourceKind: Vocabulary["webhookResource"];
  readonly timestampField: ProviderTimestampField;
}

export type ProviderCredentialReference =
  | {
      readonly name: string;
      readonly source: "environment";
    }
  | {
      readonly account: string;
      readonly service: string;
      readonly source: "keychain";
    };

export interface ProviderConfig {
  readonly baseUrl?: string;
  readonly credentialRef?: ProviderCredentialReference;
}

/**
 * The fetch window facts for one declared statement format. The paging fields
 * are required for an end-of-day format (`availability: "T-1"` pages over
 * history) and absent for an intraday one; conformance enforces that split.
 */
export interface PartnerBankStatementWindow {
  readonly availability: StatementAvailability;
  readonly lookbackDays?: number;
  readonly statementDaysPerRequest?: number;
}

export interface PartnerBankAdapterProfile {
  readonly auth: {
    readonly envelope: ProviderAuthEnvelope;
    readonly signing: PartnerBankSigning;
  };
  /**
   * How the bank bills its own charges. `posting` says when the charge lands
   * (debited separately after the payment, or netted out of the instructed
   * amount); `vat` says whether the tax arrives as its own ledger line or
   * folded into the charge. Absent when a bank's charge behavior is not
   * established -- an unmodeled dimension, not a claim of post-hoc billing.
   */
  readonly charges?: {
    /**
     * The text this bank prints on its own charge lines, as prefixes: the
     * trailing part names the charged thing. Recognizing a charge is Executor
     * knowledge, so it is declared per bank and never inferred downstream, and
     * a bank whose charge wording is not established leaves this absent rather
     * than borrowing another bank's words.
     */
    readonly narratives?: {
      readonly charge: readonly string[];
      readonly vat: readonly string[];
    };
    readonly posting: ChargePosting;
    readonly vat: ChargeVatMode;
  };
  readonly executedReadBack: {
    readonly fxRate: FxRateReadBack;
    readonly railSubstitution: RailSubstitution;
  };
  readonly idempotencySpine: {
    readonly dedupeKeys: readonly PartnerBankDedupeKey[];
    readonly endToEndId: { readonly maxLength: number };
    readonly instructionId: { readonly maxLength: number };
    readonly paymentReference: { readonly maxLength: number };
  };
  readonly kind: "partner_bank";
  readonly lifecycleVocabulary: Readonly<
    Record<string, PartnerBankLifecycleState>
  >;
  readonly limitFacts: {
    readonly access: LimitAccessMode;
    readonly dimensions: readonly LimitDimension[];
  };
  readonly notificationMechanisms: readonly ProviderNotificationMechanism[];
  /**
   * Which reference on a statement debit line names the instruction behind it.
   * A statement entry carries two: the bank's own entry reference and the
   * client reference the instruction was sent with. Banks disagree about which
   * one comes back on the statement, and picking the wrong one makes every
   * payout the platform instructed look like an unexplained debit. Absent when
   * a bank's statement reference identity is not established.
   */
  readonly statementDebitReference?: StatementDebitReference;
  readonly statementFormats: readonly PartnerBankStatementFormat[];
  readonly financialAddressProvisioning: {
    readonly mechanism: FinancialAddressMechanism;
    readonly pricing: FinancialAddressPricing;
    readonly quota: FinancialAddressQuota;
  };
  readonly windows: {
    readonly paymentCutoff: {
      readonly afterCutoffValueDate: ValueDateOffset;
      readonly beforeCutoffValueDate: ValueDateOffset;
      /** Bank-local wall-clock time, HH:MM. */
      readonly time: string;
      /** The IANA time zone the cutoff time is read in (e.g. Europe/Dublin). */
      readonly timeZone: string;
    };
    /** One window per declared statement format, keyed by that format. */
    readonly statements: Partial<
      Readonly<Record<PartnerBankStatementFormat, PartnerBankStatementWindow>>
    >;
    readonly valueDateMaxDaysAhead: number;
  };
  readonly wireCodec: PartnerBankWireCodec;
}

/**
 * The insurance-distribution marketplace class, the partner bank's opposite
 * number: an aggregator API whose whole truth arrives in the command
 * response. Every field below is a recorded observation of one such surface,
 * not a reading of a standard.
 *
 * What makes the class distinct from `partner_bank`, and why each field exists:
 *
 *   - **Nothing to poll.** No status enquiry, no list, no read-back, no
 *     webhook, on any line. `notificationMechanisms` is empty by evidence, and
 *     the issuance response is the ONLY carrier of the policy identity -- so
 *     the transport must capture it durably BEFORE acknowledging the caller.
 *   - **No idempotency header exists anywhere in the corpus.** Dedupe runs on
 *     caller-minted business reference numbers replayed verbatim at each step,
 *     which is why the spine is a reference chain rather than a key.
 *   - **Auth is a bespoke credential exchange**, not OAuth2 client
 *     credentials: username/password against the provider's own login route
 *     yields a bearer with no documented lifetime, refresh, or scope.
 *   - **Errors are prose.** No machine error code appears anywhere, so an
 *     adapter cannot build a decline taxonomy from the docs alone.
 */
export interface InsuranceDistributorAdapterProfile {
  readonly kind: "insurance_distributor";
  readonly wireCodec: "rest_json";
  readonly auth: {
    readonly envelope: ProviderAuthEnvelope;
    /** How the bearer is obtained, when the provider documents it at all. */
    readonly acquisition: "password_login" | "out_of_band";
    readonly signing: "none";
  };
  /**
   * Envelope class per DOCUMENTED operation name, because one provider answers
   * in more than one shape. Keys are the provider's own operation names, not
   * platform operations -- this profile describes a surface no adapter has
   * integrated yet.
   */
  readonly envelopes: Readonly<Record<string, ProviderResponseEnvelope>>;
  /**
   * The correlation chain that stands in for an idempotency key: which
   * references the CALLER mints and which the provider mints, in the order the
   * exchange replays them.
   */
  readonly referenceChain: {
    readonly clientMinted: readonly string[];
    readonly providerMinted: readonly string[];
  };
  readonly notificationMechanisms: readonly ProviderNotificationMechanism[];
  /** Whether the provider publishes machine-readable failure codes. */
  readonly errorModel: "prose_only" | "coded";
  /** True when the command response is the only carrier of the created fact. */
  readonly captureBeforeAcknowledge: boolean;
}

/** Validate an adapter registry once at load, then preserve its exact type. */
function defineProviderAdapters<
  Vocabulary extends ProviderAdapterVocabulary,
  const Adapters extends readonly ProviderAdapter<Vocabulary>[],
>(adapters: Adapters): Adapters {
  const identities = new Set<string>();
  for (const adapter of adapters) {
    if (!providerKeyPattern.test(adapter.provider)) {
      throw new Error(`invalid provider key ${adapter.provider}`);
    }
    const identity = `${adapter.provider}:${adapter.capability}`;
    if (identities.has(identity)) {
      throw new Error(`duplicate provider adapter ${identity}`);
    }
    identities.add(identity);
    validateConfig(adapter.provider, adapter.config);
    validateOperations(adapter);
    validateWebhooks(adapter);
    if (adapter.profile) {
      validatePartnerBankProfile(adapter.provider, adapter.profile);
    }
  }
  return adapters;
}

/** Bind a product vocabulary once, then retain literal adapter registry types. */
export function createProviderAdapterRegistry<
  Vocabulary extends ProviderAdapterVocabulary,
>(): <const Adapters extends readonly ProviderAdapter<Vocabulary>[]>(
  adapters: Adapters,
) => Adapters {
  return (adapters) =>
    defineProviderAdapters<Vocabulary, typeof adapters>(adapters);
}

function validateConfig(provider: string, config: ProviderConfig): void {
  if (config.baseUrl) {
    try {
      new URL(config.baseUrl);
    } catch {
      throw new Error(`${provider} config.baseUrl must be an absolute URL`);
    }
  }
  const credential = config.credentialRef;
  if (!credential) return;
  if (credential.source === "environment") {
    assertNonblank(provider, "config.credentialRef.name", credential.name);
    return;
  }
  assertNonblank(provider, "config.credentialRef.account", credential.account);
  assertNonblank(provider, "config.credentialRef.service", credential.service);
}

function validateOperations<Vocabulary extends ProviderAdapterVocabulary>(
  adapter: ProviderAdapter<Vocabulary>,
): void {
  for (const [operation, binding] of Object.entries(adapter.operationMap) as [
    string,
    ProviderOperationBinding<Vocabulary>,
  ][]) {
    if (operation !== binding.operation) {
      throw new Error(
        `${adapter.provider} operationMap key ${operation} must match operation ${binding.operation}`,
      );
    }
    assertNonblank(
      adapter.provider,
      `${operation}.resourceIdPath`,
      binding.resourceIdPath,
    );
    if (binding.statusEnquiry) {
      assertNonblank(
        adapter.provider,
        `${operation}.statusEnquiry.pathTemplate`,
        binding.statusEnquiry.pathTemplate,
      );
      const placeholder =
        binding.statusEnquiry.keys === "instruction_id"
          ? "{instructionId}"
          : "{providerReference}";
      if (!binding.statusEnquiry.pathTemplate.includes(placeholder)) {
        throw new Error(
          `${adapter.provider} ${operation}.statusEnquiry.pathTemplate must include ${placeholder}`,
        );
      }
    }
  }
}

function validateWebhooks<Vocabulary extends ProviderAdapterVocabulary>(
  adapter: ProviderAdapter<Vocabulary>,
): void {
  for (const [event, plan] of Object.entries(adapter.webhookMap)) {
    if (event !== plan.eventKind) {
      throw new Error(
        `${adapter.provider} webhookMap key ${event} must match eventKind ${plan.eventKind}`,
      );
    }
  }
}

function validatePartnerBankProfile(
  provider: string,
  profile: PartnerBankAdapterProfile,
): void {
  if (!profile.notificationMechanisms.includes("poll")) {
    throw new Error(`${provider} partner-bank profile must support polling`);
  }
  if (Object.keys(profile.lifecycleVocabulary).length === 0) {
    throw new Error(
      `${provider} partner-bank profile has no lifecycle vocabulary`,
    );
  }
  assertUnique(provider, "statementFormats", profile.statementFormats);
  assertUnique(
    provider,
    "notificationMechanisms",
    profile.notificationMechanisms,
  );
  assertUnique(
    provider,
    "limitFacts.dimensions",
    profile.limitFacts.dimensions,
  );
  const spine = profile.idempotencySpine;
  // The dedupe keys widened from a fixed triple to a list, so the list now
  // carries the guarantees the tuple used to give for free.
  if (spine.dedupeKeys.length === 0) {
    throw new Error(`${provider} idempotencySpine.dedupeKeys is empty`);
  }
  assertUnique(provider, "idempotencySpine.dedupeKeys", spine.dedupeKeys);
  const spineLimits = {
    endToEndId: spine.endToEndId,
    instructionId: spine.instructionId,
    paymentReference: spine.paymentReference,
  };
  for (const [field, limit] of Object.entries(spineLimits)) {
    assertPositiveInteger(
      provider,
      `idempotencySpine.${field}.maxLength`,
      limit.maxLength,
    );
  }
  const windows = profile.windows;
  if (!/^\d{2}:\d{2}$/.test(windows.paymentCutoff.time)) {
    throw new Error(`${provider} windows.paymentCutoff.time must be HH:MM`);
  }
  // Intl.DateTimeFormat treats an undefined timeZone as the runtime default,
  // so presence must be checked before validity.
  const timeZone: unknown = windows.paymentCutoff.timeZone;
  if (typeof timeZone !== "string") {
    throw new Error(
      `${provider} windows.paymentCutoff.timeZone must be a valid IANA time zone`,
    );
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw new Error(
      `${provider} windows.paymentCutoff.timeZone must be a valid IANA time zone`,
    );
  }
  assertPositiveInteger(
    provider,
    "windows.valueDateMaxDaysAhead",
    windows.valueDateMaxDaysAhead,
  );
  for (const [format, window] of Object.entries(windows.statements)) {
    // TS requires availability, but a plain-JS consumer can send a window
    // without one, and an availability-less window is unschedulable.
    if (
      !(statementAvailabilities as readonly unknown[]).includes(
        window.availability,
      )
    ) {
      throw new Error(
        `${provider} windows.statements.${format}.availability must be one ` +
          `of ${statementAvailabilities.join(", ")}`,
      );
    }
    if (window.lookbackDays !== undefined) {
      assertPositiveInteger(
        provider,
        `windows.statements.${format}.lookbackDays`,
        window.lookbackDays,
      );
    }
    if (window.statementDaysPerRequest !== undefined) {
      assertPositiveInteger(
        provider,
        `windows.statements.${format}.statementDaysPerRequest`,
        window.statementDaysPerRequest,
      );
    }
  }
}

function assertPositiveInteger(
  provider: string,
  field: string,
  value: number,
): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${provider} ${field} must be a positive integer`);
  }
}

function assertUnique(
  provider: string,
  field: string,
  values: readonly string[],
): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${provider} ${field} contains duplicates`);
  }
}

function assertNonblank(provider: string, field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${provider} ${field} must not be blank`);
  }
}
