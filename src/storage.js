export const STORAGE_KEYS = {
  lang: "ot_lang",
  entries: "ot",
  firstName: "ot_first",
  lastName: "ot_last"
};

export function readLanguage(translations, fallback = "en") {
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

  if (typeof entry.date !== "string" || !isValidStoredDate(entry.date)) {
    return null;
  }

  const hours = Number(entry.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
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

function isValidStoredDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}
