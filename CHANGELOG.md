# Changelog

## Since 1.0.123

Releases after 1.0.123 shipped without per-release entries. This entry
summarises what changed in the package surface since then.

Added:

- `ProviderAdapter.onboarding` declares whether a provider onboards a `person`,
  an `organization` or both. The registry refuses an empty, unknown or repeated
  kind.
- `conformance/insurance-policy-adapter.ts`, a quote and issuance example with a
  custom vocabulary.

Changed:

- `BoundaryInstruction.currency` accepts SAR only.

## 1.0.123

First unified release. Every public Hyperscale package now ships under one
version that follows the platform release number, so release 123 is 1.0.123.
The compiled contract format is UDL 1 and the HSX header-manifest edition is
HSX 1.
