import { describe, expect, test } from "bun:test";
import { genericAdapter } from "../src/boundary-fixture.js";
import {
  adapterConformanceFindings,
  boundaryInstructionSchema,
  boundaryObservationSchema,
  createProviderAdapterRegistry,
  type ProviderAdapter,
} from "../src/index.js";
import { applyCase, loadCases, loadSchema } from "./support/cases.js";
import { schemaViolations } from "./support/json-schema.js";
const defineAdapters = createProviderAdapterRegistry();

describe("conformance corpus", () => {
  const cases = loadCases();
  const schema = loadSchema();

  function loadThrows(declaration: Record<string, unknown>): string | null {
    try {
      defineAdapters([declaration as unknown as ProviderAdapter]);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  for (const testCase of cases) {
    describe(testCase.id, () => {
      const declaration = applyCase(genericAdapter, testCase);

      test("registry load", () => {
        const thrown = loadThrows(declaration);
        if (testCase.load === "accepts") {
          expect(thrown).toBeNull();
          return;
        }
        expect(thrown).toContain(testCase.load.throws);
      });

      test("conformance", () => {
        const codes = adapterConformanceFindings(
          declaration as unknown as ProviderAdapter,
        ).map((finding) => finding.code);
        expect(codes).toEqual([...testCase.conformance]);
      });

      test("manifest schema", () => {
        const violations = schemaViolations(schema, declaration);
        if (testCase.schema === "accepts") {
          expect(violations).toEqual([]);
          return;
        }
        expect(violations).not.toEqual([]);
      });
    });
  }
});

test("refuses duplicate provider capability identities", () => {
  expect(() => defineAdapters([genericAdapter, genericAdapter])).toThrow(
    "duplicate provider adapter",
  );
});

const instruction = {
  id: "reserve1",
  environment: "sandbox",
  tenantId: "tenant1",
  productId: "product1",
  productBuildId: "build1",
  buildDigest: "digest1",
  target: { kind: "order", attachment: "payout", instanceId: "target1" },
  sourceAccountId: "source1",
  destinationAccountId: "destination1",
  amount: "100",
  currency: "SAR",
  adapter: "conformance_boundary",
};
const observation = {
  adapter: "conformance_boundary",
  externalReference: "observation1",
  instructionId: "reserve1",
  outcome: "confirmed",
  observedAt: "2026-09-20T00:00:00Z",
} as const;

test.each(Object.keys(instruction))(
  "instruction requires binding %s",
  (field) => {
    const incomplete: Record<string, unknown> = { ...instruction };
    delete incomplete[field];
    expect(boundaryInstructionSchema.safeParse(incomplete).success).toBe(false);
  },
);
test.each(["accepted", "200", "settled"])(
  "refuses inferred terminal outcome %s",
  (outcome) => {
    expect(
      boundaryObservationSchema.safeParse({ ...observation, outcome }).success,
    ).toBe(false);
  },
);
test.each(["0", "-1", "1.5"])(
  "refuses nonpositive or fractional amount %s",
  (amount) => {
    expect(
      boundaryInstructionSchema.safeParse({ ...instruction, amount }).success,
    ).toBe(false);
  },
);
test("accepts an explicit observation without changing its outcome", () => {
  expect(boundaryObservationSchema.parse(observation)).toEqual(observation);
});
