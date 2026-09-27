import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "bun:test";

const root = new URL("../", import.meta.url);
const { files } = JSON.parse(
  readFileSync(new URL("package.json", root), "utf8"),
) as { files: string[] };

// Mutation: link the README or the guide to a file npm does not ship.
test("package docs link only to files the package ships", () => {
  const broken: string[] = [];
  for (const doc of ["README.md", "docs/authoring-guide.md"]) {
    const page = new URL(doc, root);
    for (const [, target] of readFileSync(page, "utf8").matchAll(
      /\]\(([^)#\s]+)/g,
    )) {
      if (/^[a-z]+:/.test(target!)) continue;
      const file = new URL(target!, page);
      const shipped = file.pathname.slice(root.pathname.length);
      const listed = files.some(
        (entry) => shipped === entry || shipped.startsWith(`${entry}/`),
      );
      if (!listed || !existsSync(file)) broken.push(`${doc}: ${target}`);
    }
  }
  expect(broken).toEqual([]);
});
