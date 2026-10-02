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

`createProviderAdapterRegistry` validates declarations when they load and throws
on the first error. It checks the provider key, a unique provider and capability
pair, `onboarding` as `person`, `organization` or both, each operation map key
against its binding's `operation`, a nonblank `resourceIdPath`, and subject
requirements against the UDL object field schema. Subject requirements describe
required authored fields or attachments; they never supply an account or choose
a party.

The [boundary adapter](https://github.com/hyperscale0/hyperscale-adl/blob/main/src/boundary-fixture.ts) declares one boundary
observation operation with no subject requirements. The
[subject fixture](../conformance/subject-adapter.ts) shows required subject fields.

`adapterConformanceFindings` checks the declaration without contacting a
provider and returns findings instead of throwing. Only it checks that every
operation's `resourceKind` appears in `bindings`, and that the operation map is
not empty. It reports a registry refusal as `declaration_invalid`.

## Dispatch an instruction

`BoundaryInstruction` binds an immutable ID to the environment, tenant, Product,
retained `productBuildId` and `buildDigest`, target (`kind`, `attachment`,
`instanceId`), `sourceAccountId`, `destinationAccountId`, positive minor-unit
`amount`, `currency` and selected `adapter`. The runtime reserves before dispatch.
An adapter receives the instruction unchanged and cannot choose parties,
accounts or a replacement binding.

`BoundaryAdapter.dispatch` and `BoundaryAdapter.observe` return a
`BoundaryObservation` or `undefined`. The observation names the adapter,
`instructionId`, stable `externalReference`, explicit `outcome` and ISO `observedAt`.
`BoundaryAdapter.id` identifies the adapter. Observation identity is the pair of
adapter and external reference; reuse with different contents refuses.
Its outcome is `acknowledged`, `unknown`, `confirmed` or `rejected`.

An acknowledgement or missing result leaves the reservation held. HTTP status
never supplies a terminal outcome. Only a matching `confirmed` observation can
authorize posting; an explicit `rejected` observation can authorize voiding.
Observations remain immutable. Storage is separate from consumption; the runtime
claims settlement evidence once. There is no distributed provider/ledger transaction.

## Check the declaration

From a clone of [hyperscale-adl](https://github.com/hyperscale0/hyperscale-adl):

```sh
bun run conformance -- ./src/boundary-fixture.ts
```

The conformance command exits 1 when it reports a finding. Add a case in `conformance/cases.json` when a
new declaration rule prevents a concrete failure.
