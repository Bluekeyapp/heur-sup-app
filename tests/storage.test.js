import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBackup,
  mergeEntries,
  parseBackup,
  loadEntries,
  persistEntries,
  readLanguage,
  sanitizeEntry,
  STORAGE_KEYS
} from "../src/storage.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  clear() {
    this.#values.clear();
  }
}

globalThis.localStorage = new MemoryStorage();

test("readLanguage keeps supported languages", () => {
  const translations = { en: {}, fr: {}, pt: {} };

  localStorage.clear();
  localStorage.setItem(STORAGE_KEYS.lang, "fr");
  assert.equal(readLanguage(translations), "fr");

  localStorage.setItem(STORAGE_KEYS.lang, "pt");
  assert.equal(readLanguage(translations), "pt");
});

test("sanitizeEntry keeps valid entries tidy", () => {
  assert.deepEqual(sanitizeEntry({
    id: 42,
    date: "2026-04-26",
    hours: "1.255",
    note: "  Payroll review  "
  }), {
    id: 42,
    date: "2026-04-26",
    hours: 1.25,
    note: "Payroll review"
  });
});

test("sanitizeEntry rejects impossible calendar dates", () => {
  assert.equal(sanitizeEntry({
    id: 1,
    date: "2026-02-31",
    hours: 2,
    note: ""
  }), null);
});

test("sanitizeEntry allows zero-hour entries", () => {
  assert.deepEqual(sanitizeEntry({
    id: 7,
    date: "2026-04-26",
    hours: 0,
    note: ""
  }), {
    id: 7,
    date: "2026-04-26",
    hours: 0,
    note: ""
  });
});

test("loadEntries filters bad stored records", () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify([
    { id: 1, date: "2026-04-26", hours: 1, note: "" },
    { id: 2, date: "2026-04-31", hours: 1, note: "" },
    { id: 3, date: "2026-04-27", hours: 25, note: "" }
  ]));

  assert.deepEqual(loadEntries(), [
    { id: 1, date: "2026-04-26", hours: 1, note: "" }
  ]);
});

test("persistEntries writes the current entry list", () => {
  localStorage.clear();
  const entries = [{ id: 1, date: "2026-04-26", hours: 1.5, note: "Close" }];

  persistEntries(entries);

  assert.equal(localStorage.getItem(STORAGE_KEYS.entries), JSON.stringify(entries));
});

test("buildBackup and parseBackup round-trip entries and name", () => {
  const entries = [{ id: 1, date: "2026-11-02", hours: 2.5, note: "Inventaire" }];
  const backup = buildBackup({ entries, firstName: "Ana", lastName: "Silva" }, new Date("2026-11-24T10:00:00Z"));
  assert.equal(backup.exportedAt, "2026-11-24T10:00:00.000Z");

  const parsed = parseBackup(JSON.stringify(backup));
  assert.deepEqual(parsed, { entries, firstName: "Ana", lastName: "Silva" });
});

test("parseBackup accepts a bare entries array", () => {
  const parsed = parseBackup(JSON.stringify([{ id: 1, date: "2026-11-02", hours: 1, note: "" }]));
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.firstName, "");
});

test("parseBackup drops invalid entries and rejects unusable files", () => {
  const parsed = parseBackup(JSON.stringify([
    { id: 1, date: "2026-11-02", hours: 1 },
    { id: 2, date: "not-a-date", hours: 1 }
  ]));
  assert.deepEqual(parsed.entries.map((entry) => entry.id), [1]);

  assert.throws(() => parseBackup("not json"), /invalid-json/);
  assert.throws(() => parseBackup(JSON.stringify({ hello: "world" })), /invalid-backup/);
  assert.throws(() => parseBackup(JSON.stringify([{ date: "nope", hours: 1 }])), /no-valid-entries/);
});

test("mergeEntries skips entries that already exist", () => {
  const current = [{ id: 1, date: "2026-11-02", hours: 1, note: "" }];
  const imported = [
    { id: 1, date: "2026-11-02", hours: 9, note: "changed" },
    { id: 2, date: "2026-11-03", hours: 2, note: "" }
  ];
  const { entries, addedCount } = mergeEntries(current, imported);
  assert.equal(addedCount, 1);
  assert.deepEqual(entries.map((entry) => entry.hours), [1, 2]);
});
