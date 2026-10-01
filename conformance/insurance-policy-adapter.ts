import * as z from "zod";
import { createProviderAdapterRegistry } from "@hyperscale0/adl";

/** Quote and issuance only. The insurer supplies every commercial decision. */
export interface InsurancePolicyVocabulary {
  readonly capability: "insurance_policy";
  readonly obligation: "insurance_quote" | "insurance_policy";
  readonly operation:
    | "insurance.quote"
    | "insurance.bind"
    | "insurance.policy.observe";
  readonly resource: "insurance_quote" | "insurance_policy";
}

export const insurancePolicyAdapter =
  createProviderAdapterRegistry<InsurancePolicyVocabulary>()([
    {
      provider: "conformance_insurance",
      capability: "insurance_policy",
      bindings: { insurance_quote: "strict", insurance_policy: "strict" },
      operationMap: {
        "insurance.quote": {
          operation: "insurance.quote",
          direction: "tenant_initiated",
          obligationKind: "insurance_quote",
          resourceKind: "insurance_quote",
          resourceIdPath: "quoteId",
        },
        "insurance.bind": {
          operation: "insurance.bind",
          direction: "tenant_initiated",
          obligationKind: "insurance_policy",
          resourceKind: "insurance_policy",
          resourceIdPath: "policyId",
        },
        "insurance.policy.observe": {
          operation: "insurance.policy.observe",
          direction: "system_settlement",
          obligationKind: "insurance_policy",
          resourceKind: "insurance_policy",
          resourceIdPath: "policyId",
        },
      },
    },
  ])[0];

/** Minimal normalized issuance evidence, not a rating or underwriting schema. */
export function insurancePolicyIssuanceSchema(quoteId: string) {
  return z.strictObject({
    provider: z.literal(insurancePolicyAdapter.provider),
    policyId: z.string().min(1),
    quoteId: z.literal(quoteId),
    insurerId: z.string().min(1),
    state: z.literal("issued"),
    issuedAt: z.iso.datetime(),
    effectiveFrom: z.iso.datetime(),
    effectiveTo: z.iso.datetime(),
  });
}
