# Writing a provider adapter in ADL

This is the whole job, in the order you do it. Everything here is checkable:
each rule names the symbol that enforces it, and `examples/meridian-bank` is a
complete adapter you can copy.

## What an adapter is

An adapter is a **declaration**, not a client. It is a plain object saying
what the provider does: which commands exist, how their responses classify,
what the bank's status tokens mean, when statements can be fetched, which
reference comes back on a debit. The runtime that executes it is generic and
ships with the platform. Your adapter never opens a socket, never holds a
credential, and never decides what a payment means.

That split is why the checks in ADL are declaration-level. Conformance
does not call your bank. It proves the facts you declared are complete enough
for a generic runtime to poll, classify, reconcile, and dedupe without
guessing. Every guess a runtime makes about money is a provider-boundary
defect.

Two consequences worth internalizing before you write a line:

- **A fact you have not established is declared absent, never borrowed.** The
  fields that may be omitted (`charges`, `statementDebitReference`, `envelope`)
  exist so you can be honest during authoring. Conformance then refuses to
  certify while they are open. Absent is a finding; a wrong value is an
  outage.
- **Poll-first.** A provider callback is a hint that a poll is due, never a
  fact to post from. `validatePartnerBankProfile` refuses a profile whose
  `notificationMechanisms` omits `poll`, whatever else it lists.

### Adapter symmetry

Hyperscale's own bank adapters are written against this package and nothing
more. There is no private adapter API, no internal hook, no second interface
for first-party code. When a first-party adapter needs a seam ADL lacks,
the seam is added here, in public, or it is not added.

Practically: if the example in `examples/meridian-bank` can express your bank,
so can we, and if it cannot, that is a gap in ADL worth an issue.

## The four gates

An adapter passes through four gates. Know which one owns which failure, or
you will fix the wrong thing.

| Gate            | Symbol                                                        | Catches                                                                                                             |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Type check      | `ProviderAdapter<Vocabulary>`                                 | Names outside your closed vocabulary, wrong shapes, missing required fields.                                        |
| Registry load   | `createProviderAdapterRegistry`                               | Cross-field structure at import time: key drift, blank locators, an unreadable clock, a duplicate identity. Throws. |
| Conformance     | `partnerBankConformanceFindings`, `certifyPartnerBankAdapter` | Operational completeness. Returns findings, or throws with all of them listed.                                      |
| Manifest schema | `spec/manifest.schema.json`                                   | The same structure for authors who are not writing TypeScript.                                                      |

`conformance/cases.json` records, for every rule, which gates see it. Read it
when you want the exact division of labor.

## 1. Declare your vocabulary

Start by naming the closed unions your product uses. `ProviderAdapterVocabulary`
is nine string fields, and you narrow every one of them:

```ts
import type { ProviderAdapterVocabulary } from "@hyperscale0/adl";

interface MeridianVocabulary extends ProviderAdapterVocabulary {
  readonly capability: "payout_execution" | "bank_credit";
  readonly domain: "payouts" | "deposits";
  readonly meter: "external_payout";
  readonly obligation: "payout_submission" | "bank_credit";
  readonly operation: "payout.submit" | "deposit.record";
  readonly resource: "payout" | "deposit";
  readonly webhookOperation: "payout.complete";
  readonly webhookResource: "payout";
  readonly webhookResourceId: "payoutId";
}
```

The names come from the published operation catalog for the product you are
integrating with, not from your provider's documentation. Your provider calls
it `POST /v2/payments`; the platform calls it `payout.submit`. Translating
between the two is the adapter's whole reason to exist.

Then bind the vocabulary once and keep the returned function:

```ts
const defineMeridianAdapters =
  createProviderAdapterRegistry<MeridianVocabulary>();
```

`createProviderAdapterRegistry` returns a validator that preserves your exact
literal types (`const Adapters extends readonly ProviderAdapter<Vocabulary>[]`),
so downstream code sees the operations you actually declared, not `string`.

## 2. Declare the operations

`operationMap` is keyed by operation name, and the key must equal the binding's
`operation` field. Drift throws at load:
`operationMap key submit must match operation payout.submit`.

Each `ProviderOperationBinding` carries:

| Field            | Contract                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation`      | The platform operation this binding serves. Equal to its map key.                                                                                                                                                          |
| `direction`      | `tenant_initiated` when the runtime sends the provider a command and reads an answer. `system_settlement` when the operation records something observation already saw. This single field decides which rules apply below. |
| `obligationKind` | Which obligation the operation discharges. Your product's vocabulary.                                                                                                                                                      |
| `resourceKind`   | The platform resource the provider's answer commits onto. Must appear in `bindings`.                                                                                                                                       |
| `resourceIdPath` | Where the resource id is read from. Non-blank, checked at load.                                                                                                                                                            |
| `meter`          | Optional. The usage meter this operation feeds.                                                                                                                                                                            |
| `envelope`       | How this operation's response carries its outcome. Required when the runtime sends a provider command, see below.                                                                                                          |
| `statusEnquiry`  | The authoritative read-after-write. Required on a REST command, see below.                                                                                                                                                 |

### The envelope class, per operation

`ProviderResponseEnvelope` has three inhabitants:

- `http_200_body_status`: every response is HTTP 200 and the outcome is a
  status token in the body. A rejection arrives inside a success.
- `http_status_error_body`: the HTTP status carries the outcome and a failure
  body is prose.
- `unconfirmed_until_live`: the provider publishes no error sample, so the
  class is honestly unknown.

Declare it **per operation**, never per provider. Real providers answer in more
than one shape across their own endpoints, and inheriting a class from a
sibling endpoint is how a rejection gets read as a success.

Conformance requires the class on any binding where the runtime sends a command
and reads an answer, meaning `direction: "tenant_initiated"` on an `egress` of
`rest` or `sync_clearance`. Missing it is `response_envelope_unclassified`; a
declared `unconfirmed_until_live` is `response_envelope_unconfirmed`, because
conformance requires the response class to be established first. Passing that
check does not grant live readiness. A `system_settlement` binding carries no
response of its own, so it owes no envelope, and declaring one there would be a
borrowed fact.

### Status enquiry, the read-after-write

A REST command's response can be lost after the provider has already acted on
it. Without an authoritative way to re-read the outcome, the runtime's only
options are guessing and resubmitting, and resubmitting pays twice.

```ts
statusEnquiry: {
  keys: "provider_reference",
  pathTemplate: "/v2/payments/{providerReference}",
}
```

`keys` says which reference the enquiry is keyed by, and the template must
contain the matching placeholder, checked at load:
`{instructionId}` for `instruction_id`, `{providerReference}` for
`provider_reference`.

Presence is a readiness commitment, not a hint. Runtimes must never infer
enquiry support from a command URL, so:

- a `tenant_initiated` binding on `egress: "rest"` without one is
  `status_enquiry_missing`;
- an enquiry declared on an adapter whose `egress` is not `rest` is
  `status_enquiry_without_rest_egress`, because there is no transport to run it;
- `sync_clearance` is exempt: the answer arrives in the same exchange.

### Egress and direction have to agree

`ProviderEgressMode` is how this adapter reaches the provider at all:

- `none`: the capability is learned entirely by observation;
- `rest`: per-command HTTP;
- `batch_reconcile`: files, reconciled after the fact;
- `sync_clearance`: one synchronous exchange that carries its own truth.

A `tenant_initiated` binding on `none` or `batch_reconcile` promises an
outbound call the egress mode cannot make: `egress_direction_incoherent`.

## 3. Declare the webhook plans

`webhookMap` is keyed by event kind, and the key must equal `eventKind` (load
throws on drift, same as operations). A `ProviderWebhookTransitionPlan` says
what a callback must contain before the runtime will treat it as a reason to
poll: `requiredPayloadFields`, `optionalPayloadFields`,
`requiredFieldGroups` (each inner array is a set where at least one member is
required), `resourceIdField`, `resourceKind`, and `timestampField` from the
`ProviderTimestampField` vocabulary.

An adapter with no callbacks declares `webhookMap: {}`. That is complete, not
missing: polling is the fact.

## 4. Declare the bindings

`bindings` maps each resource kind this adapter settles to a
`ProviderResourceBinding`:

- `strict`: the provider's fact must match the platform's row exactly;
- `claim`: the provider's fact claims an existing row;
- `confirmation_only`: the provider only confirms what the platform already
  decided;
- `evidence_only`: the fact is recorded as evidence, and settles nothing.

Every `resourceKind` named by an operation binding or a webhook plan needs an
entry, or conformance reports `resource_binding_missing`: a provider fact with
no declared match mode has no lawful way to commit.

## 5. Declare the config

```ts
config: {
  baseUrl: "https://api.meridian-bank.example/v2",
  credentialRef: { source: "environment", name: "MERIDIAN_BANK_CREDENTIALS" },
}
```

`ProviderCredentialReference` is a **locator**: an environment variable name,
or a keychain service and account. There is no field a secret can be written
into, and `validateConfig` refuses a blank locator or a relative `baseUrl`.
Never put a token, certificate, or password in an adapter. The declaration is
committed to a repository; the credential is not.

## 6. Declare the partner-bank profile

`PartnerBankAdapterProfile` is the bank as fact. It is the longest part of the
job and the part that repays care, because every field is something a runtime
would otherwise guess.

### Auth and wire

`wireCodec` (`rest_json`, `iso20022_xml`, `swift_mt`) and `auth`
(`ProviderAuthEnvelope` plus a signing scheme). Declaring a grant the bank will
not accept fails on the first provider call. Read the bank's token service and
do not assume client credentials.

### The idempotency spine

```ts
idempotencySpine: {
  dedupeKeys: ["instructionId", "paymentReference"],
  instructionId: { maxLength: 32 },
  endToEndId: { maxLength: 32 },
  paymentReference: { maxLength: 20 },
}
```

`dedupeKeys` names which references the bank grades a duplicate against. It
must be non-empty and free of duplicates (both checked at load). The three
length facts are what stops the runtime minting a reference the bank will
truncate, which is how two payments end up sharing an identity.

### The lifecycle vocabulary

The bank's own status spellings, mapped onto canonical states:

```ts
lifecycleVocabulary: {
  QUEUED: "received",
  AUTHORISED: "accepted",
  SETTLED: "processed",
  DECLINED: "failed",
  RECALLED: "returned",
  REPLAY_SETTLED: "duplicate_original_succeeded",
  REPLAY_DECLINED: "duplicate_original_rejected",
}
```

Runtimes match after trimming and upper-casing, so `ok`, `OK ` and `OK` are one
entry. Four rules apply:

- the vocabulary must spell `processed`, `failed`, and `returned`, or a payment
  ending there is unclassifiable and polls forever
  (`lifecycle_terminals_incomplete`);
- it must spell `received` or `accepted`, because an acknowledgement proves the
  bank took the instruction, never that money moved
  (`lifecycle_intake_missing`);
- a spelling that trims to nothing can never match (`lifecycle_spelling_blank`);
- two spellings that normalize to the same token must agree on the canonical
  state, or classification becomes order-dependent
  (`lifecycle_spelling_conflict`).

And the one authors forget: both duplicate verdicts must be spellable
(`duplicate_verdicts_unmapped`). The dedupe spine means a crash-recovery
resubmission comes back graded against the original's outcome. Unclassified,
your own recovery reads as a fresh failure.

### Statements

`statementFormats` lists what the bank can hand you (`mt940`, `mt942`,
`camt_052`, `camt_053`, `obie_json`), and `windows.statements` gives each one a
fetch window:

- `availability: "T-1"` pages over history, so it needs positive `lookbackDays`
  and `statementDaysPerRequest`;
- `availability: "today_only"` is intraday and owes no paging facts.

A declared format with no window is `statement_window_missing`; a T-1 window
without paging facts is `statement_window_incomplete`. No formats at all is
`statement_formats_empty`: statements are bank truth, and reconciliation has
nothing to prove the ledger against without one.

`statementDebitReference` says which of the two references on a debit line
names the instruction behind it: the bank's own entry reference
(`bank_reference`) or the reference you sent (`customer_reference`). Banks
disagree, and the wrong choice makes every payout you instructed look like an
unexplained debit. Leaving it unestablished is
`statement_debit_reference_unestablished`.

### Charges

```ts
charges: {
  narratives: { charge: ["MERIDIAN FEE"], vat: ["MERIDIAN TAX"] },
  posting: "post_hoc",
  vat: "separate_line",
}
```

`posting` says whether the bank debits its fee separately after the payment or
nets it out of the instructed amount; `vat` says whether tax arrives as its own
line. Post-hoc charges and separate VAT lines are bank-initiated debits
recognizable only by their wording, so each mode in play needs at least one
narrative prefix (`charge_narrative_unestablished`,
`vat_narrative_unestablished`). Omitting `charges` entirely is honest during
authoring and refused at certification (`charges_unestablished`): the bank's own
debits would land as unexplained statement lines.

### Windows

```ts
paymentCutoff: {
  time: "16:30",
  timeZone: "Europe/Dublin",
  beforeCutoffValueDate: "D+0",
  afterCutoffValueDate: "D+1",
}
```

The cutoff is read on the **bank's** clock, so `timeZone` is an IANA name and
both gates resolve it through `Intl.DateTimeFormat`. Absence is not tolerated:
an undefined zone silently means the host's clock
(`cutoff_clock_invalid`).

Value dates are `D+<whole days>`. Missing a cutoff can only push value later,
so an after-cutoff date earlier than the before-cutoff one is a
`cutoff_window_regression`, and so is a `valueDateMaxDaysAhead` that cannot
reach the after-cutoff date. A malformed offset is
`value_date_offset_invalid` rather than a NaN that slides through every
comparison after it.

### The rest

`executedReadBack` (whether the executed read-back may name another rail, and
when an FX rate is final), `limitFacts` (what the bank exposes about limits),
`financialAddressProvisioning` (how virtual addresses are issued, priced, and
quota'd), and `notificationMechanisms` (which must include `poll`).

## 7. Run conformance

```bash
bun run conformance -- ./examples/meridian-bank
```

```
ok    meridian_bank:payout_execution
ok    meridian_bank:bank_credit
2 adapter(s) checked, 0 finding(s) reported
```

The runner exits 1 when anything reports, so it drops straight into CI. It
takes a module path or a directory, and certifies every adapter the module
exports.

In your own repository, call the function directly and skip the runner:

```ts
import { certifyPartnerBankAdapter } from "@hyperscale0/adl";

import { myAdapters } from "./src/index.js";

for (const adapter of myAdapters) certifyPartnerBankAdapter(adapter);
```

`partnerBankConformanceFindings` returns every finding as
`{ code, path, message }`, where `path` is the dotted location inside your
declaration. `certifyPartnerBankAdapter` throws with all of them listed at
once, so you fix a declaration in one pass rather than one throw at a time.
The codes are append-only: a released code is never renamed or removed, so you
can switch on `PartnerBankConformanceCode` without a stale fallback arm.

An empty result is the certification. Nothing else is.

## 8. Write the manifest without TypeScript

`spec/manifest.schema.json` is JSON Schema 2020-12 for one adapter
declaration, generated from `src/vocabulary.ts` by `scripts/emit-spec.ts` and
drift-checked by `bun run spec:check`. Generate types, validate a
hand-written manifest, or feed it to an editor.

The schema is structural. Rules that compare two fields, resolve a time zone,
or match a property key against a value inside it cannot be expressed in JSON
Schema and stay in the validator and the conformance suite.
`conformance/cases.json` says which gate owns each rule, in the `note` field of
every case where they differ.

## 9. Hand it over

An adapter is handed over as source, never as a running service:

1. `bun run conformance` reports zero findings.
2. Your own tests read captured provider bytes and prove the declaration
   matches them. `examples/meridian-bank/example.spec.ts` is the pattern:
   every status token in a fixture is spelled in the lifecycle vocabulary, the
   envelope class is how the fixtures actually read, and the declared charge
   narratives match the statement lines.
3. Open an issue on this repository with the certified declaration and the
   conformance output. Credentials are never part of a submission; the
   declaration names locators, and the operator fills them in.

## Stability

The package is pre-1.0 and the surface can still change on a minor version
until it is `1.0.0`. Two promises hold now:

- conformance codes are append-only;
- a value removed from a vocabulary in `src/vocabulary.ts` is a breaking change
  and appears in `CHANGELOG.md`.

## What is not here

The declaration carries no timeouts, no retry policy, and no rate limits.
Those belong to the runtime that executes adapters, not to the facts about the
provider, and no field in `ProviderAdapter` accepts them. If your provider's
limits are a fact the runtime must know, open an issue: under Adapter Symmetry
the seam gets added here, publicly, or not at all.
