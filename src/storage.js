import { isValidDateValue } from "./utils.js?v=20261124c";

export const STORAGE_KEYS = {
  lang: "ot_lang",
  entries: "ot",
  firstName: "ot_first",
  lastName: "ot_last"
};

export function readLanguage(translations, fallback = "fr") {
  const stored = localStorage.getItem(STORAGE_KEYS.lang);
  return Object.prototype.hasOwnProperty.call(translations, stored) ? stored : fallback;
}

export function writeLanguage(languageCode) {
  localStorage.setItem(STORAGE_KEYS.lang, languageCode);
}

export function sanitizeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (typeof entry.date !== "string" || !isValidDateValue(entry.date)) {
    return null;
  }

  const hours = Number(entry.hours);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return null;
  }

  return {
    id: Number.isInteger(entry.id) ? entry.id : Date.now() + Math.floor(Math.random() * 1000),
    date: entry.date,
    hours: Number(hours.toFixed(2)),
    note: typeof entry.note === "string" ? entry.note.trim().slice(0, 240) : ""
  };
}

export function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEYS.entries);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(sanitizeEntry).filter(Boolean) : [];
  } catch (error) {
    console.warn("Could not parse stored entries:", error);
    return [];
  }
}

export function persistEntries(entries) {
  localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
}

export function getStoredNameParts() {
  return {
    firstName: localStorage.getItem(STORAGE_KEYS.firstName) || "",
    lastName: localStorage.getItem(STORAGE_KEYS.lastName) || ""
  };
}

export function getStoredFullName() {
  const { firstName, lastName } = getStoredNameParts();
  return [firstName, lastName].filter(Boolean).join(" ");
}

export function setStoredName(firstName, lastName) {
  localStorage.setItem(STORAGE_KEYS.firstName, firstName);
  localStorage.setItem(STORAGE_KEYS.lastName, lastName);
}

export const BACKUP_FORMAT = "heures-supplementaires-backup";
export const BACKUP_VERSION = 1;

export function buildBackup({ entries, firstName = "", lastName = "" }, now = new Date()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    firstName,
    lastName,
    entries
  };
}

// Accepts a backup produced by buildBackup, or a bare entries array (the raw
// value stored under STORAGE_KEYS.entries). Throws if nothing usable is found.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("invalid-json");
  }

  const isBackup = data && typeof data === "object" && data.format === BACKUP_FORMAT;
  const rawEntries = Array.isArray(data) ? data : isBackup ? data.entries : null;
  if (!Array.isArray(rawEntries)) {
    throw new Error("invalid-backup");
  }

  const entries = rawEntries.map(sanitizeEntry).filter(Boolean);
  if (rawEntries.length && !entries.length) {
    throw new Error("no-valid-entries");
  }

  return {
    entries,
    firstName: isBackup && typeof data.firstName === "string" ? data.firstName.trim().slice(0, 40) : "",
    lastName: isBackup && typeof data.lastName === "string" ? data.lastName.trim().slice(0, 40) : ""
  };
}

// Adds imported entries to the current ones. An imported entry whose id is
// already present is skipped, so importing the same backup twice is harmless.
export function mergeEntries(current, imported) {
  const knownIds = new Set(current.map((entry) => entry.id));
  const added = imported.filter((entry) => !knownIds.has(entry.id));
  return { entries: [...current, ...added], addedCount: added.length };
}

export function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return;
  }
  navigator.storage.persisted()
    .then((persisted) => persisted || navigator.storage.persist())
    .catch(() => {});
}
