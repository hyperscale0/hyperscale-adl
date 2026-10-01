<p align="left">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="docs/assets/brand/adl-stacked-white.svg">
  <source media="(max-width: 600px)" srcset="docs/assets/brand/adl-stacked.svg">
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/adl-horizontal-white.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/brand/adl-horizontal.svg">
  <img src="docs/assets/brand/adl-horizontal.svg" alt="Hyperscale™ ADL" width="335">
</picture>
</p>

# ADL

Read [how Hyperscale fits](https://hyperscale0.ai/docs/runtime.md#how-hyperscale-fits) for provider authority and the shared operation API.

ADL declares provider bindings and the instruction and observation contract for external work. HSX authors money behavior; UDL carries that contract into execution. The runtime owns money accounts, reservations and evidence consumption.

An adapter maps a real provider's lifecycle and schema onto a canonical shape and
returns its evidence. Shapes follow real provider contracts.

## Install

```bash
npm install @hyperscale0/adl
```

ADL depends on `@hyperscale0/udl` for object field schema validation.

## Adapter declaration

Use `createProviderAdapterRegistry` to validate `ProviderAdapter` declarations and `adapterConformanceFindings` to report incomplete bindings. `BoundaryAdapter` dispatches immutable `BoundaryInstruction` values and returns explicit `BoundaryObservation` values. HTTP success never confirms settlement.

The [boundary adapter](https://github.com/hyperscale0/hyperscale-adl/blob/main/src/boundary-fixture.ts) is the sandbox adapter the platform registers. It has no network, clock or account policy. The conformance script ships only in the source repository. Check the adapter from a clone of [hyperscale-adl](https://github.com/hyperscale0/hyperscale-adl):

```sh
bun run conformance -- ./src/boundary-fixture.ts
```

## Documentation

- [Authoring guide](docs/authoring-guide.md)
- [Conformance test cases](conformance/cases.json)
- [Subject adapter fixture](conformance/subject-adapter.ts)
- [Contributing](https://github.com/hyperscale0/hyperscale-adl/blob/main/CONTRIBUTING.md)

## Versioning

Semantic versioning. Removing a value from a vocabulary in `src/vocabulary.ts` is a breaking change documented in [CHANGELOG.md](CHANGELOG.md).

## License and security

ADL is licensed under the Hyperscale Intellectual Property and Copyright License, Tier 2 (Source Available), with a commercial license available from Hyperscale LLC. It is not open source. See [LICENSE.md](LICENSE.md) and [NOTICE.md](NOTICE.md).

Vulnerability reports go through private disclosure as described in [SECURITY.md](SECURITY.md).

---

Hyperscale™ is a trademark of Hyperscale LLC. Code licenses do not grant rights to the name or marks.
