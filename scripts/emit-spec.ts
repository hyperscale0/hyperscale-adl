import {
  boundaryInstructionSchema,
  boundaryObservationSchema,
} from "../src/index.js";
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

import { udlObjectFieldSchema } from "@hyperscale0/udl";
import * as z from "zod";

import {
  providerEgressModes,
  providerKeyPattern,
  providerOperationDirections,
  providerResourceBindings,
  providerResponseEnvelopes,
  providerTimestampFields,
} from "../src/vocabulary.js";

const objectFieldSchema = z.toJSONSchema(udlObjectFieldSchema, {
  target: "draft-2020-12",
  io: "input",
  cycles: "ref",
  reused: "inline",
  unrepresentable: "throw",
}) as Record<string, unknown>;

const { $schema: _discarded, ...objectFieldDef } = objectFieldSchema;

const specPath = new URL("../spec/manifest.schema.json", import.meta.url);

/** A string with at least one non-whitespace character. */
const nonBlankString = { type: "string", pattern: "\\S" } as const;

function enumOf(values: readonly string[]) {
  return { type: "string", enum: [...values] } as const;
}

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
  },
  $defs: {
    objectField: objectFieldDef,
    BoundaryInstruction: z.toJSONSchema(boundaryInstructionSchema, {
      io: "input",
    }),
    BoundaryObservation: z.toJSONSchema(boundaryObservationSchema, {
      io: "input",
    }),
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
        subjectRequirements: {
          type: "array",
          maxItems: 128,
          items: {
            allOf: [
              { $ref: "#/$defs/objectField" },
              { not: { required: ["optional"] } },
            ],
          },
        },
      },
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
