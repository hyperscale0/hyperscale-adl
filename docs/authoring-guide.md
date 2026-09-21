# Writing a provider adapter in ADL

`ProviderAdapter` declares an adapter's identity, operation bindings and subject
requirements. `BoundaryAdapter` implements dispatch and observation. The runtime
owns instruction identity and money accounts.

## Declare the binding

Use `createProviderAdapterRegistry` to validate declarations. Each operation map
key must equal its binding's `operation`. Its `resourceKind` must appear in
`bindings`. Subject requirements describe required authored fields or attachments;
they never supply an account or choose a party.

The [generic fixture](../src/boundary-fixture.ts) declares one boundary
observation operation with no subject requirements. The
[subject fixture](../conformance/subject-adapter.ts) shows required subject fields.

`adapterConformanceFindings` checks the declaration. The
[manifest schema](../spec/manifest.schema.json) expresses the same public shape
for non-TypeScript authors. Neither check contacts a provider.

## Dispatch an instruction

`BoundaryInstruction` binds an immutable ID to the environment, tenant, Product,
retained Build, target, source and destination accounts, positive minor-unit
amount, currency and adapter. The runtime reserves the amount before dispatch.
An adapter receives that instruction unchanged.

`BoundaryAdapter.dispatch` and `BoundaryAdapter.observe` return a
`BoundaryObservation` or `undefined`. The observation names the adapter,
instruction ID, stable external reference, explicit outcome and observation time.
Its outcome is `acknowledged`, `unknown`, `confirmed` or `rejected`.

An acknowledgement or missing result leaves the reservation held. HTTP status
never supplies a terminal outcome. Only a matching `confirmed` observation can
authorize posting; an explicit `rejected` observation can authorize voiding.
The runtime records immutable observations and consumes settlement evidence once.
Recovery completes the same ledger intent without resending uncertain work.

## Check the declaration

From this package:

```sh
bun run conformance -- ./src/boundary-fixture.ts
bun run spec:emit
```

The conformance command exits 1 when it reports a finding. The schema emitter
writes the declaration schema and the `BoundaryInstruction` and
`BoundaryObservation` definitions. Add a case in `conformance/cases.json` when a
new declaration rule prevents a concrete failure.
