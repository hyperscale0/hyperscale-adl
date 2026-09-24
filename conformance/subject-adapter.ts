/** Synthetic conformance metadata, not a real provider requirement. */
import type { ProviderAdapter } from "../src/index.js";

export const subjectAdapter: ProviderAdapter = {
  provider: "conformance_subject",
  capability: "subject",
  bindings: {
    subject: "strict",
  },
  operationMap: {
    "subject.check": {
      operation: "subject.check",
      direction: "tenant_initiated",
      obligationKind: "subject_check",
      resourceKind: "subject",
      resourceIdPath: "subjectId",
      subjectRequirements: [
        {
          name: "referenceCode",
          type: "text",
          minLength: 1,
        },
      ],
    },
  },
};
