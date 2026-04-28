import joplin from "api";

import { PANEL_ID } from "./constants";
import {
  daysInMonth,
  escapeHtml,
  formatDateId,
  weekOffset,
  weekdayLabels,
} from "./dateUtils";
import strings, { formatLocalizedString, getLocales } from "./localization";
import {
  buildNoteTitle,
  getExistingCalendarNoteMarkers,
  isCalendarNoteTitleForDate,
  isDeletedNote,
  resolveCalendarNoteDateId,
} from "./notes";
import { getCalendarSettings } from "./settings";
import type {
  CalendarMessage,
  CalendarSettings,
  NoteSummary,
} from "./types";

const CALENDAR_REFRESH_DEBOUNCE_MS = 250;
const NOTE_CHANGE_DELETE_EVENT = 3;

let panelHandle: string;
let currentYear: number;
let currentMonth: number; // январь = 0
let visibleCalendarNoteIds = new Set<string>();
let visibleCalendarNoteDatesById = new Map<string, string>();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export async function setupPanel(
  onMessage: (message: CalendarMessage) => Promise<void>,
): Promise<void> {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  panelHandle = await joplin.views.panels.create(PANEL_ID);

  await joplin.views.panels.addScript(panelHandle, "./webview.css");
  await joplin.views.panels.addScript(panelHandle, "./webview.js");
  await joplin.views.panels.setHtml(panelHandle, strings.loadingCalendar);

  await joplin.views.panels.onMessage(panelHandle, onMessage);
}

export async function hidePanel(): Promise<void> {
  await joplin.views.panels.hide(panelHandle);
}

async function isPanelVisible(): Promise<boolean> {
  return joplin.views.panels.visible(panelHandle);
}

async function getActiveNote(noteId: string): Promise<NoteSummary | null> {
  try {
    const note = (await joplin.data.get(["notes", noteId], {
      fields: ["id", "title", "parent_id", "deleted_time"],
    })) as NoteSummary;

    if (isDeletedNote(note)) {
      return null;
    }

    return note;
  } catch (error) {
    return null;
  }
}

function formatMonthLabel(year: number, month: number): string {
  const date = new Date(year, month, 1);
  const monthOptions: Intl.DateTimeFormatOptions = { month: "long" };
  const yearOptions: Intl.DateTimeFormatOptions = { year: "numeric" };

  try {
    const monthName = new Intl.DateTimeFormat(
      getLocales(),
      monthOptions,
    ).format(date);
    const yearLabel = new Intl.DateTimeFormat(getLocales(), yearOptions).format(
      date,
    );

    return `${monthName} ${yearLabel}`;
  } catch (error) {
    console.warn("Failed to format month with plugin locales.", error);

    const monthName = new Intl.DateTimeFormat(
      undefined,
      monthOptions,
    ).format(date);
    const yearLabel = new Intl.DateTimeFormat(undefined, yearOptions).format(
      date,
    );

    return `${monthName} ${yearLabel}`;
  }
}

function renderDayMarkerHtml(
  noteCount: number,
  settings: CalendarSettings,
): string {
  if (noteCount <= 0) {
    return "";
  }

  if (settings.noteMode === "multiple") {
    return `<span class="note-count">${noteCount}</span>`;
  }

  return '<span class="dot"></span>';
}

function buildDayButtonTitle(
  noteTitle: string,
  noteCount: number,
  settings: CalendarSettings,
): string {
  if (settings.noteMode === "multiple") {
    return formatLocalizedString(strings.createDateNoteTitle, {
      title: noteTitle,
      count: noteCount,
    });
  }

  return formatLocalizedString(
    noteCount > 0 ? strings.openNoteTitle : strings.createNoteTitle,
    { title: noteTitle },
  );
}

function renderCalendarHtml(
  year: number,
  month: number,
  noteCountsByDate: Map<string, number>,
  settings: CalendarSettings,
): string {
  const today = new Date();

  const todayId = formatDateId(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const monthLabel = formatMonthLabel(year, month);

  const firstDayOffset = weekOffset(
    new Date(year, month, 1),
    settings.weekStart,
  );
  const totalDays = daysInMonth(year, month);

  const weekdaysHtml = weekdayLabels(settings.weekStart)
    .map((label) => `<div>${escapeHtml(label)}</div>`)
    .join("\n");

  const cells: string[] = [];

  for (let i = 0; i < firstDayOffset; i++) {
    cells.push('<div class="day day-empty"></div>');
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateId = formatDateId(year, month, day);
    const noteTitle = buildNoteTitle(dateId, settings);
    const noteCount = noteCountsByDate.get(dateId) ?? 0;
    const hasNote = noteCount > 0;
    const isToday = dateId === todayId;

    const classes = ["day", hasNote ? "has-note" : "", isToday ? "today" : ""]
      .filter(Boolean)
      .join(" ");

    const title = buildDayButtonTitle(noteTitle, noteCount, settings);
    const markerHtml = renderDayMarkerHtml(noteCount, settings);

    cells.push(`
			<button
				class="${classes}"
				data-action="openDate"
				data-date="${escapeHtml(dateId)}"
				title="${escapeHtml(title)}"
			>
				<span class="day-number">${day}</span>
				${markerHtml}
			</button>
		`);
  }

  return `
		<div class="calendar-root">
			<div class="calendar-header">
				<button class="nav-button" data-action="prevMonth" title="${escapeHtml(strings.previousMonthTitle)}">‹</button>
				<div class="month-label">${escapeHtml(monthLabel)}</div>
				<button class="nav-button" data-action="nextMonth" title="${escapeHtml(strings.nextMonthTitle)}">›</button>
			</div>

			<div class="calendar-actions">
				<button class="today-button" data-action="today">${escapeHtml(strings.todayButtonLabel)}</button>
				<button class="refresh-button" data-action="refresh" title="${escapeHtml(strings.refreshCalendarTitle)}">${escapeHtml(strings.refreshCalendarButtonLabel)}</button>
			</div>

			<div class="weekdays">
				${weekdaysHtml}
			</div>

			<div class="calendar-grid">
				${cells.join("\n")}
			</div>
		</div>
	`;
}

export async function renderCalendar(): Promise<void> {
  const settings = await getCalendarSettings();

  const existingMarkers = await getExistingCalendarNoteMarkers(
    currentYear,
    currentMonth,
    settings,
  );
  visibleCalendarNoteIds = new Set(existingMarkers.datesByNoteId.keys());
  visibleCalendarNoteDatesById = new Map(existingMarkers.datesByNoteId);

  const html = renderCalendarHtml(
    currentYear,
    currentMonth,
    existingMarkers.noteCountsByDate,
    settings,
  );

  await joplin.views.panels.setHtml(panelHandle, html);
}

export async function refreshCalendarNow(): Promise<void> {
  if (!(await isPanelVisible())) {
    return;
  }

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  await renderCalendar();
}

export async function scheduleCalendarRefresh(): Promise<void> {
  if (!(await isPanelVisible())) {
    return;
  }

  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void renderCalendar();
  }, CALENDAR_REFRESH_DEBOUNCE_MS);
}

export async function isVisibleCalendarNote(noteId: string): Promise<boolean> {
  return (await isPanelVisible()) && visibleCalendarNoteIds.has(noteId);
}

export async function hasStaleVisibleCalendarNoteMarkers(): Promise<boolean> {
  if (!(await isPanelVisible()) || visibleCalendarNoteDatesById.size === 0) {
    return false;
  }

  const settings = await getCalendarSettings();

  for (const [noteId, dateId] of visibleCalendarNoteDatesById) {
    const note = await getActiveNote(noteId);

    if (!note) {
      return true;
    }

    if (!isCalendarNoteTitleForDate(note.title, dateId, settings)) {
      return true;
    }
  }

  return false;
}

export async function shouldRefreshCalendarForNoteChange(
  noteId: string,
  eventType: number,
): Promise<boolean> {
  if (!(await isPanelVisible())) {
    return false;
  }

  if (visibleCalendarNoteIds.has(noteId)) {
    return true;
  }

  if (eventType === NOTE_CHANGE_DELETE_EVENT) {
    return false;
  }

  const note = await getActiveNote(noteId);

  if (!note) {
    return false;
  }

  const settings = await getCalendarSettings();

  return Boolean(
    resolveCalendarNoteDateId(note.title, currentYear, currentMonth, settings),
  );
}

export async function showCalendarPanel(): Promise<void> {
  await renderCalendar();
  await joplin.views.panels.show(panelHandle, true);
}

export async function toggleCalendarPanel(): Promise<void> {
  const isVisible = await joplin.views.panels.visible(panelHandle);

  if (isVisible) {
    await joplin.views.panels.hide(panelHandle);
    return;
  }

  await showCalendarPanel();
}

export async function goToToday(): Promise<void> {
  const today = new Date();

  currentYear = today.getFullYear();
  currentMonth = today.getMonth();

  await renderCalendar();
}

export async function goToPrevMonth(): Promise<void> {
  currentMonth -= 1;

  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear -= 1;
  }

  await renderCalendar();
}

export async function goToNextMonth(): Promise<void> {
  currentMonth += 1;

  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }

  await renderCalendar();
}
