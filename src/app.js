import { TRANSLATIONS } from "./translations.js?v=20260422g";
import {
  getStoredFullName,
  getStoredNameParts,
  loadEntries,
  persistEntries,
  readLanguage,
  sanitizeEntry,
  setStoredName,
  writeLanguage
} from "./storage.js?v=20260422g";
import {
  copyText,
  formatDate,
  formatHours,
  getLocalDateInputValue,
  isValidDateValue,
  registerServiceWorker,
  sortEntriesAsc,
  sortEntriesDesc
} from "./utils.js?v=20260422g";

const SCREEN_INDEX = {
  home: 0,
  date: 1,
  hours: 2,
  note: 3,
  confirm: 4,
  send: 5
};

const state = {
  lang: readLanguage(TRANSLATIONS, "en"),
  entries: sortEntriesDesc(loadEntries()),
  selectedMonthKey: getCurrentMonthKey(),
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
  monthFilterWrap: document.getElementById("monthFilterWrap"),
  monthFilter: document.getElementById("monthFilter"),
  nameOverlay: document.getElementById("nameOverlay"),
  firstName: document.getElementById("firstName"),
  lastName: document.getElementById("lastName"),
  reportBox: document.getElementById("reportBox"),
  saveEntryButton: document.getElementById("saveEntryButton"),
  toast: document.getElementById("toast"),
  openSendButton: document.getElementById("openSendButton"),
  shareReportButton: document.getElementById("shareReportButton"),
  emailReportButton: document.getElementById("emailReportButton"),
  flowTitleNodes: Array.from(document.querySelectorAll("#screen-date .topbar-title, #screen-hours .topbar-title, #screen-note .topbar-title"))
};

let toastTimer = null;
const holdHintTimers = new WeakMap();

bindEvents();
initialize();

function createEmptyDraft() {
  return { date: "", hours: 0, note: "" };
}

function createSvgIcon(paths, viewBox = "0 0 16 16") {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  paths.forEach(({ tag, attributes }) => {
    const node = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
    svg.appendChild(node);
  });

  return svg;
}

function createEntryActionIcon(kind) {
  if (kind === "edit") {
    return createSvgIcon([
      { tag: "path", attributes: { d: "M11.5 2.5a2.121 2.121 0 0 1 3 3L5 15H1v-4L11.5 2.5z" } }
    ]);
  }

  return createSvgIcon([
    { tag: "polyline", attributes: { points: "3,4 13,4" } },
    { tag: "path", attributes: { d: "M5 4V2.8C5 2.358 5.358 2 5.8 2h4.4C10.642 2 11 2.358 11 2.8V4" } },
    { tag: "path", attributes: { d: "M4.2 4l.6 8.2c.05.74.666 1.31 1.408 1.31h3.584c.742 0 1.358-.57 1.408-1.31L11.8 4" } },
    { tag: "line", attributes: { x1: "6.6", y1: "6.6", x2: "6.6", y2: "11.2" } },
    { tag: "line", attributes: { x1: "9.4", y1: "6.6", x2: "9.4", y2: "11.2" } }
  ]);
}

function getCurrentMonthKey() {
  return getLocalDateInputValue(new Date()).slice(0, 7);
}

function getEntryMonthKey(entry) {
  return entry.date.slice(0, 7);
}

function getAvailableMonthKeys(entries = state.entries) {
  return Array.from(new Set(entries.map(getEntryMonthKey))).sort((left, right) => right.localeCompare(left));
}

function formatMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(translate("locale"), {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
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

  state.selectedMonthKey = availableMonthKeys[0];
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
  document.getElementById("continueFromDateButton").addEventListener("click", goToHours);
  document.getElementById("continueFromHoursButton").addEventListener("click", goToNote);
  document.getElementById("continueFromNoteButton").addEventListener("click", goToConfirm);
  document.getElementById("skipNoteButton").addEventListener("click", goToConfirm);
  document.getElementById("saveEntryButton").addEventListener("click", saveEntry);
  document.getElementById("cancelEntryButton").addEventListener("click", cancelEntryFlow);
  document.getElementById("shareReportButton").addEventListener("click", shareReport);
  document.getElementById("emailReportButton").addEventListener("click", emailReport);
  document.getElementById("submitNameButton").addEventListener("click", submitName);
  document.getElementById("decreaseHoursButton").addEventListener("click", () => changeHours(-1));
  document.getElementById("increaseHoursButton").addEventListener("click", () => changeHours(1));
  document.getElementById("backFromDateButton").addEventListener("click", goBack);
  document.getElementById("backFromHoursButton").addEventListener("click", goBack);
  document.getElementById("backFromNoteButton").addEventListener("click", goBack);
  document.getElementById("backFromConfirmButton").addEventListener("click", goBack);
  document.getElementById("backFromSendButton").addEventListener("click", () => goTo(SCREEN_INDEX.home));

  document.querySelectorAll("[data-minutes]").forEach((button) => {
    button.addEventListener("click", () => selectMinutes(Number(button.dataset.minutes)));
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => selectLanguage(button.dataset.lang));
  });

  dom.firstName.addEventListener("keydown", handleNameSubmitKey);
  dom.lastName.addEventListener("keydown", handleNameSubmitKey);
}

function bindHoldHint(element, translationKey) {
  element.title = translate(translationKey);
  element.dataset.holdKey = translationKey;

  let suppressClick = false;

  const cancelHold = () => {
    const timer = holdHintTimers.get(element);
    if (timer) {
      window.clearTimeout(timer);
      holdHintTimers.delete(element);
    }
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }

    cancelHold();
    const timer = window.setTimeout(() => {
      suppressClick = true;
      showToast(translate(translationKey));
    }, 420);
    holdHintTimers.set(element, timer);
  });

  ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach((eventName) => {
    element.addEventListener(eventName, cancelHold);
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
  syncSelectedMonth();
  applyLanguage();
  updateHomeNameDisplay();
  goTo(SCREEN_INDEX.home);
  registerServiceWorker();

  if (getStoredFullName()) {
    dom.nameOverlay.style.display = "none";
  } else {
    dom.nameOverlay.style.display = "flex";
    window.setTimeout(() => dom.firstName.focus(), 60);
  }
}

function translate(key) {
  return (TRANSLATIONS[state.lang] || TRANSLATIONS.en)[key] || key;
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

  if (state.currentScreen === SCREEN_INDEX.send) {
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
  state.lang = Object.prototype.hasOwnProperty.call(TRANSLATIONS, languageCode) ? languageCode : "en";
  writeLanguage(state.lang);
  applyLanguage();
}

function selectMonth(monthKey) {
  state.selectedMonthKey = monthKey;
  renderHome();

  if (state.currentScreen === SCREEN_INDEX.send) {
    renderReport();
  }
}

function goTo(index) {
  state.currentScreen = index;
  dom.slider.style.transform = `translateX(-${index * 100}vw)`;

  dom.screenNodes.forEach((screen, screenIndex) => {
    screen.setAttribute("aria-hidden", String(screenIndex !== index));
  });
}

function goBack() {
  if (state.currentScreen === SCREEN_INDEX.date) {
    resetEntryFlowState();
  }

  if (state.currentScreen > SCREEN_INDEX.home) {
    goTo(state.currentScreen - 1);
  }
}

function startFlow() {
  resetEntryFlowState();
  dom.inputDate.value = getLocalDateInputValue(new Date());
  dom.inputNote.value = "";
  selectMinutes(0);
  updatePickerUI();
  goTo(SCREEN_INDEX.date);
  window.setTimeout(() => dom.inputDate.focus(), 120);
}

function changeHours(step) {
  state.pickerHours = Math.max(0, Math.min(24, state.pickerHours + step));
  updatePickerUI();
}

function selectMinutes(minutes) {
  state.pickerMins = minutes;
  document.querySelectorAll("[data-minutes]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === minutes);
  });
  updatePickerUI();
}

function updatePickerUI() {
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
  state.pickerHours = Math.floor(totalMinutes / 60);
  state.pickerMins = totalMinutes % 60;
}

function openEditFlow(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) {
    return;
  }

  state.editingEntryId = entry.id;
  state.draft = {
    date: entry.date,
    hours: entry.hours,
    note: entry.note || ""
  };

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

  state.draft.date = selectedDate;
  goTo(SCREEN_INDEX.hours);
}

function goToNote() {
  const total = getPickerTotalHours();
  if (total <= 0) {
    shakeElement(dom.dispHours);
    return;
  }

  state.draft.hours = Number(total.toFixed(2));
  goTo(SCREEN_INDEX.note);
  window.setTimeout(() => dom.inputNote.focus(), 120);
}

function goToConfirm() {
  if (!state.draft.date || !state.draft.hours) {
    goTo(SCREEN_INDEX.date);
    return;
  }

  state.draft.note = dom.inputNote.value.trim().slice(0, 240);
  populateConfirmation();
  goTo(SCREEN_INDEX.confirm);
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
  persistEntries(state.entries);
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

  renderMonthFilter();

  if (!state.entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-msg";
    empty.textContent = translate("empty_msg");
    dom.entriesScroll.replaceChildren(empty);
    return;
  }

  if (!filteredEntries.length) {
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
  dom.monthFilter.replaceChildren();
  dom.monthFilterWrap.hidden = availableMonthKeys.length <= 1;

  if (availableMonthKeys.length <= 1) {
    return;
  }

  const fragment = document.createDocumentFragment();
  availableMonthKeys.forEach((monthKey) => {
    const button = document.createElement("button");
    button.className = "month-chip";
    button.type = "button";
    button.textContent = formatMonthKey(monthKey);
    button.setAttribute("aria-label", formatMonthKey(monthKey));
    button.classList.toggle("active", monthKey === state.selectedMonthKey);
    button.addEventListener("click", () => selectMonth(monthKey));
    fragment.appendChild(button);
  });
  dom.monthFilter.appendChild(fragment);
}

function createEntryRow(entry) {
  const row = document.createElement("div");
  row.className = "entry-row";

  const date = document.createElement("span");
  date.className = "entry-date";
  date.textContent = formatDate(translate("locale"), entry.date, {
    month: "short",
    day: "numeric",
    weekday: "short"
  });

  const hours = document.createElement("span");
  hours.className = "entry-hrs";
  hours.textContent = formatHours(entry.hours);

  const note = document.createElement("span");
  note.className = "entry-note";
  note.textContent = entry.note || "";

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const editButton = document.createElement("button");
  editButton.className = "entry-action-btn edit-entry-btn";
  editButton.type = "button";
  editButton.setAttribute("aria-label", translate("edit_entry"));
  editButton.appendChild(createEntryActionIcon("edit"));
  bindHoldHint(editButton, "edit_entry");
  editButton.addEventListener("click", () => openEditFlow(entry.id));

  const removeButton = document.createElement("button");
  removeButton.className = "entry-action-btn del-btn";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", translate("delete_entry"));
  removeButton.appendChild(createEntryActionIcon("delete"));
  bindHoldHint(removeButton, "delete_entry");
  removeButton.addEventListener("click", () => deleteEntry(entry.id));

  actions.append(editButton, removeButton);
  row.append(date, hours, note, actions);
  return row;
}

function deleteEntry(id) {
  if (!window.confirm(translate("delete_confirm"))) {
    return;
  }

  state.entries = state.entries.filter((entry) => entry.id !== id);
  persistEntries(state.entries);
  renderHome();

  if (state.currentScreen === SCREEN_INDEX.send) {
    renderReport();
  }
}

function openSend() {
  if (!getSelectedMonthEntries().length) {
    showToast(translate("no_entries_report"));
    return;
  }

  renderReport();
  goTo(SCREEN_INDEX.send);
}

function cancelEntryFlow() {
  resetEntryFlowState();
  goTo(SCREEN_INDEX.home);
}

function renderReport() {
  const hasEntries = getSelectedMonthEntries().length > 0;
  dom.reportBox.textContent = buildReport();
  dom.shareReportButton.disabled = !hasEntries;
  dom.emailReportButton.disabled = !hasEntries;
}

function buildReport() {
  const reportEntries = getSelectedMonthEntries();
  const total = reportEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const fullName = getStoredFullName();
  const monthYear = formatMonthKey(state.selectedMonthKey);

  const lines = [`${translate("report_header")} - ${monthYear}`];

  if (fullName) {
    lines.push(`${translate("report_from")}: ${fullName}`);
  }

  lines.push("");

  if (!reportEntries.length) {
    lines.push(translate("empty_msg"));
  } else {
    sortEntriesAsc(reportEntries).forEach((entry) => {
      const dateLabel = formatDate(translate("locale"), entry.date, {
        weekday: "short",
        month: "short",
        day: "numeric"
      });

      const parts = [dateLabel, formatHours(entry.hours)];
      if (entry.note) {
        parts.push(entry.note);
      }
      lines.push(parts.join(" | "));
    });
  }

  lines.push("");
  lines.push(`${translate("report_total")}: ${formatHours(total)}`);

  return lines.join("\n");
}

async function shareReport() {
  if (!getSelectedMonthEntries().length) {
    showToast(translate("no_entries_report"));
    return;
  }

  const report = buildReport();

  if (navigator.share) {
    try {
      await navigator.share({
        title: translate("report_title"),
        text: report
      });
      return;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
    }
  }

  const copied = await copyText(report);
  if (copied) {
    showToast(translate("copied"));
  }
}

function emailReport() {
  if (!getSelectedMonthEntries().length) {
    showToast(translate("no_entries_report"));
    return;
  }

  const monthYear = formatMonthKey(state.selectedMonthKey);
  const subject = `${translate("report_header")} - ${monthYear}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildReport())}`;
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    dom.toast.classList.remove("show");
  }, 1400);
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
