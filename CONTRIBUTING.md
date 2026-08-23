# Contributing

ADL grows when a real adapter needs a seam it lacks. That is the bar for a
new field: a provider that cannot be described without it, and the failure a
runtime hits when it guesses instead.

## How changes get made

This repository is issues-only. Hyperscale makes the changes to the manifest
format and to the package; the public proposes them in an issue. That is the
whole model, and it is stated up front so nobody spends a weekend on a branch
that was never going to be merged.

A proposal is an issue carrying two things: the provider that cannot be
described without the change, and the conformance case it would add to
`conformance/cases.json`. An issue with both is a design discussion; an issue
with neither is a wish.

Hyperscale accepts a pull request rarely, and only after asking for one. When
that happens the maintainer who asked sends the CLA and the author signs it
before the merge. The AGPL on its own does not let
Hyperscale LLC offer a contribution under the commercial license it sells, so
the CLA is what makes a merge possible at all.

The setup and the loop below are here because reading ADL, running the
suite, and building the case for a proposal all need them.

## Setup

```bash
bun install
bun run check
```

`check` runs three things: `spec:check` (the published JSON Schema still
matches `src/vocabulary.ts`), `bun test`, and `tsc`. Bun 1.4 or later.

## The loop

- **Adding a value to a vocabulary** (a statement format, a lifecycle state, an
  auth envelope): edit `src/vocabulary.ts`, then `bun run spec:emit` and commit
  the regenerated `spec/manifest.schema.json`. The two are checked against each
  other, so a stale schema fails CI.
- **Adding a conformance rule**: add the code to `partnerBankConformanceCodes`,
  write the check, and add a case to `conformance/cases.json`. A code with no
  case fails the suite. Say in the case's `why` what operational failure the
  rule prevents; a rule that cannot name one does not belong.
- **Changing anything an adapter declares**: `examples/meridian-bank` must
  still certify, and its fixtures must still match the declaration.

## Conventions

- No runtime dependencies. This package has zero and keeps zero.
- Comments explain constraints the code cannot show, not what the next line
  does.
- Findings are messages a stranger can act on: name the fact that is missing
  and what breaks without it.
- Conformance codes are append-only. Renaming or removing a released code
  breaks every consumer switching on it.

## Proposals

One change per issue, with the case that proves it. Say what the change enables
and which provider needed it.

## Contributor license agreement

In the rare case Hyperscale accepts a pull request, the author signs a CLA
first, and it only has to happen once. The AGPL alone does not let Hyperscale
LLC offer the contribution under the commercial license it sells alongside it,
and the AGPL says nothing about patents, so the patent terms live in the CLA
too.

## Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
