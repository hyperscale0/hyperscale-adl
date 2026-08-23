/**
 * Loader and mutation applier for `conformance/cases.json`.
 *
 * A case is a path-addressed edit of the certified base declaration, applied
 * to a deep clone. Paths are arrays of keys rather than dotted strings
 * because operation names contain dots ("payout.submit"), and a missing
 * parent throws rather than silently creating one, so a typo in the data is a
 * failing test instead of a vacuous pass.
 */

import { readFileSync } from "node:fs";

import type { PartnerBankConformanceCode } from "../../src/index.js";

export interface ConformanceCase {
  readonly id: string;
  readonly title: string;
  readonly why: string;
  readonly mutate?: {
    readonly set?: readonly {
      readonly path: readonly string[];
      readonly value: unknown;
    }[];
    readonly delete?: readonly (readonly string[])[];
  };
  readonly load: "accepts" | { readonly throws: string };
  readonly conformance: readonly PartnerBankConformanceCode[];
  readonly schema: "accepts" | "rejects";
  readonly note?: string;
}

interface CaseFile {
  readonly description: string;
  readonly base: string;
  readonly cases: readonly ConformanceCase[];
}

export function loadCases(): readonly ConformanceCase[] {
  const file = JSON.parse(
    readFileSync(
      new URL("../../conformance/cases.json", import.meta.url),
      "utf8",
    ),
  ) as CaseFile;
  return file.cases;
}

export function loadSchema(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      new URL("../../spec/manifest.schema.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

/** The base declaration with one case's edits applied, as plain JSON. */
export function applyCase(
  base: unknown,
  testCase: ConformanceCase,
): Record<string, unknown> {
  const mutated = structuredClone(base) as Record<string, unknown>;
  for (const { path, value } of testCase.mutate?.set ?? []) {
    const [parent, key] = walk(mutated, path, testCase.id);
    parent[key] = structuredClone(value);
  }
  for (const path of testCase.mutate?.delete ?? []) {
    const [parent, key] = walk(mutated, path, testCase.id);
    delete parent[key];
  }
  return mutated;
}

function walk(
  root: Record<string, unknown>,
  path: readonly string[],
  caseId: string,
): [Record<string, unknown>, string] {
  const last = path.at(-1);
  if (path.length === 0 || last === undefined) {
    throw new Error(`case ${caseId}: empty mutation path`);
  }
  let current: unknown = root;
  for (const segment of path.slice(0, -1)) {
    if (!isRecord(current) || !(segment in current)) {
      throw new Error(
        `case ${caseId}: no value at ${path.join(".")} to mutate`,
      );
    }
    current = current[segment];
  }
  if (!isRecord(current)) {
    throw new Error(`case ${caseId}: no value at ${path.join(".")} to mutate`);
  }
  return [current, last];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
