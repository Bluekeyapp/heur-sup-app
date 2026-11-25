import { readFileSync } from "node:fs";

// Every file that contains a ?v= cache-busting version.
export const VERSIONED_FILES = [
  "index.html",
  "sw.js",
  "src/app.js",
  "src/storage.js"
];

export function findVersions(text) {
  return [...text.matchAll(/\?v=(\w+)/g)].map((match) => match[1]);
}

export function readCurrentVersion(root) {
  const versions = findVersions(readFileSync(`${root}/index.html`, "utf8"));
  if (!versions.length) {
    throw new Error("No ?v= version found in index.html");
  }
  return versions[0];
}
