/**
 * How certification reports, as opposed to what it checks. The rules
 * themselves are `conformance/cases.json`.
 */

import { describe, expect, test } from "bun:test";

import { meridianAdapters } from "../examples/meridian-bank/index.js";
import {
  certifyPartnerBankAdapter,
  createProviderAdapterRegistry,
  partnerBankConformanceFindings,
  type ProviderAdapter,
} from "../src/index.js";
import { applyCase, loadCases, loadSchema } from "./support/cases.js";
import { schemaViolations } from "./support/json-schema.js";

const [payoutAdapter] = meridianAdapters as readonly ProviderAdapter[];
if (!payoutAdapter) throw new Error("the example's payout adapter is missing");

const defineAdapters = createProviderAdapterRegistry();

describe("partner-bank certification", () => {
  test("a certified adapter throws nothing and reports nothing", () => {
    expect(partnerBankConformanceFindings(payoutAdapter)).toEqual([]);
    expect(() => certifyPartnerBankAdapter(payoutAdapter)).not.toThrow();
  });

  test("a failure names the adapter and lists every finding", () => {
    // One run reports everything it can see. An author fixing findings one
    // throw at a time would take as many runs as there are gaps.
    const broken = {
      ...payoutAdapter,
      bindings: {},
      profile: { ...payoutAdapter.profile, charges: undefined },
    } as unknown as ProviderAdapter;

    expect(() => certifyPartnerBankAdapter(broken)).toThrow(
      /meridian_bank:payout_execution failed partner-bank conformance \(2 findings\):[\s\S]*resource_binding_missing[\s\S]*charges_unestablished/,
    );
  });

  test("a single finding is reported in the singular", () => {
    const broken = { ...payoutAdapter, bindings: {} };
    expect(() => certifyPartnerBankAdapter(broken)).toThrow(
      "conformance (1 finding):",
    );
  });
});

describe("provider adapter plug-in registry", () => {
  test("preserves a valid registry's exact objects", () => {
    const adapters = [payoutAdapter] as const;
    expect(defineAdapters(adapters)).toBe(adapters);
  });

  test("rejects duplicate provider-capability identities", () => {
    expect(() => defineAdapters([payoutAdapter, payoutAdapter])).toThrow(
      "duplicate provider adapter meridian_bank:payout_execution",
    );
  });
});

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
      const declaration = applyCase(payoutAdapter, testCase);

      test("registry load", () => {
        const thrown = loadThrows(declaration);
        if (testCase.load === "accepts") {
          expect(thrown).toBeNull();
          return;
        }
        expect(thrown).toContain(testCase.load.throws);
      });

      test("conformance", () => {
        const codes = partnerBankConformanceFindings(
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
