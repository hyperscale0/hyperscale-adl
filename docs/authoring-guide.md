# Writing a provider adapter in ADL

Read [how Hyperscale fits](https://hyperscale0.ai/docs/runtime.md#how-hyperscale-fits) for provider authority and the shared operation API.

`ProviderAdapter` declares an adapter's identity, operation bindings and subject
requirements. `BoundaryAdapter` implements dispatch and observation. The runtime
owns instruction identity and money accounts.

## Declare the binding

For a domain example, see
[`conformance/insurance-policy-adapter.ts`](../conformance/insurance-policy-adapter.ts).
It uses a custom vocabulary for quote, bind and policy observation. A completed
bind identifies the downstream insurer's issued policy and must correlate with
the bound quote. An accepted request without issuance evidence remains pending.
The fixture does not rate a policy, collect premium or register a live engine
adapter.

Use `createProviderAdapterRegistry` to validate declarations. Each operation map
key must equal its binding's `operation`. Its `resourceKind` must appear in
`bindings`. Subject requirements describe required authored fields or attachments;
they never supply an account or choose a party.

The [boundary adapter](https://github.com/hyperscale0/hyperscale-adl/blob/main/src/boundary-fixture.ts) declares one boundary
observation operation with no subject requirements. The
[subject fixture](../conformance/subject-adapter.ts) shows required subject fields.

`adapterConformanceFindings` checks the declaration without contacting a
provider.

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

From a clone of [hyperscale-adl](https://github.com/hyperscale0/hyperscale-adl):

```sh
bun run conformance -- ./src/boundary-fixture.ts
```

The conformance command exits 1 when it reports a finding. Add a case in `conformance/cases.json` when a
new declaration rule prevents a concrete failure.
