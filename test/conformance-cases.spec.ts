/**
 * The conformance corpus, run.
 *
 * Every rule in the suite is a row in `conformance/cases.json`: one broken
 * fact, and what each of the three gates says about it. This file is the
 * runner, not the rules, so adding a rule means adding a case there.
 */

import { describe, expect, test } from "bun:test";

import { meridianAdapters } from "../examples/meridian-bank/index.js";
import {
  createProviderAdapterRegistry,
  partnerBankConformanceCodes,
  partnerBankConformanceFindings,
  type ProviderAdapter,
} from "../src/index.js";
import { applyCase, loadCases, loadSchema } from "./support/cases.js";
import { schemaViolations } from "./support/json-schema.js";

const cases = loadCases();
const schema = loadSchema();
const defineAdapters = createProviderAdapterRegistry();
const [base] = meridianAdapters;
if (!base) throw new Error("the base adapter is missing from the example");

function loadThrows(declaration: Record<string, unknown>): string | null {
  try {
    defineAdapters([declaration as unknown as ProviderAdapter]);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("conformance corpus", () => {
  test("the corpus is not empty and every case is named once", () => {
    expect(cases.length).toBeGreaterThan(20);
    const ids = cases.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every conformance code is exercised by at least one case", () => {
    const exercised = new Set(
      cases.flatMap((testCase) => testCase.conformance),
    );
    const unexercised = partnerBankConformanceCodes.filter(
      (code) => !exercised.has(code),
    );
    expect(unexercised).toEqual([]);
  });

  test("the corpus bites: cases fail each gate", () => {
    // A guard against a vacuous run. If the mutations stopped applying, or
    // the schema validator stopped rejecting anything, these collapse to 0.
    const rejectedByLoad = cases.filter(
      (testCase) => testCase.load !== "accepts",
    );
    const rejectedBySchema = cases.filter(
      (testCase) => testCase.schema === "rejects",
    );
    const withFindings = cases.filter(
      (testCase) => testCase.conformance.length > 0,
    );
    expect(rejectedByLoad.length).toBeGreaterThan(9);
    expect(rejectedBySchema.length).toBeGreaterThan(9);
    expect(withFindings.length).toBeGreaterThan(19);
  });

  test("a gate that disagrees with registry load explains itself", () => {
    const unexplained = cases.filter((testCase) => {
      const loadRejects = testCase.load !== "accepts";
      const schemaRejects = testCase.schema === "rejects";
      return loadRejects !== schemaRejects && !testCase.note;
    });
    expect(unexplained.map((testCase) => testCase.id)).toEqual([]);
  });

  for (const testCase of cases) {
    describe(testCase.id, () => {
      const declaration = applyCase(base, testCase);

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
