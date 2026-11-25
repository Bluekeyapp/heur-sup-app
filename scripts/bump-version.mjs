// Bumps the cache-busting version used across the app in one go:
// the ?v= query on every app file and the service worker cache name.
//
//   npm run version:bump
//
// The version is YYYYMMDD plus a letter (20261124a, 20261124b, ...).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { VERSIONED_FILES, readCurrentVersion } from "./version-files.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

export function nextVersion(current, today = new Date()) {
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("");

  if (current?.startsWith(date)) {
    const letter = current.slice(date.length) || "a";
    if (letter === "z") {
      throw new Error(`Already at ${current}; no letters left for today.`);
    }
    return date + String.fromCharCode(letter.charCodeAt(0) + 1);
  }
  return `${date}a`;
}

function main() {
  const current = readCurrentVersion(root);
  const next = nextVersion(current);

  for (const file of VERSIONED_FILES) {
    const path = `${root}/${file}`;
    let text = readFileSync(path, "utf8");
    text = text.replaceAll(`?v=${current}`, `?v=${next}`);
    if (file === "sw.js") {
      text = text.replace(
        /const CACHE_NAME = "heures-supplementaires-v(\d+)";/,
        (_, n) => `const CACHE_NAME = "heures-supplementaires-v${Number(n) + 1}";`
      );
    }
    writeFileSync(path, text);
  }

  console.log(`Version ${current} -> ${next}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
