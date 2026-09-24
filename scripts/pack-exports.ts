/**
 * Pack-time entry-point rewrite (prepack applies, postpack restores). The
 * workspace keeps entry points on src/index.ts so `vp test` never reads a stale
 * dist/; the tarball points at dist/ because Node cannot import .ts from
 * node_modules.
 */
const packageJsonPath = new URL("../package.json", import.meta.url);

const sourceEntries = {
  main: "./src/index.ts",
  module: "./src/index.ts",
  types: "./src/index.ts",
  exports: {
    ".": "./src/index.ts",
    "./boundary-fixture": "./src/boundary-fixture.ts",
    "./package.json": "./package.json",
  },
};

const distEntries = {
  main: "./dist/index.js",
  module: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    "./boundary-fixture": {
      types: "./dist/boundary-fixture.d.ts",
      default: "./dist/boundary-fixture.js",
    },
    "./package.json": "./package.json",
  },
};

const mode = process.argv[2];
if (mode !== "apply" && mode !== "restore") {
  throw new Error("usage: pack-exports.ts <apply|restore>");
}

const manifest = JSON.parse(await Bun.file(packageJsonPath).text()) as Record<
  string,
  unknown
>;
Object.assign(manifest, mode === "apply" ? distEntries : sourceEntries);
await Bun.write(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
