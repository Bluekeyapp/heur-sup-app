import test from "node:test";
import assert from "node:assert/strict";

import {
  loadEntries,
  persistEntries,
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
