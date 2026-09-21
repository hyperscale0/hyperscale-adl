/** Synthetic conformance metadata, not a real provider requirement. */
import type { ProviderAdapter } from "../src/index.js";

export const subjectAdapter: ProviderAdapter = {
  provider: "conformance_subject",
  capability: "subject",
  domain: "conformance",
  egress: "sync_clearance",
  bindings: {
    subject: "strict",
  },
  config: {},
  operationMap: {
    "subject.check": {
      operation: "subject.check",
      direction: "tenant_initiated",
      envelope: "http_200_body_status",
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
  webhookMap: {},
};
