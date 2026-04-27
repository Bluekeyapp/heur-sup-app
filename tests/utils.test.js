import test from "node:test";
import assert from "node:assert/strict";

import {
  formatHours,
  formatFrenchReport,
  formatFrenchReportSubject,
  getLocalDateInputValue,
  isValidDateValue,
  sortEntriesAsc,
  sortEntriesDesc
} from "../src/utils.js";

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

test("formatFrenchReportSubject always uses French", () => {
  assert.equal(formatFrenchReportSubject("2026-04"), "Rapport d’heures supplémentaires - Avril 2026");
});
