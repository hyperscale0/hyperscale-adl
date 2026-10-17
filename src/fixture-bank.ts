import {
  createProviderAdapterRegistry,
  bankCreditSchema,
  boundaryObservationSchema,
  type BankCredit,
  type BoundaryInstruction,
  type BoundaryObservation,
  type BoundaryOutcome,
} from "./index.js";

/**
 * A bank that holds fake money and answers like a real one, in sandbox and in
 * live until a real bank is connected. It has no network, accounts or policy
 * of its own beyond one per-payout limit.
 */
export const fixtureBank = createProviderAdapterRegistry()([
  {
    provider: "fixture_bank",
    capability: "boundary",
    bindings: { instruction: "strict" },
    operationMap: {
      "boundary.observe": {
        operation: "boundary.observe",
        direction: "system_settlement",
        obligationKind: "boundary_observation",
        resourceKind: "instruction",
        resourceIdPath: "instructionId",
        subjectRequirements: [],
      },
    },
  },
] as const)[0];

/**
 * Ids the fixture bank answered to before its rename. Owner ruling 2026-10-13:
 * a compiled Build runs for life, so a Build that names one still settles here.
 */
export const retiredFixtureBankIds: readonly string[] = [
  "conformance_boundary",
];

/** The adapter id a Build names, with a retired fixture bank id resolved. */
export function boundaryAdapterId(adapter: string): string {
  return retiredFixtureBankIds.includes(adapter)
    ? fixtureBank.provider
    : adapter;
}

/** The largest payout the fixture bank accepts: 100,000.00 in minor units. */
export const fixtureBankPayoutLimit = 10_000_000n;

export function observeBoundary(
  instruction: BoundaryInstruction,
  outcome: BoundaryOutcome,
  externalReference: string,
  observedAt: string,
  reason?: string,
): BoundaryObservation {
  if (boundaryAdapterId(instruction.adapter) !== fixtureBank.provider)
    throw new Error("instruction adapter mismatch");
  return boundaryObservationSchema.parse({
    adapter: instruction.adapter,
    instructionId: instruction.id,
    outcome,
    externalReference,
    observedAt,
    ...(reason ? { reason } : {}),
  });
}

/**
 * A payout's status as the bank reports it. Submission checks the limit and
 * rejects there, as a bank's own limit check does; a payout it accepts
 * settles by the next status enquiry.
 */
export function fixtureBankPayout(
  instruction: BoundaryInstruction,
  stage: "submit" | "enquire",
  observedAt: string,
): BoundaryObservation {
  if (BigInt(instruction.amount) > fixtureBankPayoutLimit)
    return observeBoundary(
      instruction,
      "rejected",
      `reject:${instruction.id}`,
      observedAt,
      "the amount is over the fixture bank's per-payout limit of 100,000.00",
    );
  return stage === "submit"
    ? observeBoundary(
        instruction,
        "acknowledged",
        `ack:${instruction.id}`,
        observedAt,
      )
    : observeBoundary(
        instruction,
        "confirmed",
        `settle:${instruction.id}`,
        observedAt,
      );
}

/** The credit notification the bank sends when money arrives in an account. */
export function fixtureBankCredit(input: {
  readonly reference: string;
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
  readonly observedAt: string;
  readonly adapter?: string;
}): BankCredit {
  return bankCreditSchema.parse({
    adapter: input.adapter ?? fixtureBank.provider,
    externalReference: `credit:${input.reference}`,
    accountId: input.accountId,
    amount: input.amount,
    currency: input.currency,
    observedAt: input.observedAt,
  });
}
