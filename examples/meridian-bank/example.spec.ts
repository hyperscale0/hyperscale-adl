/**
 * The example's own test, and the shape yours should take: conformance is
 * the gate, and the fixtures keep the declaration honest against the bytes
 * the bank actually sends. A declaration that certifies but cannot read its
 * own sandbox capture is not finished.
 */

import { readFileSync } from "node:fs";

import { partnerBankConformanceFindings } from "@hyperscale0/adl";
import { describe, expect, test } from "bun:test";

import { meridianAdapters, meridianProfile } from "./index.js";

interface ExchangeFixture {
  readonly kind: "command" | "enquiry";
  readonly operation: string;
  readonly response: {
    readonly httpStatus: number;
    readonly body: Record<string, unknown>;
  };
}

interface StatementFixture {
  readonly format: string;
  readonly entries: readonly {
    readonly amount: string;
    readonly customerReference: string | null;
    readonly narrative: string;
  }[];
}

interface NotificationFixture {
  readonly eventKind: string;
  readonly payload: Record<string, unknown>;
}

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
  ) as T;
}

const exchanges = [
  fixture<ExchangeFixture>("payout-submit-accepted"),
  fixture<ExchangeFixture>("payout-submit-declined"),
  fixture<ExchangeFixture>("payout-status-settled"),
  fixture<ExchangeFixture>("payout-status-replay"),
];
const statement = fixture<StatementFixture>("statement-camt053");
const notification = fixture<NotificationFixture>("webhook-payout-settled");

const [payoutAdapter] = meridianAdapters;
if (!payoutAdapter) throw new Error("payout adapter missing");

/** The same normalization a runtime uses to match a status token. */
function normalize(token: string): string {
  return token.trim().toUpperCase();
}

const canonicalStateFor = new Map(
  Object.entries(meridianProfile.lifecycleVocabulary).map(
    ([spelling, state]) => [normalize(spelling), state as string],
  ),
);

describe("meridian bank adapter", () => {
  test("every capability certifies with zero findings", () => {
    for (const adapter of meridianAdapters) {
      expect({
        capability: adapter.capability,
        findings: partnerBankConformanceFindings(adapter),
      }).toEqual({ capability: adapter.capability, findings: [] });
    }
  });

  test("the lifecycle vocabulary spells every token the bank sends", () => {
    for (const exchange of exchanges) {
      const token = exchange.response.body["status"];
      expect(typeof token).toBe("string");
      expect(canonicalStateFor.get(normalize(token as string))).toBeDefined();
    }
  });

  test("the declared envelope class is how the fixtures actually read", () => {
    // http_status_error_body: the HTTP status carries the outcome and a
    // failure body is prose. Reading the body of a 2xx for a rejection, or
    // treating a 4xx as a lost response, would strand the payment.
    expect(payoutAdapter.operationMap["payout.submit"]?.envelope).toBe(
      "http_status_error_body",
    );
    for (const exchange of exchanges) {
      if (exchange.kind !== "command") continue;
      const state = canonicalStateFor.get(
        normalize(exchange.response.body["status"] as string),
      );
      if (state === "failed") {
        expect(exchange.response.httpStatus).toBeGreaterThanOrEqual(400);
        expect(typeof exchange.response.body["message"]).toBe("string");
        continue;
      }
      expect(exchange.response.httpStatus).toBeLessThan(400);
    }
  });

  test("the statement format is declared and has a fetch window", () => {
    const formats: readonly string[] = meridianProfile.statementFormats;
    expect(formats).toContain(statement.format);
    const windows: Record<string, unknown> = meridianProfile.windows.statements;
    expect(windows[statement.format]).toBeDefined();
  });

  test("the charge narratives recognize the bank's own debits", () => {
    const startsWithAny = (narrative: string, prefixes: readonly string[]) =>
      prefixes.some((prefix) => normalize(narrative).startsWith(prefix));

    const { charge, vat } = meridianProfile.charges.narratives;
    const chargeLines = statement.entries.filter((entry) =>
      startsWithAny(entry.narrative, charge),
    );
    const vatLines = statement.entries.filter((entry) =>
      startsWithAny(entry.narrative, vat),
    );
    expect(chargeLines).toHaveLength(1);
    expect(vatLines).toHaveLength(1);
  });

  test("an instructed payout is attributable on the statement", () => {
    // statementDebitReference says which reference comes back. Every debit
    // that is not one of the bank's own charge lines must carry it, or the
    // ledger cannot prove the debit was ours.
    expect(meridianProfile.statementDebitReference).toBe("customer_reference");
    const chargePrefixes = [
      ...meridianProfile.charges.narratives.charge,
      ...meridianProfile.charges.narratives.vat,
    ];
    const instructedDebits = statement.entries.filter(
      (entry) =>
        entry.amount.startsWith("-") &&
        !chargePrefixes.some((prefix) =>
          normalize(entry.narrative).startsWith(prefix),
        ),
    );
    expect(instructedDebits).not.toHaveLength(0);
    for (const debit of instructedDebits) {
      expect(typeof debit.customerReference).toBe("string");
    }
  });

  test("the webhook plan describes the callback the bank sends", () => {
    const plan = Object.entries(payoutAdapter.webhookMap).find(
      ([eventKind]) => eventKind === notification.eventKind,
    )?.[1];
    expect(plan).toBeDefined();
    if (!plan) return;
    for (const field of plan.requiredPayloadFields) {
      expect(notification.payload[field]).toBeDefined();
    }
    expect(notification.payload[plan.resourceIdField]).toBeDefined();
    expect(notification.payload[plan.timestampField]).toBeDefined();
  });
});
