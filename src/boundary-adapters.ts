import {
  createProviderAdapterRegistry,
  type ProviderAdapter,
} from "./index.js";
import { genericAdapter } from "./boundary-fixture.js";

/** The sandbox identity adapter: it observes a national id and moves no money. */
export const customerIdentityAdapter = createProviderAdapterRegistry()([
  {
    provider: "customer_identity_simulator",
    onboarding: ["person", "organization"],
    capability: "identity",
    bindings: {},
    operationMap: {
      "identity.observe": {
        operation: "identity.observe",
        direction: "system_settlement",
        obligationKind: "identity",
        resourceKind: "external_confirmation",
        resourceIdPath: "externalConfirmationId",
        subjectRequirements: [
          { name: "nationalId", type: "text", sensitive: true },
        ],
      },
    },
  },
] as const)[0];

/**
 * The boundary bindings an HSX program may name, keyed by provider. The
 * compiler copies the named operation's declaration into the action it guards.
 */
export const boundaryAdapters = {
  [genericAdapter.provider]: {
    adapter: genericAdapter,
    operation: "boundary.observe",
  },
  [customerIdentityAdapter.provider]: {
    adapter: customerIdentityAdapter,
    operation: "identity.observe",
  },
} as const satisfies Record<
  string,
  { readonly adapter: ProviderAdapter; readonly operation: string }
>;
