/**
 * Registry-level load rules: the ones that need more than one declaration to
 * state. Everything a single declaration can get wrong lives in
 * `conformance/cases.json` and runs from `conformance-cases.spec.ts`.
 */

import { describe, expect, test } from "bun:test";

import { meridianAdapters } from "../examples/meridian-bank/index.js";
import {
  createProviderAdapterRegistry,
  type ProviderAdapter,
} from "../src/index.js";

const defineAdapters = createProviderAdapterRegistry();
const [payoutAdapter] = meridianAdapters as readonly ProviderAdapter[];
if (!payoutAdapter) throw new Error("the example's payout adapter is missing");

describe("provider adapter plug-in registry", () => {
  test("preserves a valid registry's exact objects", () => {
    // The validator is a gate, never a transform: callers keep their literal
    // types and their object identities.
    const adapters = [payoutAdapter] as const;
    expect(defineAdapters(adapters)).toBe(adapters);
  });

  test("rejects duplicate provider-capability identities", () => {
    // Two adapters claiming one identity make dispatch order-dependent.
    expect(() => defineAdapters([payoutAdapter, payoutAdapter])).toThrow(
      "duplicate provider adapter meridian_bank:payout_execution",
    );
  });
});
