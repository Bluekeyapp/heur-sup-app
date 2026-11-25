export function sortEntriesDesc(entries) {
  return [...entries].sort((left, right) => {
    if (left.date === right.date) {
      return right.id - left.id;
    }
    return right.date.localeCompare(left.date);
  });
}

export function sortEntriesAsc(entries) {
  return [...entries].sort((left, right) => {
    if (left.date === right.date) {
      return left.id - right.id;
    }
    return left.date.localeCompare(right.date);
  });
}

const REPORT_LOCALE = "fr-FR";
const COLON = ": ";

export function formatHours(hoursValue) {
  const totalMinutes = Math.round(hoursValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  if (minutes) {
    return `${minutes}m`;
  }

  return "0h";
}

export function formatDate(locale, dateValue, options) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(`${dateValue}T00:00:00`));
}

export function formatFrenchReportMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return capitalizeFirstLetter(new Intl.DateTimeFormat(REPORT_LOCALE, {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1)));
}

export function formatFrenchReport({ entries, fullName = "", monthKey }) {
  const reportEntries = sortEntriesAsc(entries);
  const total = reportEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const lines = [
    "Heure Supplementaire",
    "",
    `Salarié${COLON}${fullName || "-"}`,
    `Période${COLON}${formatFrenchReportMonth(monthKey)}`,
    "",
    `Total${COLON}${formatFrenchReportHours(total)}`,
    "",
    `Détails${COLON.trimEnd()}`
  ];

  if (!reportEntries.length) {
    lines.push("• Aucune heure supplémentaire.");
    return lines.join("\n");
  }

  reportEntries.forEach((entry, index) => {
    if (index > 0) {
      lines.push("");
    }

    // Weekday plus day/month (« Samedi 14/11 ») so a single line still makes
    // sense when it is quoted or forwarded on its own.
    const weekday = capitalizeFirstLetter(formatDate(REPORT_LOCALE, entry.date, { weekday: "long" }));
    const dayMonth = formatDate(REPORT_LOCALE, entry.date, { day: "2-digit", month: "2-digit" });
    lines.push(`• ${weekday} ${dayMonth}${COLON}${formatFrenchReportHours(entry.hours)}`);

    if (entry.note) {
      lines.push(`   ↳ ${entry.note}`);
    }
  });

  return lines.join("\n");
}

function formatFrenchReportHours(hoursValue) {
  const totalMinutes = Math.round(hoursValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function capitalizeFirstLetter(value) {
  return value.charAt(0).toLocaleUpperCase(REPORT_LOCALE) + value.slice(1);
}

export const MAX_ENTRY_HOURS = 24;

// Keeps a picker value at or below MAX_ENTRY_HOURS. When the limit is exceeded,
// the field the user did not just change gives way: raising the hours to 24
// clears the minutes, and picking minutes while at 24h drops the hours to 23.
export function clampPickerTime(hours, minutes, changed = "hours") {
  const safeHours = Math.max(0, Math.min(MAX_ENTRY_HOURS, Math.trunc(hours) || 0));
  const safeMinutes = Math.max(0, Math.min(59, Math.trunc(minutes) || 0));

  if (safeHours * 60 + safeMinutes <= MAX_ENTRY_HOURS * 60) {
    return { hours: safeHours, minutes: safeMinutes };
  }

  return changed === "minutes"
    ? { hours: MAX_ENTRY_HOURS - 1, minutes: safeMinutes }
    : { hours: MAX_ENTRY_HOURS, minutes: 0 };
}

export function getLocalDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Overtime can only be logged for today or earlier. Dates are compared as
// YYYY-MM-DD strings in local time, which sort chronologically.
export function isFutureDateValue(value, today = new Date()) {
  return value > getLocalDateInputValue(today);
}

export function isValidDateValue(value) {
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

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn("Clipboard API failed:", error);
    }
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.top = "-9999px";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.warn("Fallback copy failed:", error);
  }

  document.body.removeChild(helper);
  return copied;
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const serviceWorkerUrl = new URL("../sw.js", import.meta.url);
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
