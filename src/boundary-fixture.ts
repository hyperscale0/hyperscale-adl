import {
  createProviderAdapterRegistry,
  boundaryObservationSchema,
  type BoundaryInstruction,
  type BoundaryObservation,
  type BoundaryOutcome,
} from "./index.js";

/** The sandbox boundary adapter the platform registers. No transport, clock, accounts or inferred outcome. */
export const genericAdapter = createProviderAdapterRegistry()([
  {
    provider: "conformance_boundary",
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

export function observeBoundary(
  instruction: BoundaryInstruction,
  outcome: BoundaryOutcome,
  externalReference: string,
  observedAt: string,
): BoundaryObservation {
  if (instruction.adapter !== genericAdapter.provider)
    throw new Error("instruction adapter mismatch");
  return boundaryObservationSchema.parse({
    adapter: genericAdapter.provider,
    instructionId: instruction.id,
    outcome,
    externalReference,
    observedAt,
  });
}
