import { createProviderAdapterRegistry } from "./index.js";

/**
 * The fixture KYB provider. A deployment names it as its organization
 * verification provider until it contracts a real one; it answers in sandbox
 * and in fake-money live alike, and moves no money.
 */
export const organizationVerificationFixture = createProviderAdapterRegistry()([
  {
    provider: "kyb_fixture",
    onboarding: ["organization"],
    capability: "identity",
    bindings: {},
    operationMap: {
      "organization.verify": {
        operation: "organization.verify",
        direction: "system_settlement",
        obligationKind: "identity",
        resourceKind: "external_confirmation",
        resourceIdPath: "reference",
        subjectRequirements: [],
      },
    },
  },
] as const)[0];

/**
 * The registration number the fixture refuses, the way a real provider's test
 * mode keeps a documented value that always fails review.
 */
export const fixtureRefusedRegistrationNumber = "0000000000";

export type OrganizationVerificationDecision = {
  readonly status: "approved" | "rejected";
  readonly reference: string;
  readonly reasons: readonly string[];
};

/**
 * The fixture's review of a complete organization profile: it refuses the
 * documented registration number and approves everything else.
 */
export function reviewOrganization(request: {
  readonly id: string;
  readonly registrationNumber: string;
}): OrganizationVerificationDecision {
  const refused =
    request.registrationNumber === fixtureRefusedRegistrationNumber;
  return {
    status: refused ? "rejected" : "approved",
    reference: `${organizationVerificationFixture.provider}:${request.id}`,
    reasons: refused ? ["registration_not_found"] : [],
  };
}
