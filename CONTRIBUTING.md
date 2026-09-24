# Contributing

ADL grows when a real adapter needs a seam it lacks. That is the bar for a
new field: a provider that cannot be described without it, and the failure a
runtime hits when it guesses instead.

## How changes get made

This repository is issues-only, so nobody spends a weekend on a branch that
was never going to be merged. Hyperscale makes the changes to the manifest
format and the package; the public proposes them in an issue.

A proposal is one change per issue, carrying two things: the provider that
cannot be described without the change, and the conformance case it would add
to `conformance/cases.json`. An issue with both is a design discussion; an
issue with neither is a wish.

## Setup

```bash
bun install
bun run check
```

`check` runs `bun test` and `tsc`. Bun 1.4 or later.

## The loop

- **Adding a value to a vocabulary** (an operation direction or a binding
  mode): edit `src/vocabulary.ts`.
- **Adding a conformance rule**: add the code to `AdapterConformanceCode`,
  write the check, and add a case to `conformance/cases.json`. A code with no
  case fails the suite. Say in the case's `why` what operational failure the
  rule prevents; a rule that cannot name one does not belong.
- **Changing anything an adapter declares**: the boundary adapter and the subject fixture must
  still pass registry validation and conformance.

## Conventions

- Use the existing UDL field schemas and Zod validators.
- Comments explain constraints the code cannot show, not what the next line
  does.
- Findings are messages a stranger can act on: name the fact that is missing
  and what breaks without it.

## Contributor license agreement

Hyperscale accepts a pull request rarely, and only after asking for one. The
author then signs [the CLA](CLA.md) before the merge; it only has to happen
once. It lets Hyperscale LLC carry the contribution under the Hyperscale
license and the commercial license it sells alongside it, and it carries the
patent terms.

## Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
