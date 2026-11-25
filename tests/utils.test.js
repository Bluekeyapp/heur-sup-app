import test from "node:test";
import assert from "node:assert/strict";

import {
  clampPickerTime,
  formatHours,
  formatFrenchReport,
  getLocalDateInputValue,
  isValidDateValue,
  sortEntriesAsc,
  sortEntriesDesc
} from "../src/utils.js";
import { sanitizeEntry } from "../src/storage.js";

test("formatHours formats whole and partial hours", () => {
  assert.equal(formatHours(0), "0h");
  assert.equal(formatHours(0.25), "15m");
  assert.equal(formatHours(1), "1h");
  assert.equal(formatHours(1.5), "1h 30m");
});

test("isValidDateValue rejects malformed and impossible dates", () => {
  assert.equal(isValidDateValue("2026-04-26"), true);
  assert.equal(isValidDateValue("2026-2-3"), false);
  assert.equal(isValidDateValue("2026-02-31"), false);
  assert.equal(isValidDateValue("not-a-date"), false);
});

test("getLocalDateInputValue formats dates for date inputs", () => {
  assert.equal(getLocalDateInputValue(new Date(2026, 3, 6)), "2026-04-06");
});

test("entry sorting is stable by date and id direction", () => {
  const entries = [
    { id: 1, date: "2026-04-26" },
    { id: 3, date: "2026-04-27" },
    { id: 2, date: "2026-04-26" }
  ];

  assert.deepEqual(sortEntriesDesc(entries).map((entry) => entry.id), [3, 2, 1]);
  assert.deepEqual(sortEntriesAsc(entries).map((entry) => entry.id), [1, 2, 3]);
});

test("formatFrenchReport produces a simple WhatsApp-readable French report", () => {
  const report = formatFrenchReport({
    fullName: "Jeovany Duzant",
    monthKey: "2026-04",
    entries: [
      { id: 3, date: "2026-04-25", hours: 5, note: "Moving the dirt from one location to and other" },
      { id: 1, date: "2026-04-15", hours: 4, note: "Cleaning up the ground" },
      { id: 2, date: "2026-04-20", hours: 1.5, note: "Moving the truck from one location to and other location" }
    ]
  });

  assert.equal(report, [
    "RAPPORT D’HEURES SUPPLÉMENTAIRES",
    "",
    "Salarié: Jeovany Duzant",
    "Période: Avril 2026",
    "",
    "Total: 10H30",
    "",
    "Détails:",
    "• Mercredi 15: 4H",
    "Note - Cleaning up the ground",
    "",
    "• Lundi 20: 1H30",
    "Note - Moving the truck from one location to and other location",
    "",
    "• Samedi 25: 5H",
    "Note - Moving the dirt from one location to and other"
  ].join("\n"));
});

test("clampPickerTime keeps values within 24 hours", () => {
  assert.deepEqual(clampPickerTime(3, 30), { hours: 3, minutes: 30 });
  assert.deepEqual(clampPickerTime(24, 0), { hours: 24, minutes: 0 });
  assert.deepEqual(clampPickerTime(-1, 0), { hours: 0, minutes: 0 });
  assert.deepEqual(clampPickerTime(25, 0), { hours: 24, minutes: 0 });
});

test("clampPickerTime gives way on the field the user did not change", () => {
  // Raising hours to 24 while 45 minutes are selected clears the minutes.
  assert.deepEqual(clampPickerTime(24, 45, "hours"), { hours: 24, minutes: 0 });
  // Picking 45 minutes while at 24h drops the hours to 23.
  assert.deepEqual(clampPickerTime(24, 45, "minutes"), { hours: 23, minutes: 45 });
});

test("clamped picker values are always accepted by sanitizeEntry", () => {
  for (const changed of ["hours", "minutes"]) {
    for (const minutes of [0, 15, 30, 45]) {
      const { hours, minutes: mins } = clampPickerTime(24, minutes, changed);
      const entry = sanitizeEntry({ id: 1, date: "2026-11-24", hours: hours + mins / 60, note: "x" });
      assert.ok(entry, `rejected ${hours}h${mins}`);
    }
  }
});
