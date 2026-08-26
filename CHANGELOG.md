# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from 1.0.0.

## [Unreleased]

## [1.0.0-alpha.2] - 2026-08-26

### Removed

- `providerCredentialSources` and `ProviderCredentialSource` from
  `src/vocabulary.ts`. Nothing read either one. A credential source is spelled
  as a literal union on `ProviderCredentialReference` and as a `const` in
  `spec/manifest.schema.json`, so the vocabulary entry was a third copy that no
  type checker and no schema consulted. Neither name was reachable through the
  package entry point, so no installed consumer can be affected.

## [1.0.0-alpha.1] - 2026-08-23

First retained release, as `@hyperscale0/adl`, from the repository
`hyperscale0/hyperscale-adl`. Licensed AGPL-3.0-only with a commercial license
from Hyperscale LLC, which holds the copyright.

The package was named `@hyperscale0/provider-adapter` while this format was
still called the provider adapter kit. That name was unpublished from npm
before anyone depended on it, so nothing installs from it and there is no
migration to make: `1.0.0-alpha.1` of `@hyperscale0/adl` is the first version
that stays. The exported API is unchanged. `ProviderAdapter`,
`createProviderAdapterRegistry`, `certifyPartnerBankAdapter`, the vocabulary,
and the conformance codes all keep their names. ADL names the language you
write an adapter in; an adapter is still what you write.

### Added

- `docs/authoring-guide.md`: how to write an adapter, field by field, with the
  rule that enforces each one.
- `examples/meridian-bank`: a complete certified adapter for a fictional bank,
  with provider fixtures and its own tests.
- `conformance/cases.json`: every conformance and registry-load rule as data,
  one broken fact per case, recording what each gate says about it.
- `spec/manifest.schema.json`: JSON Schema 2020-12 for one adapter
  declaration, generated from `src/vocabulary.ts` by `scripts/emit-spec.ts`
  and drift-checked by `bun run spec:check`.
- `bun run conformance -- <module>`: certify every adapter a module exports,
  exit 1 on any finding.
- `partnerBankConformanceCodes`, the runtime list behind
  `PartnerBankConformanceCode`.

### Changed

- The closed value sets moved to `src/vocabulary.ts` as runtime arrays with
  the exported types derived from them, so the published schema cannot drift
  from the type checker. No exported type changed shape.

[Unreleased]: https://github.com/hyperscale0/hyperscale-adl/compare/v1.0.0-alpha.2...HEAD
[1.0.0-alpha.2]: https://github.com/hyperscale0/hyperscale-adl/compare/v1.0.0-alpha.1...v1.0.0-alpha.2
[1.0.0-alpha.1]: https://github.com/hyperscale0/hyperscale-adl/releases/tag/v1.0.0-alpha.1
