import { TRANSLATIONS } from "./translations.js?v=20260422l";
import {
  getStoredFullName,
  getStoredNameParts,
  loadEntries,
  persistEntries,
  readLanguage,
  sanitizeEntry,
  setStoredName,
  writeLanguage
} from "./storage.js?v=20260422l";
import {
  copyText,
  formatDate,
  formatHours,
  getLocalDateInputValue,
  isValidDateValue,
  registerServiceWorker,
  sortEntriesAsc,
  sortEntriesDesc
} from "./utils.js?v=20260422l";

const SCREEN_INDEX = {
  home: 0,
  date: 1,
  hours: 2,
  note: 3,
  confirm: 4
};

const state = {
  lang: readLanguage(TRANSLATIONS, "en"),
  entries: sortEntriesDesc(loadEntries()),
  selectedMonthKey: getCurrentMonthKey(),
  expandedEntryId: null,
  sendSheetOpen: false,
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
  sheetBackdrop: document.getElementById("sheetBackdrop"),
  sendSheet: document.getElementById("sendSheet"),
  closeSendButton: document.getElementById("closeSendButton"),
  reportBox: document.getElementById("reportBox"),
  saveEntryButton: document.getElementById("saveEntryButton"),
  toast: document.getElementById("toast"),
  openSendButton: document.getElementById("openSendButton"),
  shareReportButton: document.getElementById("shareReportButton"),
  emailReportButton: document.getElementById("emailReportButton"),
  flowTitleNodes: Array.from(document.querySelectorAll("#screen-date .topbar-title, #screen-hours .topbar-title, #screen-note .topbar-title"))
};

let toastTimer = null;
const pressHintTimers = new WeakMap();
let viewportTimer = null;

bindEvents();
initialize();

function createEmptyDraft() {
  return { date: "", hours: 0, note: "" };
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
  return Array.from(new Set(entries.map(getEntryMonthKey))).sort((left, right) => right.localeCompare(left));
}

function formatMonthKey(monthKey, monthStyle = "long") {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(translate("locale"), {
    month: monthStyle,
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function formatEntryMeta(entry) {
  const parts = new Intl.DateTimeFormat(translate("locale"), {
    day: "numeric",
    month: "short"
  }).formatToParts(new Date(`${entry.date}T00:00:00`));

  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${formatHours(entry.hours)} ${day} ${month}`.trim();
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

function bindEntryGestures(surface, row, entry) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let shiftX = 0;
  let tracking = false;
  let swiping = false;
  let suppressClick = false;

  const resetSwipe = () => {
    shiftX = 0;
    tracking = false;
    swiping = false;
    pointerId = null;
    row.style.removeProperty("--swipe-shift");
    row.classList.remove("swiping-left", "swiping-right");
  };

  surface.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }

    tracking = true;
    swiping = false;
    suppressClick = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    shiftX = 0;
    surface.setPointerCapture(event.pointerId);
  });

  surface.addEventListener("pointermove", (event) => {
    if (!tracking || event.pointerId !== pointerId) {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (!swiping) {
      if (Math.abs(deltaY) > 14 && Math.abs(deltaY) > Math.abs(deltaX)) {
        if (pointerId !== null && surface.hasPointerCapture(pointerId)) {
          surface.releasePointerCapture(pointerId);
        }
        resetSwipe();
        return;
      }

      if (Math.abs(deltaX) < 12) {
        return;
      }

      swiping = true;
      suppressClick = true;
    }

    shiftX = Math.max(-90, Math.min(90, deltaX));
    row.style.setProperty("--swipe-shift", `${shiftX}px`);
    row.classList.toggle("swiping-right", shiftX > 12);
    row.classList.toggle("swiping-left", shiftX < -12);
  });

  const finishSwipe = (event) => {
    if (!tracking || event.pointerId !== pointerId) {
      return;
    }

    if (surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }

    const finalShift = shiftX;
    resetSwipe();

    if (finalShift >= 72) {
      suppressClick = true;
      openEditFlow(entry.id);
      return;
    }

    if (finalShift <= -72) {
      suppressClick = true;
      deleteEntry(entry.id);
    }
  };

  surface.addEventListener("pointerup", finishSwipe);
  surface.addEventListener("pointercancel", finishSwipe);

  surface.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
      return;
    }

    if (entry.note) {
      toggleExpandedEntry(entry.id);
    }
  });
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
  state.lang = Object.prototype.hasOwnProperty.call(TRANSLATIONS, languageCode) ? languageCode : "en";
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
  closeSendSheet();
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

  closeSendSheet();
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

function toggleExpandedEntry(id) {
  state.expandedEntryId = state.expandedEntryId === id ? null : id;
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
  row.dataset.swipeStart = translate("edit_entry");
  row.dataset.swipeEnd = translate("delete_entry");
  row.classList.toggle("expanded", state.expandedEntryId === entry.id);

  const swipeSurface = document.createElement("div");
  swipeSurface.className = "entry-swipe-surface";

  const main = document.createElement("button");
  main.className = "entry-main";
  main.type = "button";
  main.setAttribute("aria-expanded", String(Boolean(entry.note) && state.expandedEntryId === entry.id));
  main.setAttribute("aria-label", formatEntryMeta(entry));

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
    bindPressHint(row, () => entry.note);
  }

  meta.append(hours, date);
  main.append(meta, preview);
  swipeSurface.appendChild(main);
  row.appendChild(swipeSurface);

  if (entry.note) {
    const details = document.createElement("div");
    details.className = "entry-details";
    details.textContent = entry.note;
    row.appendChild(details);
  }

  bindEntryGestures(row, row, entry);
  return row;
}

function deleteEntry(id) {
  if (!window.confirm(translate("delete_confirm"))) {
    return;
  }

  state.entries = state.entries.filter((entry) => entry.id !== id);
  if (state.expandedEntryId === id) {
    state.expandedEntryId = null;
  }
  persistEntries(state.entries);
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
  state.sendSheetOpen = true;
  document.body.classList.add("sheet-open");
  dom.sheetBackdrop.setAttribute("aria-hidden", "false");
  dom.sendSheet.setAttribute("aria-hidden", "false");
}

function closeSendSheet() {
  if (!state.sendSheetOpen) {
    return;
  }

  state.sendSheetOpen = false;
  document.body.classList.remove("sheet-open");
  dom.sheetBackdrop.setAttribute("aria-hidden", "true");
  dom.sendSheet.setAttribute("aria-hidden", "true");
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

function handleViewportChange() {
  window.clearTimeout(viewportTimer);
  viewportTimer = window.setTimeout(() => {
    renderHome();
    if (state.sendSheetOpen) {
      renderReport();
    }
  }, 80);
}
