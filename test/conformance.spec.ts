/**
 * How certification reports, as opposed to what it checks. The rules
 * themselves are `conformance/cases.json`.
 */

import { describe, expect, test } from "bun:test";

import { meridianAdapters } from "../examples/meridian-bank/index.js";
import {
  certifyPartnerBankAdapter,
  partnerBankConformanceFindings,
  type ProviderAdapter,
} from "../src/index.js";

const [payoutAdapter] = meridianAdapters as readonly ProviderAdapter[];
if (!payoutAdapter) throw new Error("the example's payout adapter is missing");

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
