Requested by a Hyperscale maintainer in issue #___. Unsolicited pull requests
are closed with a pointer to CONTRIBUTING.md.

## What this changes

<!-- One paragraph. What the change enables, not a list of the files you edited. -->

## Why

<!-- Which provider or runtime failure needed it. A new field in the declaration
     should name the provider that cannot be described without it. -->

## Checks

- [ ] `bun run check` passes (spec drift, tests, types)
- [ ] `bun run conformance -- ./examples/meridian-bank` reports 0 findings
- [ ] A vocabulary change was followed by `bun run spec:emit`, and the
      regenerated `spec/manifest.schema.json` is committed
- [ ] A new conformance code has a case in `conformance/cases.json`
- [ ] Breaking changes are in `CHANGELOG.md` under Unreleased

## Anything a reviewer should know

<!-- Deviations, open questions, what you deliberately left out. "None" is a
     fine answer. -->
