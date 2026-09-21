import * as z from "zod";
import { udlObjectFieldSchema, type UdlObjectField } from "@hyperscale0/udl";
import {
  providerKeyPattern,
  subjectFieldTypes,
  type ProviderEgressMode,
  type ProviderOperationDirection,
  type ProviderResourceBinding,
  type ProviderResponseEnvelope,
  type ProviderTimestampField,
  type SubjectFieldType,
} from "./vocabulary.js";

export { subjectFieldTypes };
export type {
  ProviderEgressMode,
  ProviderOperationDirection,
  ProviderResourceBinding,
  ProviderResponseEnvelope,
  SubjectFieldType,
};

const boundaryId = z.string().min(1).max(240);
export const boundaryOutcomeSchema = z.enum([
  "acknowledged",
  "unknown",
  "confirmed",
  "rejected",
]);
export const boundaryInstructionSchema = z
  .strictObject({
    id: boundaryId,
    environment: z.enum(["sandbox", "live"]),
    tenantId: boundaryId,
    productId: boundaryId,
    productBuildId: boundaryId,
    buildDigest: boundaryId,
    target: z
      .strictObject({
        kind: boundaryId,
        attachment: boundaryId,
        instanceId: boundaryId,
      })
      .readonly(),
    sourceAccountId: boundaryId,
    destinationAccountId: boundaryId,
    amount: z.string().regex(/^[1-9][0-9]{0,17}$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    adapter: z.string().regex(providerKeyPattern),
  })
  .readonly();
export const boundaryObservationSchema = z
  .strictObject({
    adapter: z.string().regex(providerKeyPattern),
    externalReference: boundaryId,
    instructionId: boundaryId,
    outcome: boundaryOutcomeSchema,
    observedAt: z.iso.datetime(),
  })
  .readonly();
export type BoundaryInstruction = z.infer<typeof boundaryInstructionSchema>;
export type BoundaryObservation = z.infer<typeof boundaryObservationSchema>;
export type BoundaryOutcome = z.infer<typeof boundaryOutcomeSchema>;

/** Adapter implementation. Dispatch and enquiry never choose money bindings. */
export interface BoundaryAdapter {
  readonly id: string;
  dispatch(
    instruction: BoundaryInstruction,
  ): Promise<BoundaryObservation | undefined>;
  observe(
    instruction: BoundaryInstruction,
  ): Promise<BoundaryObservation | undefined>;
}

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
  readonly provider: string;
  readonly webhookMap: Readonly<
    Record<string, ProviderWebhookTransitionPlan<Vocabulary>>
  >;
}

export interface ProviderOperationBinding<
  Vocabulary extends ProviderAdapterVocabulary = ProviderAdapterVocabulary,
> {
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
  /**
   * Stored object metadata fields required by this operation. An array of UDL
   * object fields validated against the exported UDL schema and the closed
   * subject field type vocabulary. Absence means requirements are undeclared;
   * an explicit empty array declares no requirements. Neither implies
   * provider readiness.
   */
  readonly subjectRequirements?: readonly UdlObjectField[];
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
    if (binding.subjectRequirements !== undefined) {
      if (
        !Array.isArray(binding.subjectRequirements) ||
        binding.subjectRequirements.length > 128
      ) {
        throw new Error(
          `${adapter.provider} ${operation}.subjectRequirements must be an array of at most 128 fields`,
        );
      }
      for (const [
        index,
        requirement,
      ] of binding.subjectRequirements.entries()) {
        const result = udlObjectFieldSchema.safeParse(requirement);
        if (!result.success || result.data.optional) {
          throw new Error(
            `${adapter.provider} ${operation}.subjectRequirements[${index}] does not match UDL object field schema: ${result.success ? "action requirements cannot be optional" : result.error.message}`,
          );
        }
        if (
          !subjectFieldTypes.includes(
            requirement.type as (typeof subjectFieldTypes)[number],
          )
        ) {
          throw new Error(
            `${adapter.provider} ${operation}.subjectRequirements[${index}] unknown subject field type ${requirement.type}`,
          );
        }
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

function assertNonblank(provider: string, field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${provider} ${field} must not be blank`);
  }
}

export type AdapterConformanceCode =
  | "operation_map_empty"
  | "resource_binding_missing"
  | "declaration_invalid";
export interface AdapterConformanceFinding {
  readonly code: AdapterConformanceCode;
  readonly message: string;
  readonly path: string;
}

export function adapterConformanceFindings<
  Vocabulary extends ProviderAdapterVocabulary,
>(adapter: ProviderAdapter<Vocabulary>): readonly AdapterConformanceFinding[] {
  const findings = bindingFindings(adapter);
  if (Object.keys(adapter.operationMap).length === 0)
    findings.unshift({
      code: "operation_map_empty",
      path: "operationMap",
      message: "An adapter must declare an operation.",
    });
  try {
    createProviderAdapterRegistry<Vocabulary>()([adapter]);
  } catch (error) {
    findings.push({
      code: "declaration_invalid",
      path: "",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return findings;
}

function bindingFindings<Vocabulary extends ProviderAdapterVocabulary>(
  adapter: ProviderAdapter<Vocabulary>,
): AdapterConformanceFinding[] {
  const findings: AdapterConformanceFinding[] = [];
  const bindings = adapter.bindings as Readonly<
    Record<string, ProviderResourceBinding | undefined>
  >;
  const claimed = new Set<string>();

  const require = (kind: string, path: string) => {
    if (bindings[kind] !== undefined || claimed.has(kind)) return;
    claimed.add(kind);
    // Provider facts commit onto platform resources through a declared match
    // mode; a resource the adapter settles without one has no lawful way to
    // bind the observation.
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
