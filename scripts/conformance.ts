/**
 * Run partner-bank conformance against an adapter module.
 *
 *   bun run conformance -- ./examples/meridian-bank
 *   bun run conformance -- ./path/to/your/adapter.ts
 *
 * The module may export a single adapter or an array of them, under any
 * name. Every exported adapter is certified; the run exits 1 if any of them
 * reports a finding, so a CI job needs no extra glue.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  partnerBankConformanceFindings,
  type ProviderAdapter,
} from "../src/index.js";

const targets = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
if (targets.length === 0) {
  console.error("usage: bun run conformance -- <adapter module>...");
  process.exit(2);
}

let findingCount = 0;
let adapterCount = 0;

for (const target of targets) {
  const moduleUrl = pathToFileURL(entryPointFor(target)).href;
  const exported: Record<string, unknown> = await import(moduleUrl);
  const adapters = [...collectAdapters(exported)];
  if (adapters.length === 0) {
    console.error(`${target}: no provider adapters are exported`);
    process.exit(2);
  }
  for (const adapter of adapters) {
    adapterCount += 1;
    const findings = partnerBankConformanceFindings(adapter);
    const identity = `${adapter.provider}:${adapter.capability}`;
    if (findings.length === 0) {
      console.log(`ok    ${identity}`);
      continue;
    }
    findingCount += findings.length;
    console.log(`FAIL  ${identity}  (${findings.length})`);
    for (const finding of findings) {
      console.log(`        [${finding.code}] ${finding.path}`);
      console.log(`        ${finding.message}`);
    }
  }
}

console.log(
  `${adapterCount} adapter(s) checked, ${findingCount} finding(s) reported`,
);
process.exit(findingCount === 0 ? 0 : 1);

/** A directory means its index; anything else is taken as written. */
function entryPointFor(target: string): string {
  const path = resolve(process.cwd(), target);
  for (const candidate of [`${path}/index.ts`, `${path}/index.js`]) {
    if (existsSync(candidate)) return candidate;
  }
  return path;
}

function* collectAdapters(
  exported: Record<string, unknown>,
): Generator<ProviderAdapter> {
  for (const value of Object.values(exported)) {
    if (Array.isArray(value)) {
      for (const member of value) {
        if (isAdapter(member)) yield member;
      }
      continue;
    }
    if (isAdapter(value)) yield value;
  }
}

function isAdapter(value: unknown): value is ProviderAdapter {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ProviderAdapter>;
  return (
    typeof candidate.provider === "string" &&
    typeof candidate.capability === "string" &&
    typeof candidate.operationMap === "object"
  );
}
