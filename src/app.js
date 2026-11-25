import { TRANSLATIONS } from "./translations.js?v=20261124f";
import {
  buildBackup,
  getStoredFullName,
  getStoredNameParts,
  loadEntries,
  mergeEntries,
  parseBackup,
  persistEntries,
  readLanguage,
  requestPersistentStorage,
  sanitizeEntry,
  setStoredName,
  writeLanguage
} from "./storage.js?v=20261124f";
import {
  clampPickerTime,
  copyText,
  formatDate,
  formatFrenchReport,
  formatHours,
  getLocalDateInputValue,
  isFutureDateValue,
  isValidDateValue,
  registerServiceWorker,
  sortEntriesDesc
} from "./utils.js?v=20261124f";

const SCREEN_INDEX = {
  home: 0,
  date: 1,
  hours: 2,
  note: 3,
  confirm: 4
};

const state = {
  lang: readLanguage(TRANSLATIONS, "fr"),
  entries: sortEntriesDesc(loadEntries()),
  selectedMonthKey: getCurrentMonthKey(),
  expandedEntryId: null,
  manageEntriesOpen: false,
  sendSheetOpen: false,
  nameOverlayOpen: false,
  currentScreen: SCREEN_INDEX.home,
  draft: createEmptyDraft(),
  editingEntryId: null,
  pickerHours: 0,
  pickerMins: 0
};

const dom = {
  slider: document.getElementById("slider"),
  screenNodes: Array.from(document.querySelectorAll(".screen")),
  inputDate: document.getElementById("inputDate"),
  inputNote: document.getElementById("inputNote"),
  dispHours: document.getElementById("dispHours"),
  timePreview: document.getElementById("timePreview"),
  confirmDate: document.getElementById("confirmDate"),
  confirmHours: document.getElementById("confirmHours"),
  confirmNote: document.getElementById("confirmNote"),
  confirmNoteRow: document.getElementById("confirmNoteRow"),
  entriesScroll: document.getElementById("entriesScroll"),
  homeTotal: document.getElementById("homeTotal"),
  homePeriod: document.getElementById("homePeriod"),
  homeNameText: document.getElementById("homeNameText"),
  manageEntriesButton: document.getElementById("manageEntriesButton"),
  monthFilterWrap: document.getElementById("monthFilterWrap"),
  monthFilter: document.getElementById("monthFilter"),
  nameOverlay: document.getElementById("nameOverlay"),
  firstName: document.getElementById("firstName"),
  lastName: document.getElementById("lastName"),
  sheetBackdrop: document.getElementById("sheetBackdrop"),
  sendSheet: document.getElementById("sendSheet"),
  closeSendButton: document.getElementById("closeSendButton"),
  reportBox: document.getElementById("reportBox"),
  saveEntryButton: document.getElementById("saveEntryButton"),
  toast: document.getElementById("toast"),
  toastText: document.getElementById("toastText"),
  toastAction: document.getElementById("toastAction"),
  customMinutesButton: document.getElementById("customMinutesButton"),
  importFileInput: document.getElementById("importFileInput"),
  openSendButton: document.getElementById("openSendButton"),
  copyReportButton: document.getElementById("copyReportButton"),
  whatsappReportButton: document.getElementById("whatsappReportButton"),
  flowTitleNodes: Array.from(document.querySelectorAll("#screen-date .topbar-title, #screen-hours .topbar-title, #screen-note .topbar-title"))
};

let toastTimer = null;
const pressHintTimers = new WeakMap();
let viewportTimer = null;
let focusBeforeSheet = null;
let toastActionHandler = null;

bindEvents();
initialize();

function createEmptyDraft() {
  return { date: "", hours: null, note: "" };
}

function useCompactMonthLabels() {
  return window.matchMedia("(max-width: 430px)").matches;
}

function getCurrentMonthKey() {
  return getLocalDateInputValue(new Date()).slice(0, 7);
}

function getEntryMonthKey(entry) {
  return entry.date.slice(0, 7);
}

function getAvailableMonthKeys(entries = state.entries) {
  return Array.from(new Set(entries.map(getEntryMonthKey))).sort((left, right) => left.localeCompare(right));
}

function formatMonthKey(monthKey, monthStyle = "long") {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(translate("locale"), {
    month: monthStyle,
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function formatEntryMeta(entry) {
  return `${formatHours(entry.hours)} ${formatEntryDayMonth(entry)}`.trim();
}

function formatEntryDayMonth(entry) {
  const parts = new Intl.DateTimeFormat(translate("locale"), {
    day: "numeric",
    month: "short"
  }).formatToParts(new Date(`${entry.date}T00:00:00`));

  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${day} ${month}`.trim();
}

function getSelectedMonthEntries() {
  return state.entries.filter((entry) => getEntryMonthKey(entry) === state.selectedMonthKey);
}

function syncSelectedMonth(preferredMonthKey = state.selectedMonthKey) {
  const availableMonthKeys = getAvailableMonthKeys();
  if (!availableMonthKeys.length) {
    state.selectedMonthKey = getCurrentMonthKey();
    return;
  }

  if (preferredMonthKey && availableMonthKeys.includes(preferredMonthKey)) {
    state.selectedMonthKey = preferredMonthKey;
    return;
  }

  state.selectedMonthKey = availableMonthKeys[availableMonthKeys.length - 1];
}

function resetEntryFlowState() {
  state.draft = createEmptyDraft();
  state.editingEntryId = null;
  state.pickerHours = 0;
  state.pickerMins = 0;
  updateFlowCopy();
}

function bindEvents() {
  document.getElementById("startFlowButton").addEventListener("click", startFlow);
  document.getElementById("openSendButton").addEventListener("click", openSend);
  document.getElementById("editNameButton").addEventListener("click", openNameOverlay);
  dom.manageEntriesButton.addEventListener("click", toggleManageEntries);
  document.getElementById("continueFromDateButton").addEventListener("click", goToHours);
  document.getElementById("continueFromHoursButton").addEventListener("click", goToNote);
  document.getElementById("continueFromNoteButton").addEventListener("click", goToConfirm);
  document.getElementById("skipNoteButton").addEventListener("click", goToConfirm);
  document.getElementById("saveEntryButton").addEventListener("click", saveEntry);
  document.getElementById("cancelEntryButton").addEventListener("click", cancelEntryFlow);
  document.getElementById("copyReportButton").addEventListener("click", copyReport);
  document.getElementById("whatsappReportButton").addEventListener("click", openWhatsAppReport);
  document.getElementById("submitNameButton").addEventListener("click", submitName);
  document.getElementById("decreaseHoursButton").addEventListener("click", () => changeHours(-1));
  document.getElementById("increaseHoursButton").addEventListener("click", () => changeHours(1));
  document.getElementById("backFromDateButton").addEventListener("click", goBack);
  document.getElementById("backFromHoursButton").addEventListener("click", goBack);
  document.getElementById("backFromNoteButton").addEventListener("click", goBack);
  document.getElementById("backFromConfirmButton").addEventListener("click", goBack);
  document.getElementById("exportDataButton").addEventListener("click", exportBackup);
  document.getElementById("importDataButton").addEventListener("click", startImport);
  dom.importFileInput.addEventListener("change", importBackup);
  dom.toastAction.addEventListener("click", runToastAction);
  dom.closeSendButton.addEventListener("click", closeSendSheet);
  dom.sheetBackdrop.addEventListener("click", closeSendSheet);

  document.querySelectorAll("[data-minutes]").forEach((button) => {
    button.addEventListener("click", () => selectMinutes(Number(button.dataset.minutes)));
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => selectLanguage(button.dataset.lang));
  });

  dom.firstName.addEventListener("keydown", handleNameSubmitKey);
  dom.lastName.addEventListener("keydown", handleNameSubmitKey);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.sendSheetOpen) {
      closeSendSheet();
    }
  });

  window.addEventListener("resize", handleViewportChange);
}

function bindPressHint(element, getMessage) {
  let suppressClick = false;

  const cancelHint = () => {
    const timer = pressHintTimers.get(element);
    if (timer) {
      window.clearTimeout(timer);
      pressHintTimers.delete(element);
    }
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }

    cancelHint();
    const timer = window.setTimeout(() => {
      suppressClick = true;
      const message = typeof getMessage === "function" ? getMessage() : getMessage;
      if (message) {
        showToast(message);
      }
    }, 420);
    pressHintTimers.set(element, timer);
  });

  ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach((eventName) => {
    element.addEventListener(eventName, cancelHint);
  });

  element.addEventListener("click", (event) => {
    if (!suppressClick) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);
}

function initialize() {
  dom.inputDate.max = getLocalDateInputValue(new Date());
  dom.screenNodes.forEach((screen) => screen.setAttribute("tabindex", "-1"));
  syncSelectedMonth();
  applyLanguage();
  updateHomeNameDisplay();
  goTo(SCREEN_INDEX.home);
  registerServiceWorker();

  if (state.entries.length) {
    requestPersistentStorage();
  }

  if (getStoredFullName()) {
    dom.nameOverlay.style.display = "none";
    setNameOverlayOpen(false);
  } else {
    dom.nameOverlay.style.display = "flex";
    setNameOverlayOpen(true);
    window.setTimeout(() => dom.firstName.focus(), 60);
  }
}

function translate(key) {
  return (TRANSLATIONS[state.lang] || TRANSLATIONS.fr)[key] || key;
}

function translateCount(key, count) {
  const translations = TRANSLATIONS[state.lang] || TRANSLATIONS.fr;
  const pluralKey = count === 1 && translations[`${key}_one`] ? `${key}_one` : key;
  return translate(pluralKey).replace("{count}", String(count));
}

function isEditingEntry() {
  return state.editingEntryId !== null;
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.title = translate("app_title");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = translate(element.dataset.i18nPlaceholder);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = translate(element.dataset.i18nTitle);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  });

  updateLanguageButtons();
  updateFlowCopy();
  updateHomeNameDisplay();
  updatePickerUI();
  renderHome();

  if (state.currentScreen === SCREEN_INDEX.confirm) {
    populateConfirmation();
  }

  if (state.sendSheetOpen) {
    renderReport();
  }
}

function updateLanguageButtons() {
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === state.lang);
  });
}

function updateFlowCopy() {
  const flowTitle = isEditingEntry() ? translate("edit_entry") : translate("new_entry");
  const saveLabel = isEditingEntry() ? translate("update_entry") : translate("add_entry");

  dom.flowTitleNodes.forEach((node) => {
    node.textContent = flowTitle;
  });

  dom.saveEntryButton.textContent = saveLabel;
}

function selectLanguage(languageCode) {
  state.lang = Object.prototype.hasOwnProperty.call(TRANSLATIONS, languageCode) ? languageCode : "fr";
  writeLanguage(state.lang);
  applyLanguage();
}

function selectMonth(monthKey) {
  state.selectedMonthKey = monthKey;
  renderHome();

  if (state.sendSheetOpen) {
    renderReport();
  }
}

function goTo(index) {
  if (state.sendSheetOpen) {
    closeSendSheet();
  }

  state.currentScreen = index;
  dom.slider.style.transform = `translateX(-${index * 100}vw)`;

  dom.screenNodes.forEach((screen, screenIndex) => {
    const hidden = screenIndex !== index;
    screen.inert = hidden;
    screen.setAttribute("aria-hidden", String(hidden));
  });

  // Focus left on a button of the screen we just hid would be lost, so move
  // it to the new screen. Screens that focus an input do so on their own.
  const active = document.activeElement;
  if (!active || active === document.body || active.closest("[inert]")) {
    dom.screenNodes[index].focus({ preventScroll: true });
  }
}

// Content behind a dialog must not be reachable with Tab or by screen readers.
function updateBackgroundInert() {
  dom.slider.inert = state.nameOverlayOpen || state.sendSheetOpen;
}

function setNameOverlayOpen(open) {
  state.nameOverlayOpen = open;
  dom.nameOverlay.inert = !open;
  updateBackgroundInert();
}

function goBack() {
  if (state.currentScreen === SCREEN_INDEX.date) {
    resetEntryFlowState();
  }

  if (state.currentScreen > SCREEN_INDEX.home) {
    goTo(state.currentScreen - 1);
  }
}

function refreshDateLimit() {
  // Set on every flow start so the limit is still right if the app stayed
  // open past midnight.
  dom.inputDate.max = getLocalDateInputValue(new Date());
}

function startFlow() {
  closeSendSheet();
  resetEntryFlowState();
  refreshDateLimit();
  dom.inputDate.value = getLocalDateInputValue(new Date());
  dom.inputNote.value = "";
  selectMinutes(0);
  updatePickerUI();
  goTo(SCREEN_INDEX.date);
  window.setTimeout(() => dom.inputDate.focus(), 120);
}

function changeHours(step) {
  setPickerTime(state.pickerHours + step, state.pickerMins, "hours");
}

function selectMinutes(minutes) {
  setPickerTime(state.pickerHours, minutes, "minutes");
}

function setPickerTime(hours, minutes, changed) {
  const next = clampPickerTime(hours, minutes, changed);
  state.pickerHours = next.hours;
  state.pickerMins = next.minutes;
  updatePickerUI();
}

function updatePickerUI() {
  let matchedChip = false;
  document.querySelectorAll("[data-minutes]").forEach((button) => {
    const active = Number(button.dataset.minutes) === state.pickerMins;
    matchedChip = matchedChip || active;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  // Entries edited from older data or a backup can have minutes that are not
  // one of the chips (e.g. 20). Show that value as an extra, selected chip
  // instead of leaving every chip unselected.
  dom.customMinutesButton.hidden = matchedChip;
  dom.customMinutesButton.textContent = String(state.pickerMins).padStart(2, "0");
  dom.customMinutesButton.classList.toggle("active", !matchedChip);
  dom.customMinutesButton.setAttribute("aria-pressed", String(!matchedChip));
  dom.dispHours.textContent = String(state.pickerHours);
  const total = getPickerTotalHours();
  dom.timePreview.textContent = total ? formatHours(total) : "0h";
  dom.timePreview.classList.toggle("has-time", total > 0);
}

function getPickerTotalHours() {
  return state.pickerHours + state.pickerMins / 60;
}

function setPickerFromHours(hoursValue) {
  const totalMinutes = Math.round(hoursValue * 60);
  setPickerTime(Math.floor(totalMinutes / 60), totalMinutes % 60, "hours");
}

function openEditFlow(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) {
    return;
  }

  closeSendSheet();
  state.editingEntryId = entry.id;
  state.draft = {
    date: entry.date,
    hours: entry.hours,
    note: entry.note || ""
  };

  refreshDateLimit();
  dom.inputDate.value = entry.date;
  dom.inputNote.value = entry.note || "";
  setPickerFromHours(entry.hours);
  updatePickerUI();
  updateFlowCopy();
  goTo(SCREEN_INDEX.date);
  window.setTimeout(() => dom.inputDate.focus(), 120);
}

function goToHours() {
  const selectedDate = dom.inputDate.value;
  if (!isValidDateValue(selectedDate)) {
    shakeElement(dom.inputDate);
    return;
  }

  if (isFutureDateValue(selectedDate)) {
    shakeElement(dom.inputDate);
    showToast(translate("future_date"));
    return;
  }

  state.draft.date = selectedDate;
  goTo(SCREEN_INDEX.hours);
}

function goToNote() {
  const total = getPickerTotalHours();
  state.draft.hours = Number(total.toFixed(2));
  goTo(SCREEN_INDEX.note);
  window.setTimeout(() => dom.inputNote.focus(), 120);
}

function goToConfirm() {
  if (!state.draft.date || typeof state.draft.hours !== "number") {
    goTo(SCREEN_INDEX.date);
    return;
  }

  state.draft.note = dom.inputNote.value.trim().slice(0, 240);
  populateConfirmation();
  goTo(SCREEN_INDEX.confirm);
}

function toggleExpandedEntry(id) {
  state.expandedEntryId = state.expandedEntryId === id ? null : id;
  renderHome();
}

function toggleManageEntries() {
  state.manageEntriesOpen = !state.manageEntriesOpen;
  renderHome();
}

function populateConfirmation() {
  dom.confirmDate.textContent = formatDate(translate("locale"), state.draft.date, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  dom.confirmHours.textContent = formatHours(state.draft.hours);

  if (state.draft.note) {
    dom.confirmNote.textContent = state.draft.note;
    dom.confirmNoteRow.style.display = "flex";
  } else {
    dom.confirmNote.textContent = "-";
    dom.confirmNoteRow.style.display = "none";
  }
}

function saveEntry() {
  const editingEntryId = state.editingEntryId;
  const editing = isEditingEntry();

  if (state.draft.hours === 0 && !state.draft.note) {
    showToast(translate("zero_hours_note_required"));
    goTo(SCREEN_INDEX.note);
    window.setTimeout(() => {
      dom.inputNote.focus();
      shakeElement(dom.inputNote);
    }, 120);
    return;
  }

  const entry = sanitizeEntry({
    id: editing ? editingEntryId : Date.now(),
    date: state.draft.date,
    hours: state.draft.hours,
    note: state.draft.note
  });

  if (!entry) {
    showToast(translate("no_entries_report"));
    goTo(SCREEN_INDEX.date);
    return;
  }

  if (editing) {
    let updatedExistingEntry = false;
    state.entries = sortEntriesDesc(state.entries.map((item) => {
      if (item.id === editingEntryId) {
        updatedExistingEntry = true;
        return entry;
      }
      return item;
    }));

    if (!updatedExistingEntry) {
      state.entries = sortEntriesDesc([entry, ...state.entries]);
    }
  } else {
    state.entries = sortEntriesDesc([entry, ...state.entries]);
  }

  state.selectedMonthKey = getEntryMonthKey(entry);
  state.expandedEntryId = entry.id;
  persistEntries(state.entries);
  requestPersistentStorage();
  renderHome();
  showToast(translate(editing ? "updated" : "saved"));
  resetEntryFlowState();
  goTo(SCREEN_INDEX.home);
}

function renderHome() {
  syncSelectedMonth();
  const filteredEntries = getSelectedMonthEntries();
  const total = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
  dom.homeTotal.textContent = formatHours(total);
  dom.homePeriod.textContent = state.entries.length ? formatMonthKey(state.selectedMonthKey) : "";
  dom.openSendButton.disabled = filteredEntries.length === 0;
  dom.manageEntriesButton.disabled = filteredEntries.length === 0;
  dom.manageEntriesButton.setAttribute("aria-expanded", String(state.manageEntriesOpen));
  dom.manageEntriesButton.classList.toggle("active", state.manageEntriesOpen);

  renderMonthFilter();

  if (!state.entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-msg";
    empty.textContent = translate("empty_msg");
    dom.entriesScroll.replaceChildren(empty);
    return;
  }

  if (!filteredEntries.length) {
    state.manageEntriesOpen = false;
    const empty = document.createElement("div");
    empty.className = "empty-msg";
    empty.textContent = translate("empty_month_msg");
    dom.entriesScroll.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredEntries.forEach((entry) => {
    fragment.appendChild(createEntryRow(entry));
  });
  dom.entriesScroll.replaceChildren(fragment);
}

function renderMonthFilter() {
  const availableMonthKeys = getAvailableMonthKeys();
  const compactLabels = useCompactMonthLabels();
  dom.monthFilter.replaceChildren();
  dom.monthFilterWrap.hidden = availableMonthKeys.length <= 1;

  if (availableMonthKeys.length <= 1) {
    return;
  }

  const fragment = document.createDocumentFragment();
  availableMonthKeys.forEach((monthKey) => {
    const fullLabel = formatMonthKey(monthKey);
    const compactLabel = formatMonthKey(monthKey, "short");
    const visibleLabel = compactLabels ? compactLabel : fullLabel;
    const button = document.createElement("button");
    button.className = "month-chip";
    button.type = "button";
    button.textContent = visibleLabel;
    button.setAttribute("aria-label", fullLabel);
    button.title = fullLabel;
    button.classList.toggle("active", monthKey === state.selectedMonthKey);
    button.addEventListener("click", () => selectMonth(monthKey));
    if (compactLabels && compactLabel !== fullLabel) {
      bindPressHint(button, () => fullLabel);
    }
    fragment.appendChild(button);
  });
  dom.monthFilter.appendChild(fragment);
}

function createEntryRow(entry) {
  const row = document.createElement("article");
  row.className = "entry-row";
  row.classList.toggle("expanded", state.expandedEntryId === entry.id);
  row.classList.toggle("actions-open", state.manageEntriesOpen);

  const entrySurface = document.createElement("div");
  entrySurface.className = "entry-surface";

  const summary = document.createElement("div");
  summary.className = "entry-summary";

  const main = document.createElement("button");
  main.className = "entry-main";
  main.type = "button";
  main.setAttribute("aria-expanded", String(Boolean(entry.note) && state.expandedEntryId === entry.id));
  main.setAttribute("aria-label", formatEntryMeta(entry));
  main.addEventListener("click", () => {
    if (entry.note) {
      toggleExpandedEntry(entry.id);
    }
  });

  const meta = document.createElement("span");
  meta.className = "entry-meta";

  const hours = document.createElement("span");
  hours.className = "entry-hrs";
  hours.textContent = formatHours(entry.hours);

  const date = document.createElement("span");
  date.className = "entry-date";
  date.textContent = formatEntryDayMonth(entry);

  const preview = document.createElement("span");
  preview.className = "entry-preview";
  preview.textContent = entry.note || "";
  if (entry.note) {
    preview.title = entry.note;
  }

  meta.append(hours, date);
  main.append(meta, preview);
  summary.appendChild(main);

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const editButton = createEntryActionButton("edit", translate("edit_entry"), () => openEditFlow(entry.id));
  const deleteButton = createEntryActionButton("delete", translate("delete_entry"), () => deleteEntry(entry.id));

  actions.append(editButton, deleteButton);
  summary.appendChild(actions);
  entrySurface.appendChild(summary);

  if (entry.note) {
    const details = document.createElement("div");
    details.className = "entry-details";
    details.textContent = entry.note;
    entrySurface.appendChild(details);
  }

  row.appendChild(entrySurface);
  return row;
}

function createEntryActionButton(kind, label, onClick) {
  const button = document.createElement("button");
  button.className = `entry-action entry-action-${kind}`;
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", label);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  return button;
}

function deleteEntry(id) {
  const removed = state.entries.find((entry) => entry.id === id);
  if (!removed) {
    return;
  }

  state.entries = state.entries.filter((entry) => entry.id !== id);
  if (state.expandedEntryId === id) {
    state.expandedEntryId = null;
  }
  persistEntries(state.entries);
  refreshAfterEntriesChange();
  showToast(translate("deleted"), {
    label: translate("undo"),
    onClick: () => restoreEntry(removed)
  });
}

function restoreEntry(entry) {
  if (state.entries.some((item) => item.id === entry.id)) {
    return;
  }

  state.entries = sortEntriesDesc([entry, ...state.entries]);
  state.selectedMonthKey = getEntryMonthKey(entry);
  persistEntries(state.entries);
  refreshAfterEntriesChange();
  showToast(translate("restored"));
}

function refreshAfterEntriesChange() {
  renderHome();

  if (state.sendSheetOpen) {
    if (!getSelectedMonthEntries().length) {
      closeSendSheet();
      return;
    }
    renderReport();
  }
}

function openSend() {
  if (!getSelectedMonthEntries().length) {
    showToast(translate("no_entries_report"));
    return;
  }

  renderReport();
  focusBeforeSheet = document.activeElement;
  state.sendSheetOpen = true;
  document.body.classList.add("sheet-open");
  dom.sheetBackdrop.setAttribute("aria-hidden", "false");
  dom.sendSheet.setAttribute("aria-hidden", "false");
  dom.sendSheet.inert = false;
  updateBackgroundInert();
  dom.closeSendButton.focus({ preventScroll: true });
}

function closeSendSheet() {
  if (!state.sendSheetOpen) {
    return;
  }

  state.sendSheetOpen = false;
  document.body.classList.remove("sheet-open");
  dom.sheetBackdrop.setAttribute("aria-hidden", "true");
  dom.sendSheet.setAttribute("aria-hidden", "true");
  dom.sendSheet.inert = true;
  updateBackgroundInert();

  if (focusBeforeSheet?.isConnected && !focusBeforeSheet.closest("[inert]")) {
    focusBeforeSheet.focus({ preventScroll: true });
  }
  focusBeforeSheet = null;
}

function cancelEntryFlow() {
  resetEntryFlowState();
  goTo(SCREEN_INDEX.home);
}

function renderReport() {
  const hasEntries = getSelectedMonthEntries().length > 0;
  dom.reportBox.textContent = buildReport();
  dom.copyReportButton.disabled = !hasEntries;
  dom.whatsappReportButton.disabled = !hasEntries;
}

function buildReport() {
  return formatFrenchReport({
    entries: getSelectedMonthEntries(),
    fullName: getStoredFullName(),
    monthKey: state.selectedMonthKey
  });
}

async function copyReport() {
  if (!getSelectedMonthEntries().length) {
    showToast(translate("no_entries_report"));
    return;
  }

  const copied = await copyText(buildReport());
  showToast(translate(copied ? "copied" : "copy_failed"));
}

function openWhatsAppReport() {
  if (!getSelectedMonthEntries().length) {
    showToast(translate("no_entries_report"));
    return;
  }

  window.location.href = `https://wa.me/?text=${encodeURIComponent(buildReport())}`;
}

function showToast(message, action = null) {
  dom.toastText.textContent = message;
  toastActionHandler = action ? action.onClick : null;
  dom.toastAction.hidden = !action;
  dom.toastAction.textContent = action ? action.label : "";
  dom.toast.classList.toggle("has-action", Boolean(action));
  dom.toast.classList.add("show");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, action ? 6000 : 1400);
}

function hideToast() {
  dom.toast.classList.remove("show");
  toastActionHandler = null;
}

function runToastAction() {
  const handler = toastActionHandler;
  window.clearTimeout(toastTimer);
  hideToast();
  if (handler) {
    handler();
  }
}

function shakeElement(element) {
  element.classList.remove("shake");
  void element.offsetWidth;
  element.classList.add("shake");
}

function updateHomeNameDisplay() {
  dom.homeNameText.textContent = getStoredFullName();
}

function openNameOverlay() {
  const { firstName, lastName } = getStoredNameParts();
  dom.firstName.value = firstName;
  dom.lastName.value = lastName;
  updateLanguageButtons();
  dom.nameOverlay.style.display = "flex";
  setNameOverlayOpen(true);

  requestAnimationFrame(() => {
    dom.nameOverlay.classList.remove("hide");
  });

  window.setTimeout(() => dom.firstName.focus(), 150);
}

function submitName() {
  const firstName = dom.firstName.value.trim();
  const lastName = dom.lastName.value.trim();

  if (!firstName && !lastName) {
    shakeElement(dom.firstName);
    dom.firstName.focus();
    return;
  }

  setStoredName(firstName, lastName);
  updateHomeNameDisplay();
  dom.nameOverlay.classList.add("hide");
  setNameOverlayOpen(false);
  dom.screenNodes[state.currentScreen].focus({ preventScroll: true });

  window.setTimeout(() => {
    dom.nameOverlay.style.display = "none";
  }, 400);
}

function handleNameSubmitKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    submitName();
  }
}

function handleViewportChange() {
  window.clearTimeout(viewportTimer);
  viewportTimer = window.setTimeout(() => {
    renderHome();
    if (state.sendSheetOpen) {
      renderReport();
    }
  }, 80);
}

async function exportBackup() {
  const { firstName, lastName } = getStoredNameParts();
  const backup = buildBackup({ entries: state.entries, firstName, lastName });
  const fileName = `heures-sup-${getLocalDateInputValue(new Date())}.json`;
  const file = new File([JSON.stringify(backup, null, 2)], fileName, { type: "application/json" });

  // On phones the share sheet lets the user save to Files or Drive, or send
  // the file to themselves; desktop browsers get a plain download.
  const preferShare = window.matchMedia("(pointer: coarse)").matches;
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      showToast(translate("exported"));
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.warn("Share failed, falling back to download:", error);
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(translate("exported"));
}

function startImport() {
  dom.importFileInput.value = "";
  dom.importFileInput.click();
}

async function importBackup() {
  const file = dom.importFileInput.files?.[0];
  if (!file) {
    return;
  }

  let backup;
  try {
    backup = parseBackup(await file.text());
  } catch (error) {
    console.warn("Could not import backup:", error);
    showToast(translate("import_error"));
    return;
  }

  const { entries, addedCount } = mergeEntries(state.entries, backup.entries);
  if (addedCount) {
    if (!window.confirm(translateCount("import_confirm", addedCount))) {
      return;
    }
    state.entries = sortEntriesDesc(entries);
    persistEntries(state.entries);
    requestPersistentStorage();
    renderHome();
    showToast(translateCount("imported", addedCount));
  } else {
    showToast(translate("import_nothing_new"));
  }

  // Restoring on a new device: fill in the name too if none was typed yet.
  if (!dom.firstName.value.trim() && !dom.lastName.value.trim()) {
    dom.firstName.value = backup.firstName;
    dom.lastName.value = backup.lastName;
  }
}
