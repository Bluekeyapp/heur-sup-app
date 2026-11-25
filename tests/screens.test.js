import test from "node:test";
import assert from "node:assert/strict";

import { loadApp } from "./helpers/load-app.js";

const NOW = "2026-11-24T10:00:00";
const NAMED = { ot_first: "Ana", ot_last: "Silva" };

async function start(t, options = {}) {
  const app = await loadApp({ now: NOW, ...options });
  t.after(() => app.cleanup());
  return app;
}

async function addEntry(app, { date, hours = 0, minutes = 0, note = "" }) {
  const { $ } = app;
  $("startFlowButton").click();
  if (date) {
    $("inputDate").value = date;
  }
  $("continueFromDateButton").click();
  for (let i = 0; i < hours; i += 1) {
    $("increaseHoursButton").click();
  }
  app.document.querySelector(`[data-minutes="${minutes}"]`).click();
  $("continueFromHoursButton").click();
  $("inputNote").value = note;
  $("continueFromNoteButton").click();
  $("saveEntryButton").click();
}

test("first launch asks for a name in French and blocks the app behind it", async (t) => {
  const app = await start(t);
  const { $, document } = app;

  assert.equal(document.documentElement.lang, "fr");
  assert.equal($("welcomeTitle").textContent, "Quel est votre nom ?");
  assert.equal($("nameOverlay").style.display, "flex");
  assert.equal($("slider").inert, true);

  $("submitNameButton").click();
  assert.equal($("nameOverlay").style.display, "flex", "an empty name is refused");

  $("firstName").value = "Ana";
  $("lastName").value = "Silva";
  $("submitNameButton").click();

  assert.equal(app.storage.getItem("ot_first"), "Ana");
  assert.equal($("homeNameText").textContent, "Ana Silva");
  assert.equal($("slider").inert, false);
});

test("adding an entry walks through the steps and updates the total", async (t) => {
  const app = await start(t, { storage: NAMED });
  const { $ } = app;

  $("startFlowButton").click();
  assert.equal(app.currentScreen(), "screen-date");
  assert.equal($("inputDate").value, "2026-11-24", "defaults to today");
  assert.equal($("inputDate").max, "2026-11-24");

  $("continueFromDateButton").click();
  assert.equal(app.currentScreen(), "screen-hours");
  $("increaseHoursButton").click();
  $("increaseHoursButton").click();
  app.document.querySelector('[data-minutes="30"]').click();
  assert.equal($("timePreview").textContent, "2h 30m");

  $("continueFromHoursButton").click();
  assert.equal(app.currentScreen(), "screen-note");
  $("inputNote").value = "Inventaire";
  $("continueFromNoteButton").click();

  assert.equal(app.currentScreen(), "screen-confirm");
  assert.equal($("confirmHours").textContent, "2h 30m");
  assert.equal($("confirmNote").textContent, "Inventaire");

  $("saveEntryButton").click();
  assert.equal(app.currentScreen(), "screen-home");
  assert.equal(app.toast(), "Saisie enregistrée");
  assert.equal($("homeTotal").textContent, "2h 30m");
  assert.deepEqual(app.entries().map(({ date, hours, note }) => ({ date, hours, note })), [
    { date: "2026-11-24", hours: 2.5, note: "Inventaire" }
  ]);
});

test("a 0h entry cannot be saved without a note", async (t) => {
  const app = await start(t, { storage: NAMED });

  await addEntry(app, { hours: 0, note: "" });

  assert.equal(app.currentScreen(), "screen-note");
  assert.equal(app.toast(), "Ajoutez une note pour enregistrer 0h.");
  assert.deepEqual(app.entries(), []);
});

test("a future date is refused", async (t) => {
  const app = await start(t, { storage: NAMED });
  const { $ } = app;

  $("startFlowButton").click();
  $("inputDate").value = "2026-11-25";
  $("continueFromDateButton").click();

  assert.equal(app.currentScreen(), "screen-date");
  assert.equal(app.toast(), "Choisissez aujourd'hui ou une date passée.");
});

test("the hours picker never goes above 24h", async (t) => {
  const app = await start(t, { storage: NAMED });
  const { $ } = app;

  $("startFlowButton").click();
  $("continueFromDateButton").click();
  for (let i = 0; i < 30; i += 1) {
    $("increaseHoursButton").click();
  }
  app.document.querySelector('[data-minutes="45"]').click();
  assert.equal($("timePreview").textContent, "23h 45m");

  $("increaseHoursButton").click();
  assert.equal($("timePreview").textContent, "24h");
});

test("editing keeps non-standard minutes visible and updates the entry", async (t) => {
  const app = await start(t, {
    storage: { ...NAMED, ot: [{ id: 7, date: "2026-11-10", hours: 2 + 20 / 60, note: "Ancienne" }] }
  });
  const { $ } = app;

  $("manageEntriesButton").click();
  app.document.querySelector(".entry-action-edit").click();
  assert.equal(app.currentScreen(), "screen-date");
  assert.equal($("inputDate").value, "2026-11-10");

  $("continueFromDateButton").click();
  const custom = $("customMinutesButton");
  assert.equal(custom.hidden, false);
  assert.equal(custom.textContent, "20");
  assert.equal(custom.getAttribute("aria-pressed"), "true");
  assert.equal($("timePreview").textContent, "2h 20m");

  $("increaseHoursButton").click();
  $("continueFromHoursButton").click();
  $("continueFromNoteButton").click();
  assert.equal($("saveEntryButton").textContent, "Mettre à jour");
  $("saveEntryButton").click();

  assert.equal(app.toast(), "Saisie mise à jour");
  const [entry] = app.entries();
  assert.equal(entry.id, 7);
  assert.equal(Math.round(entry.hours * 60), 3 * 60 + 20);
  assert.equal(entry.note, "Ancienne");
});

test("deleting an entry can be undone from the toast", async (t) => {
  const app = await start(t, {
    storage: { ...NAMED, ot: [{ id: 1, date: "2026-11-10", hours: 2, note: "" }] }
  });
  const { $ } = app;

  $("manageEntriesButton").click();
  app.document.querySelector(".entry-action-delete").click();

  assert.deepEqual(app.entries(), []);
  assert.equal(app.toast(), "Saisie supprimée");
  assert.equal($("toastAction").hidden, false);
  assert.equal($("toastAction").textContent, "Annuler");

  $("toastAction").click();
  assert.equal(app.entries().length, 1);
  assert.equal(app.toast(), "Saisie restaurée");
  assert.equal($("homeTotal").textContent, "2h");
});

test("the month filter switches the total between months", async (t) => {
  const app = await start(t, {
    storage: {
      ...NAMED,
      ot: [
        { id: 1, date: "2026-10-05", hours: 1, note: "" },
        { id: 2, date: "2026-11-03", hours: 3, note: "" }
      ]
    }
  });
  const { $, document } = app;

  const chips = [...document.querySelectorAll(".month-chip")];
  assert.deepEqual(chips.map((chip) => chip.textContent), ["octobre 2026", "novembre 2026"]);
  assert.equal($("homeTotal").textContent, "3h", "the latest month is selected");

  chips[0].click();
  assert.equal($("homeTotal").textContent, "1h");
  assert.equal($("homePeriod").textContent, "octobre 2026");
});

test("the report sheet shows the French report and manages focus", async (t) => {
  const app = await start(t, {
    storage: { ...NAMED, ot: [{ id: 1, date: "2026-11-03", hours: 1.5, note: "Livraison" }] }
  });
  const { $, document, window } = app;

  $("openSendButton").focus();
  $("openSendButton").click();

  const report = $("reportBox").textContent;
  assert.match(report, /Salarié: Ana Silva/);
  assert.match(report, /Période: Novembre 2026/);
  assert.match(report, /Total: 1h30/);
  assert.match(report, /• Mardi 03\/11: 1h30\n {3}- Livraison/);
  assert.equal(document.activeElement, $("closeSendButton"));
  assert.equal($("slider").inert, true);

  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal($("sendSheet").inert, true);
  assert.equal($("slider").inert, false);
  assert.equal(document.activeElement, $("openSendButton"));
});

test("switching language updates the interface and is remembered", async (t) => {
  const app = await start(t, { storage: NAMED });
  const { $, document } = app;

  document.querySelector('[data-lang="en"]').click();

  assert.equal(document.documentElement.lang, "en");
  assert.equal(document.title, "Overtime");
  assert.equal($("increaseHoursButton").getAttribute("aria-label"), "Add one hour");
  assert.equal(app.storage.getItem("ot_lang"), "en");
});

test("importing a backup adds new entries only", async (t) => {
  const app = await start(t, {
    storage: { ...NAMED, ot: [{ id: 1, date: "2026-11-03", hours: 1, note: "" }] }
  });
  const { $, window } = app;
  let question = null;
  window.confirm = (message) => {
    question = message;
    return true;
  };

  const backup = {
    format: "heures-supplementaires-backup",
    version: 1,
    entries: [
      { id: 1, date: "2026-11-03", hours: 1, note: "" },
      { id: 2, date: "2026-11-04", hours: 2, note: "Import" }
    ]
  };
  const input = $("importFileInput");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new window.File([JSON.stringify(backup)], "backup.json", { type: "application/json" })]
  });
  input.dispatchEvent(new window.Event("change"));
  await app.tick(20);

  assert.equal(question, "Ajouter 1 saisie depuis cette sauvegarde ?");
  assert.equal(app.toast(), "1 saisie importée");
  assert.deepEqual(app.entries().map((entry) => entry.id).sort(), [1, 2]);
  assert.equal($("homeTotal").textContent, "3h");
});
