# ADL

ADL, the Adapter Declaration Language: the format for describing a bank or
provider to Hyperscale, the validator that refuses a declaration the runtime
could not operate, and the conformance suite that says when one is ready to
serve live money.

It is the third of three. UDL describes the product, HSX scripts the money
movement, ADL declares the provider the money moves through.

**Status: alpha.** `1.0.0-alpha.1`. The surface can still change on a minor
version until 1.0.0.

## Adapter symmetry

Hyperscale's own bank adapters are written against this package and nothing
more. There is no private adapter API and no second interface for first-party
code. When one of our adapters needs a seam ADL lacks, the seam is added here,
in public, or it is not added.

So the guide below is not a simplified account of how we do it. It is how we
do it.

## What an adapter is

A declaration, not a client. A plain object saying what the provider does:
which commands exist, how each response classifies, what the bank's status
tokens mean, when statements can be fetched, which reference comes back on a
debit. The runtime that executes it is generic and ships with the platform.

Your adapter opens no sockets, holds no credentials, and decides nothing about
what a payment means. It states facts, and the checks in this package prove
those facts are complete enough for a generic runtime to poll, classify,
reconcile, and dedupe without guessing.

## Install

```bash
npm install @hyperscale0/adl
```

Every release before 1.0.0 is an alpha, and `latest` follows the newest one, so
a bare install gets it. `npm install @hyperscale0/adl@alpha` is the explicit
form and resolves to the same version. Pin an exact version if you need one:
until 1.0.0 a change to the surface ships as a minor bump, not a major.

No runtime dependencies, and no proprietary code imported.

## The thirty-second shape

```ts
import {
  certifyPartnerBankAdapter,
  createProviderAdapterRegistry,
  type ProviderAdapterVocabulary,
} from "@hyperscale0/adl";

interface MyVocabulary extends ProviderAdapterVocabulary {
  capability: "payout_execution";
  operation: "payout.submit";
  resource: "payout";
  // ...the rest of your closed unions
}

const defineAdapters = createProviderAdapterRegistry<MyVocabulary>();

export const adapters = defineAdapters([
  {
    provider: "meridian_bank",
    capability: "payout_execution",
    egress: "rest",
    operationMap: {
      "payout.submit": {
        operation: "payout.submit",
        direction: "tenant_initiated",
        envelope: "http_status_error_body",
        statusEnquiry: {
          keys: "provider_reference",
          pathTemplate: "/v2/payments/{providerReference}",
        },
        obligationKind: "payout_submission",
        resourceKind: "payout",
        resourceIdPath: "payoutId",
      },
    },
    webhookMap: {},
    bindings: { payout: "claim" },
    config: {
      credentialRef: { source: "environment", name: "MERIDIAN_CREDENTIALS" },
    },
    profile: myBankProfile,
  },
]);

for (const adapter of adapters) certifyPartnerBankAdapter(adapter);
```

`createProviderAdapterRegistry` validates at import and preserves your literal
types. `certifyPartnerBankAdapter` throws with every gap listed at once; an
empty finding list is the certification.

## Where to go next

- **[docs/authoring-guide.md](docs/authoring-guide.md)** -- the whole job, field
  by field, with the rule that enforces each one.
- **[examples/meridian-bank](examples/meridian-bank)** -- a complete certified
  adapter for a bank that does not exist, with fixtures and its own tests.
  Copy it.
- **[conformance/cases.json](conformance/cases.json)** -- every rule as data:
  one broken fact per case, and what each gate says about it.
- **[spec/manifest.schema.json](spec/manifest.schema.json)** -- JSON Schema
  2020-12 for one declaration, for authors who are not writing TypeScript.

## Running conformance

```bash
bun run conformance -- ./examples/meridian-bank
```

```
ok    meridian_bank:payout_execution
ok    meridian_bank:bank_credit
2 adapter(s) checked, 0 finding(s) reported
```

Exit 1 when anything reports, so it drops straight into CI.

## Development

```bash
bun install
bun run check     # spec drift, tests, types
bun run build
```

## Versioning

Semantic versioning from 1.0.0. Until then, alpha releases may change the
surface on a minor version. Two promises hold now:

- conformance codes are append-only: a released code is never renamed or
  removed, so `switch` statements stay exhaustive;
- removing a value from a vocabulary in `src/vocabulary.ts` is a breaking
  change and appears in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Issues only. Hyperscale makes the changes to the format and the package; you
propose them in an issue carrying the provider that needs the seam and the
conformance case it would add. [CONTRIBUTING.md](CONTRIBUTING.md) has that
model in full, plus the loop: what earns a new field, how to regenerate the
schema, and the CLA behind a rare accepted pull request. Participation is under
the [Code of Conduct](CODE_OF_CONDUCT.md).

Vulnerabilities go through GitHub private reporting, never a public issue. See
[SECURITY.md](SECURITY.md).

## License

AGPL-3.0-only, with a commercial license available from Hyperscale LLC for
organisations that cannot accept the AGPL. See [LICENSE](LICENSE) for the text
and [LICENSING.md](LICENSING.md) for which one you want and how to ask for the
commercial one. Neither covers the Hyperscale marks;
[TRADEMARKS.md](TRADEMARKS.md) says what that means and carries the rule for
claiming conformance.
