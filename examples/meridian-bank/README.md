# Meridian Bank

A complete, certified ADL adapter for a bank that does not exist. Every endpoint,
status token, charge narrative, and account number here is invented, and the
domain `meridian-bank.example` is reserved by RFC 2606 so nothing in this
directory can point at a real institution.

It exists for two reasons: it is the thing to copy when you write your own,
and it is the proof that a third party can pass conformance with nothing but
the published package.

## What is here

| File              | What it is                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `index.ts`        | The adapter: vocabulary, profile, config, two capabilities. Read it top to bottom.          |
| `fixtures/*.json` | Meridian's own bytes: two command responses, two status enquiries, a statement, a callback. |
| `example.spec.ts` | Conformance, plus the checks that keep the declaration honest against the fixtures.         |

## Meridian, briefly

An imaginary European bank with a REST API:

- **Errors ride the HTTP status.** A rejected payment is a 4xx with prose in
  the body, which is `envelope: "http_status_error_body"`. A bank that answered
  200 with a rejection token in the body would be `http_200_body_status`
  instead, and the class is declared per operation because real providers are
  inconsistent across their own endpoints.
- **A payment is re-read by the reference Meridian minted**, so
  `statusEnquiry.keys` is `provider_reference` and the path template carries
  `{providerReference}`. That is the read-after-write: a submit whose response
  we never saw is re-read, never resubmitted.
- **Incoming credits are learned from statements**, so the `bank_credit`
  capability declares `egress: "none"` and records what observation saw.
- **Fees and tax post separately** as `MERIDIAN FEE ...` and `MERIDIAN TAX ...`
  debits, which is why both narrative prefixes are declared: unrecognized, they
  would land as unexplained statement lines.
- **The statement echoes our reference**, so `statementDebitReference` is
  `customer_reference`. Reading Meridian's own entry id instead would make
  every payout we instructed look like an unexplained debit.

## Run it

From the package root:

```bash
bun run conformance -- ./examples/meridian-bank
bun test examples/meridian-bank
```

## Copying it

1. Copy the directory and rename `meridian` throughout. The provider key is
   lowercase and machine-shaped (`^[a-z][a-z0-9_.-]{0,79}$`).
2. Replace the vocabulary with the operations and resources your product
   actually uses.
3. Replace every profile fact with what your bank does. Do not carry a
   Meridian value across because it looked plausible: a fact you have not
   established is declared absent, and conformance will tell you which ones
   are still open.
4. Replace the fixtures with real captures from your provider's sandbox, and
   keep `example.spec.ts` pointed at them. A declaration that certifies but
   cannot read its own sandbox capture is not finished.

`../../docs/authoring-guide.md` explains every field.
