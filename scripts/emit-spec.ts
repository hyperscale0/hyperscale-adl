/**
 * Emit `spec/manifest.schema.json` from the vocabulary the type checker uses.
 *
 * The published schema is how a non-TypeScript author writes a manifest, so
 * it must never fall behind the enums in `src/vocabulary.ts`. Building it
 * from those arrays makes that impossible: add a statement format and the
 * schema changes in the same commit, or `spec:check` fails.
 *
 * The schema is structural. Rules that need two fields compared, a live
 * `Intl` lookup, or a property key matched against its own value stay in the
 * registry validator and the conformance suite, and `conformance/cases.json`
 * records which gate owns each one.
 *
 *   bun scripts/emit-spec.ts          write the file
 *   bun scripts/emit-spec.ts --check  fail if the committed file is stale
 */

import {
  chargePostings,
  chargeVatModes,
  financialAddressMechanisms,
  financialAddressPricing,
  financialAddressQuotas,
  fxRateReadBacks,
  limitAccessModes,
  limitDimensions,
  partnerBankDedupeKeys,
  partnerBankLifecycleStates,
  partnerBankSignings,
  partnerBankStatementFormats,
  partnerBankWireCodecs,
  providerAuthEnvelopes,
  providerEgressModes,
  providerKeyPattern,
  providerNotificationMechanisms,
  providerOperationDirections,
  providerResourceBindings,
  providerResponseEnvelopes,
  providerTimestampFields,
  railSubstitutions,
  statementAvailabilities,
  statementDebitReferences,
  statusEnquiryKeys,
} from "../src/vocabulary.js";

const specPath = new URL("../spec/manifest.schema.json", import.meta.url);

/** A string with at least one non-whitespace character. */
const nonBlankString = { type: "string", pattern: "\\S" } as const;

const positiveInteger = { type: "integer", minimum: 1 } as const;

function enumOf(values: readonly string[]) {
  return { type: "string", enum: [...values] } as const;
}

function uniqueArrayOf(values: readonly string[]) {
  return { type: "array", items: enumOf(values), uniqueItems: true } as const;
}

const statementWindow = {
  type: "object",
  additionalProperties: false,
  required: ["availability"],
  properties: {
    availability: enumOf(statementAvailabilities),
    lookbackDays: positiveInteger,
    statementDaysPerRequest: positiveInteger,
  },
};

const partnerBankProfile = {
  type: "object",
  additionalProperties: false,
  required: [
    "auth",
    "executedReadBack",
    "financialAddressProvisioning",
    "idempotencySpine",
    "kind",
    "lifecycleVocabulary",
    "limitFacts",
    "notificationMechanisms",
    "statementFormats",
    "windows",
    "wireCodec",
  ],
  properties: {
    kind: { const: "partner_bank" },
    wireCodec: enumOf(partnerBankWireCodecs),
    auth: {
      type: "object",
      additionalProperties: false,
      required: ["envelope", "signing"],
      properties: {
        envelope: enumOf(providerAuthEnvelopes),
        signing: enumOf(partnerBankSignings),
      },
    },
    charges: {
      type: "object",
      additionalProperties: false,
      required: ["posting", "vat"],
      properties: {
        narratives: {
          type: "object",
          additionalProperties: false,
          required: ["charge", "vat"],
          properties: {
            charge: { type: "array", items: nonBlankString },
            vat: { type: "array", items: nonBlankString },
          },
        },
        posting: enumOf(chargePostings),
        vat: enumOf(chargeVatModes),
      },
    },
    executedReadBack: {
      type: "object",
      additionalProperties: false,
      required: ["fxRate", "railSubstitution"],
      properties: {
        fxRate: enumOf(fxRateReadBacks),
        railSubstitution: enumOf(railSubstitutions),
      },
    },
    idempotencySpine: {
      type: "object",
      additionalProperties: false,
      required: [
        "dedupeKeys",
        "endToEndId",
        "instructionId",
        "paymentReference",
      ],
      properties: {
        dedupeKeys: {
          type: "array",
          items: enumOf(partnerBankDedupeKeys),
          minItems: 1,
          uniqueItems: true,
        },
        endToEndId: { $ref: "#/$defs/referenceLimit" },
        instructionId: { $ref: "#/$defs/referenceLimit" },
        paymentReference: { $ref: "#/$defs/referenceLimit" },
      },
    },
    lifecycleVocabulary: {
      type: "object",
      minProperties: 1,
      additionalProperties: enumOf(partnerBankLifecycleStates),
    },
    limitFacts: {
      type: "object",
      additionalProperties: false,
      required: ["access", "dimensions"],
      properties: {
        access: enumOf(limitAccessModes),
        dimensions: uniqueArrayOf(limitDimensions),
      },
    },
    notificationMechanisms: {
      type: "array",
      items: enumOf(providerNotificationMechanisms),
      uniqueItems: true,
      contains: { const: "poll" },
    },
    statementDebitReference: enumOf(statementDebitReferences),
    statementFormats: uniqueArrayOf(partnerBankStatementFormats),
    financialAddressProvisioning: {
      type: "object",
      additionalProperties: false,
      required: ["mechanism", "pricing", "quota"],
      properties: {
        mechanism: enumOf(financialAddressMechanisms),
        pricing: enumOf(financialAddressPricing),
        quota: enumOf(financialAddressQuotas),
      },
    },
    windows: {
      type: "object",
      additionalProperties: false,
      required: ["paymentCutoff", "statements", "valueDateMaxDaysAhead"],
      properties: {
        paymentCutoff: {
          type: "object",
          additionalProperties: false,
          required: [
            "afterCutoffValueDate",
            "beforeCutoffValueDate",
            "time",
            "timeZone",
          ],
          properties: {
            afterCutoffValueDate: { $ref: "#/$defs/valueDateOffset" },
            beforeCutoffValueDate: { $ref: "#/$defs/valueDateOffset" },
            time: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            timeZone: nonBlankString,
          },
        },
        statements: {
          type: "object",
          additionalProperties: false,
          properties: Object.fromEntries(
            partnerBankStatementFormats.map((format) => [
              format,
              statementWindow,
            ]),
          ),
        },
        valueDateMaxDaysAhead: positiveInteger,
      },
    },
  },
};

const manifestSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://raw.githubusercontent.com/hyperscale0/hyperscale-adl/main/spec/manifest.schema.json",
  title: "Hyperscale provider adapter manifest",
  description:
    "One provider adapter declaration. Generated from src/vocabulary.ts by scripts/emit-spec.ts; edit that, never this file.",
  type: "object",
  additionalProperties: false,
  required: [
    "bindings",
    "capability",
    "config",
    "egress",
    "operationMap",
    "provider",
    "webhookMap",
  ],
  properties: {
    provider: { type: "string", pattern: providerKeyPattern.source },
    capability: nonBlankString,
    domain: nonBlankString,
    egress: enumOf(providerEgressModes),
    bindings: {
      type: "object",
      additionalProperties: enumOf(providerResourceBindings),
    },
    config: {
      type: "object",
      additionalProperties: false,
      properties: {
        baseUrl: { type: "string", pattern: "^https?://" },
        credentialRef: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["name", "source"],
              properties: {
                name: nonBlankString,
                source: { const: "environment" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["account", "service", "source"],
              properties: {
                account: nonBlankString,
                service: nonBlankString,
                source: { const: "keychain" },
              },
            },
          ],
        },
      },
    },
    operationMap: {
      type: "object",
      additionalProperties: { $ref: "#/$defs/operationBinding" },
    },
    webhookMap: {
      type: "object",
      additionalProperties: { $ref: "#/$defs/webhookTransitionPlan" },
    },
    profile: partnerBankProfile,
  },
  $defs: {
    referenceLimit: {
      type: "object",
      additionalProperties: false,
      required: ["maxLength"],
      properties: { maxLength: positiveInteger },
    },
    valueDateOffset: {
      type: "string",
      description: "Banking days after the instruction date.",
      pattern: "^D\\+(0|[1-9]\\d*)$",
    },
    operationBinding: {
      type: "object",
      additionalProperties: false,
      required: [
        "direction",
        "obligationKind",
        "operation",
        "resourceIdPath",
        "resourceKind",
      ],
      properties: {
        operation: nonBlankString,
        direction: enumOf(providerOperationDirections),
        envelope: enumOf(providerResponseEnvelopes),
        meter: nonBlankString,
        obligationKind: nonBlankString,
        resourceIdPath: nonBlankString,
        resourceKind: nonBlankString,
        statusEnquiry: { $ref: "#/$defs/statusEnquiry" },
      },
    },
    statusEnquiry: {
      type: "object",
      additionalProperties: false,
      required: ["keys", "pathTemplate"],
      properties: {
        keys: enumOf(statusEnquiryKeys),
        pathTemplate: nonBlankString,
      },
      allOf: [
        {
          if: { properties: { keys: { const: "instruction_id" } } },
          then: {
            properties: { pathTemplate: { pattern: "\\{instructionId\\}" } },
          },
        },
        {
          if: { properties: { keys: { const: "provider_reference" } } },
          then: {
            properties: {
              pathTemplate: { pattern: "\\{providerReference\\}" },
            },
          },
        },
      ],
    },
    webhookTransitionPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "eventKind",
        "operationName",
        "optionalPayloadFields",
        "requiredFieldGroups",
        "requiredPayloadFields",
        "resourceIdField",
        "resourceKind",
        "timestampField",
      ],
      properties: {
        eventKind: nonBlankString,
        operationName: nonBlankString,
        optionalPayloadFields: { type: "array", items: nonBlankString },
        requiredFieldGroups: {
          type: "array",
          items: { type: "array", items: nonBlankString },
        },
        requiredPayloadFields: { type: "array", items: nonBlankString },
        resourceIdField: nonBlankString,
        resourceKind: nonBlankString,
        timestampField: enumOf(providerTimestampFields),
      },
    },
  },
};

const emitted = `${JSON.stringify(manifestSchema, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const committed = await Bun.file(specPath)
    .text()
    .catch(() => "");
  if (committed !== emitted) {
    console.error(
      "spec/manifest.schema.json is stale. Run `bun run spec:emit` and commit the result.",
    );
    process.exit(1);
  }
  console.log("spec/manifest.schema.json matches src/vocabulary.ts");
} else {
  await Bun.write(specPath, emitted);
  console.log(`wrote ${specPath.pathname}`);
}
