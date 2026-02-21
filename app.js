const RAMADAN_DAYS = 30;
const STORAGE_KEY = "shere_ramadan_ul_moazam_history_v2";
const LEGACY_STORAGE_KEY = "shere_ramadan_ul_moazam_state_v1";
const STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  QAZA: "qaza",
};

const currentHijriDate = getCurrentHijriDate();
const currentHijriYear = currentHijriDate.year;

const state = {
  selectedYear: currentHijriYear,
  history: loadHistory(),
};

const calendarGrid = document.getElementById("calendarGrid");
const timeline = document.getElementById("crescentTimeline");
const timelineFill = document.getElementById("timelineFill");
const dayTemplate = document.getElementById("dayTemplate");

const statCompleted = document.getElementById("statCompleted");
const statStreak = document.getElementById("statStreak");
const statPercent = document.getElementById("statPercent");
const completedCount = document.getElementById("completedCount");
const percentBadge = document.getElementById("percentBadge");
const selectedYearText = document.getElementById("selectedYearText");
const yearBadge = document.getElementById("yearBadge");
const calendarTitle = document.getElementById("calendarTitle");
const prevYearBtn = document.getElementById("prevYearBtn");
const nextYearBtn = document.getElementById("nextYearBtn");
const yearSwitcher = document.getElementById("yearSwitcher");

init();

function init() {
  renderTimeline();
  renderCalendar();
  bindYearControls();
  ensureYearData(state.selectedYear);
  refreshUI(true);
}

function getCurrentHijriDate() {
  try {
    const formatter = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(new Date());
    const year = Number.parseInt(parts.find((part) => part.type === "year")?.value, 10);
    const month = Number.parseInt(parts.find((part) => part.type === "month")?.value, 10);
    const day = Number.parseInt(parts.find((part) => part.type === "day")?.value, 10);

    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { year, month, day };
    }
  } catch {
    // Fallback below.
  }
  return { year: 1447, month: 9, day: 1 };
}

function createEmptyDays() {
  return Array.from({ length: RAMADAN_DAYS }, () => STATUS.PENDING);
}

function normalizeDays(days) {
  if (!Array.isArray(days) || days.length !== RAMADAN_DAYS) {
    return createEmptyDays();
  }
  return days.map((value) => (Object.values(STATUS).includes(value) ? value : STATUS.PENDING));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return migrateLegacyHistory({});
    }

    const normalized = {};
    Object.entries(parsed).forEach(([year, days]) => {
      normalized[year] = normalizeDays(days);
    });
    return migrateLegacyHistory(normalized);
  } catch {
    return migrateLegacyHistory({});
  }
}

function migrateLegacyHistory(history) {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return history;
    }
    const legacy = JSON.parse(legacyRaw);
    if (!history[String(currentHijriYear)] && Array.isArray(legacy) && legacy.length === RAMADAN_DAYS) {
      history[String(currentHijriYear)] = normalizeDays(legacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return history;
  } catch {
    return history;
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function ensureYearData(year) {
  const key = String(year);
  if (!state.history[key]) {
    state.history[key] = createEmptyDays();
    saveHistory();
  }
}

function getSelectedYearDays() {
  ensureYearData(state.selectedYear);
  return state.history[String(state.selectedYear)];
}

function renderTimeline() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < RAMADAN_DAYS; i += 1) {
    const item = document.createElement("div");
    item.className = "crescent";
    item.role = "listitem";
    item.setAttribute("aria-label", `Day ${i + 1}`);
    item.dataset.day = String(i + 1);
    frag.append(item);
  }
  timeline.innerHTML = "";
  timeline.append(frag);
}

function renderCalendar() {
  const frag = document.createDocumentFragment();

  for (let i = 0; i < RAMADAN_DAYS; i += 1) {
    const node = dayTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(i);

    const dayLabel = node.querySelector(".day-label");
    dayLabel.textContent = `Day ${i + 1}`;

    attachDayGestureHandlers(node, i);
    frag.append(node);
  }

  calendarGrid.innerHTML = "";
  calendarGrid.append(frag);
}

function bindYearControls() {
  prevYearBtn.addEventListener("click", () => shiftYear(-1));
  nextYearBtn.addEventListener("click", () => shiftYear(1));

  let startX = 0;
  let startY = 0;

  yearSwitcher.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
  });

  yearSwitcher.addEventListener("pointerup", (event) => {
    const dx = event.clientX - startX;
    const dy = Math.abs(event.clientY - startY);
    if (Math.abs(dx) > 48 && dy < 26) {
      shiftYear(dx < 0 ? 1 : -1);
    }
  });
}

function shiftYear(delta) {
  state.selectedYear += delta;
  ensureYearData(state.selectedYear);
  refreshUI(true);
}

function attachDayGestureHandlers(element, index) {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let moved = false;
  let longPressTimer = null;

  const clearTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  element.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    startTime = Date.now();
    moved = false;

    longPressTimer = setTimeout(() => {
      setDayStatus(index, STATUS.QAZA, true);
      moved = true;
    }, 560);
  });

  element.addEventListener("pointermove", (event) => {
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx > 8 || dy > 8) {
      moved = true;
    }
    if (dy > 16) {
      clearTimer();
    }
  });

  element.addEventListener("pointerup", (event) => {
    const dx = event.clientX - startX;
    const absDx = Math.abs(dx);
    const elapsed = Date.now() - startTime;
    clearTimer();

    if (absDx > 48) {
      setDayStatus(index, dx > 0 ? STATUS.COMPLETED : STATUS.PENDING, true);
      return;
    }

    if (!moved && elapsed < 540) {
      const current = getSelectedYearDays()[index];
      const next = current === STATUS.COMPLETED ? STATUS.PENDING : STATUS.COMPLETED;
      setDayStatus(index, next, true);
    }
  });

  element.addEventListener("pointercancel", clearTimer);
  element.addEventListener("pointerleave", clearTimer);
}

function setDayStatus(index, status, animate) {
  const days = getSelectedYearDays();
  days[index] = status;
  saveHistory();
  refreshUI(animate, index);
}

function refreshUI(animate = false, changedIndex = null) {
  const days = getSelectedYearDays();
  const completed = days.filter((s) => s === STATUS.COMPLETED).length;
  const percent = Math.round((completed / RAMADAN_DAYS) * 100);
  const streak = computeCurrentStreak(days);

  selectedYearText.textContent = `${state.selectedYear} AH`;
  calendarTitle.textContent = `Ramadan Tracker • ${state.selectedYear} AH`;

  const current = state.selectedYear === currentHijriYear;
  yearBadge.textContent = current ? "Current Year" : "Past Record";
  yearBadge.classList.toggle("past", !current);

  const dayCards = calendarGrid.querySelectorAll(".day-card");
  dayCards.forEach((card, i) => {
    const status = days[i];
    card.classList.remove(STATUS.PENDING, STATUS.COMPLETED, STATUS.QAZA, "pulse");
    card.classList.add(status);

    const statusLabel = card.querySelector(".day-status");
    statusLabel.textContent = status === STATUS.COMPLETED ? "Completed" : status === STATUS.QAZA ? "Qaza" : "Pending";
    card.setAttribute("aria-label", `Day ${i + 1}, ${statusLabel.textContent}`);

    if (animate && changedIndex === i) {
      card.classList.add("pulse");
    }
  });

  timeline.querySelectorAll(".crescent").forEach((item, i) => {
    item.classList.toggle("done", days[i] === STATUS.COMPLETED);
  });
  timelineFill.style.width = `${percent}%`;

  animateCount(statCompleted, completed);
  animateCount(statStreak, streak);
  statPercent.textContent = `${percent}%`;
  percentBadge.textContent = `${percent}%`;
  completedCount.textContent = String(completed);

  statPercent.classList.add("bump");
  setTimeout(() => statPercent.classList.remove("bump"), 220);
  applyAdaptiveTheme(percent);
}

function computeCurrentStreak(days) {
  let streak = 0;
  let endIndex = RAMADAN_DAYS - 1;

  // Pending means "not set yet", so trailing pending days should not break streak.
  while (endIndex >= 0 && days[endIndex] === STATUS.PENDING) {
    endIndex -= 1;
  }

  for (let i = endIndex; i >= 0; i -= 1) {
    if (days[i] === STATUS.COMPLETED) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function animateCount(node, value) {
  if (node.textContent !== String(value)) {
    node.textContent = String(value);
    node.classList.add("bump");
    setTimeout(() => node.classList.remove("bump"), 220);
  }
}

function applyAdaptiveTheme(percent) {
  const t = percent / 100;
  const bgTopLight = 11 + 8 * t;
  const bgBottomLight = 8 + 6 * t;
  const accentHue = 39 - 7 * t;
  const accentLight = 62 + 8 * t;

  document.documentElement.style.setProperty("--bg-top", `hsl(220 50% ${bgTopLight.toFixed(1)}%)`);
  document.documentElement.style.setProperty("--bg-bottom", `hsl(232 45% ${bgBottomLight.toFixed(1)}%)`);
  document.documentElement.style.setProperty("--accent", `hsl(${accentHue.toFixed(1)} 84% ${accentLight.toFixed(1)}%)`);
  document.documentElement.style.setProperty("--accent-soft", `hsl(${accentHue.toFixed(1)} 84% 54% / 0.24)`);
}
