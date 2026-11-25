import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { nextVersion } from "../scripts/bump-version.mjs";
import { VERSIONED_FILES, findVersions } from "../scripts/version-files.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFileSync(`${root}/${file}`, "utf8");

test("every ?v= version in the app is the same", () => {
  const versions = new Set(VERSIONED_FILES.flatMap((file) => findVersions(read(file))));
  assert.equal(versions.size, 1, `Mixed versions: ${[...versions].join(", ")}. Run npm run version:bump.`);
});

test("the service worker precaches every versioned file the page loads", () => {
  const sw = read("sw.js");
  const loaded = [
    ...read("index.html").matchAll(/(?:href|src)="(\.\/[^"]+\?v=\w+)"/g),
    ...read("src/app.js").matchAll(/from "\.\/([^"]+\?v=\w+)"/g)
  ].map((match) => (match[1].startsWith("./") ? match[1] : `./src/${match[1]}`));

  assert.ok(loaded.length >= 6);
  for (const url of loaded) {
    assert.ok(sw.includes(`"${url}"`), `${url} is missing from APP_SHELL in sw.js`);
  }
});

test("nextVersion moves to the next letter on the same day, else restarts at a", () => {
  const day = new Date(2026, 10, 24);
  assert.equal(nextVersion("20261124c", day), "20261124d");
  assert.equal(nextVersion("20261120f", day), "20261124a");
  assert.throws(() => nextVersion("20261124z", day));
});
