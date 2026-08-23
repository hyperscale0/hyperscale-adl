/**
 * A validator for exactly the JSON Schema 2020-12 keywords
 * `spec/manifest.schema.json` uses, and nothing else.
 *
 * ADL ships with no dependencies and the test suite keeps that promise,
 * so proving the published schema agrees with the registry validator means
 * bringing our own validator. It is deliberately small: 2020-12 is a large
 * spec, this reads the subset the emitter can produce, and `unsupported`
 * throws on anything else rather than passing it silently.
 */

export type JsonSchema = Record<string, unknown>;

const supportedKeywords = new Set([
  "$schema",
  "$id",
  "$defs",
  "$ref",
  "title",
  "description",
  "type",
  "const",
  "enum",
  "pattern",
  "minimum",
  "required",
  "properties",
  "additionalProperties",
  "minProperties",
  "items",
  "minItems",
  "uniqueItems",
  "contains",
  "oneOf",
  "allOf",
  "if",
  "then",
]);

/** Every reason `value` fails `schema`, deepest path first written out. */
export function schemaViolations(
  schema: JsonSchema,
  value: unknown,
  root: JsonSchema = schema,
  path = "$",
): string[] {
  for (const keyword of Object.keys(schema)) {
    if (!supportedKeywords.has(keyword)) {
      throw new Error(`unsupported JSON Schema keyword ${keyword} at ${path}`);
    }
  }

  const ref = schema["$ref"];
  if (typeof ref === "string") {
    return schemaViolations(resolveRef(root, ref), value, root, path);
  }

  const violations: string[] = [];
  const fail = (reason: string) => violations.push(`${path}: ${reason}`);

  const type = schema["type"];
  if (typeof type === "string" && !matchesType(type, value)) {
    fail(`expected ${type}`);
    return violations;
  }

  if ("const" in schema && value !== schema["const"]) {
    fail(`expected ${JSON.stringify(schema["const"])}`);
  }
  const allowed = schema["enum"];
  if (Array.isArray(allowed) && !allowed.includes(value)) {
    fail(`${JSON.stringify(value)} is not one of ${allowed.join(", ")}`);
  }
  const pattern = schema["pattern"];
  if (typeof pattern === "string" && typeof value === "string") {
    if (!new RegExp(pattern, "u").test(value)) {
      fail(`${JSON.stringify(value)} does not match ${pattern}`);
    }
  }
  const minimum = schema["minimum"];
  if (typeof minimum === "number" && typeof value === "number") {
    if (value < minimum) fail(`${value} is below the minimum ${minimum}`);
  }

  if (isPlainObject(value)) {
    violations.push(...objectViolations(schema, value, root, path, fail));
  }
  if (Array.isArray(value)) {
    violations.push(...arrayViolations(schema, value, root, path, fail));
  }

  const oneOf = schema["oneOf"];
  if (Array.isArray(oneOf)) {
    const matches = oneOf.filter(
      (branch) =>
        schemaViolations(branch as JsonSchema, value, root, path).length === 0,
    );
    if (matches.length !== 1) {
      fail(`matched ${matches.length} oneOf branches, expected exactly 1`);
    }
  }
  const allOf = schema["allOf"];
  if (Array.isArray(allOf)) {
    for (const branch of allOf) {
      violations.push(
        ...schemaViolations(branch as JsonSchema, value, root, path),
      );
    }
  }
  const condition = schema["if"];
  const consequence = schema["then"];
  if (isPlainObject(condition) && isPlainObject(consequence)) {
    const conditionHolds =
      schemaViolations(condition, value, root, path).length === 0;
    if (conditionHolds) {
      violations.push(...schemaViolations(consequence, value, root, path));
    }
  }

  return violations;
}

function objectViolations(
  schema: JsonSchema,
  value: Record<string, unknown>,
  root: JsonSchema,
  path: string,
  fail: (reason: string) => void,
): string[] {
  const violations: string[] = [];
  const required = schema["required"];
  if (Array.isArray(required)) {
    for (const key of required) {
      if (!(String(key) in value)) fail(`missing required property ${key}`);
    }
  }
  const minProperties = schema["minProperties"];
  if (typeof minProperties === "number") {
    if (Object.keys(value).length < minProperties) {
      fail(`needs at least ${minProperties} propert(y|ies)`);
    }
  }
  const properties = isPlainObject(schema["properties"])
    ? schema["properties"]
    : {};
  const additional = schema["additionalProperties"];
  for (const [key, member] of Object.entries(value)) {
    const memberSchema = properties[key];
    if (isPlainObject(memberSchema)) {
      violations.push(
        ...schemaViolations(memberSchema, member, root, `${path}.${key}`),
      );
      continue;
    }
    if (additional === false) {
      fail(`unexpected property ${key}`);
      continue;
    }
    if (isPlainObject(additional)) {
      violations.push(
        ...schemaViolations(additional, member, root, `${path}.${key}`),
      );
    }
  }
  return violations;
}

function arrayViolations(
  schema: JsonSchema,
  value: unknown[],
  root: JsonSchema,
  path: string,
  fail: (reason: string) => void,
): string[] {
  const violations: string[] = [];
  const items = schema["items"];
  if (isPlainObject(items)) {
    value.forEach((member, index) => {
      violations.push(
        ...schemaViolations(items, member, root, `${path}[${index}]`),
      );
    });
  }
  const minItems = schema["minItems"];
  if (typeof minItems === "number" && value.length < minItems) {
    fail(`needs at least ${minItems} item(s)`);
  }
  if (schema["uniqueItems"] === true) {
    const seen = new Set(value.map((member) => JSON.stringify(member)));
    if (seen.size !== value.length) fail("contains duplicate items");
  }
  const contains = schema["contains"];
  if (isPlainObject(contains)) {
    const found = value.some(
      (member) => schemaViolations(contains, member, root, path).length === 0,
    );
    if (!found) fail("contains no item matching the required shape");
  }
  return violations;
}

function resolveRef(root: JsonSchema, ref: string): JsonSchema {
  const segments = ref.replace(/^#\//, "").split("/");
  let current: unknown = root;
  for (const segment of segments) {
    if (!isPlainObject(current)) throw new Error(`unresolvable $ref ${ref}`);
    current = current[segment];
  }
  if (!isPlainObject(current)) throw new Error(`unresolvable $ref ${ref}`);
  return current;
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    default:
      throw new Error(`unsupported JSON Schema type ${type}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
