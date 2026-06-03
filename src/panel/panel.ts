import joplin from "api";

import { PANEL_ID } from "../core/constants";
import {
  daysInMonth,
  escapeHtml,
  formatDateId,
  pad2,
  weekOffset,
  weekdayLabels,
} from "../core/dateUtils";
import strings, { formatLocalizedString, getLocales } from "../core/localization";
import {
  NOTE_FIELDS,
  buildDayIdentifier,
  getExistingCalendarNoteMarkers,
  isCalendarNoteTitleForDate,
  isDeletedNote,
  resolveCalendarNoteDateId,
} from "../notes/notes";
import { getCalendarSettings } from "../settings/settings";
import type {
  CalendarMessage,
  CalendarSettings,
  CalendarTaskWithDate,
  NoteSummary,
} from "../core/types";

const CALENDAR_REFRESH_DEBOUNCE_MS = 250;
const NOTE_CHANGE_DELETE_EVENT = 3;
const SELECT_DATE_ACTION = "selectDate";
const COLLAPSED_OVERDUE_TASK_LIMIT = 4;

let panelHandle: string;
let currentYear: number;
let currentMonth: number;
let visibleCalendarNoteIds = new Set<string>();
let visibleCalendarNoteDatesById = new Map<string, string>();
let visibleNotesByDate: Map<string, NoteSummary[]> = new Map();
let visibleTasksByDate: Map<string, NoteSummary[]> = new Map();
let visibleOverdueTasks: CalendarTaskWithDate[] = [];
let showAllOverdueTasks = false;
let selectedDateId: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export async function setupPanel(
  onMessage: (message: CalendarMessage) => Promise<void>,
): Promise<void> {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDateId = getTodayDateId();

  panelHandle = await joplin.views.panels.create(PANEL_ID);

  await joplin.views.panels.addScript(panelHandle, "./panel/webview.css");
  await joplin.views.panels.addScript(panelHandle, "./panel/webview.js");
  await joplin.views.panels.setHtml(panelHandle, strings.loadingCalendar);

  await joplin.views.panels.onMessage(panelHandle, onMessage);
}

async function isPanelVisible(): Promise<boolean> {
  return joplin.views.panels.visible(panelHandle);
}

async function getActiveNote(noteId: string): Promise<NoteSummary | null> {
  try {
    const note = (await joplin.data.get(["notes", noteId], {
      fields: NOTE_FIELDS,
    })) as NoteSummary;

    if (isDeletedNote(note)) {
      return null;
    }

    return note;
  } catch {
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

function getTodayDateId(): string {
  const today = new Date();

  return formatDateId(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
}

function renderDayMarkerHtml(noteCount: number): string {
  if (noteCount <= 0) {
    return "";
  }

  return '<span class="dot"></span>';
}

function buildDayButtonTitle(dayIdentifier: string): string {
  return formatLocalizedString(strings.createDateNoteTitle, {
    title: dayIdentifier,
  });
}

function isTaskCompleted(task: NoteSummary): boolean {
  return Boolean(task.todo_completed && task.todo_completed > 0);
}

function stripDayIdentifierFromTitle(
  title: string,
  dateId: string,
  settings: CalendarSettings,
): string {
  const dayIdentifier = buildDayIdentifier(dateId, settings);
  const stripped = title
    .slice(dayIdentifier.length)
    .replace(/^\s*[-–—:]\s*/, "")
    .trim();

  return stripped || title;
}

function isSameLocalDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function formatTaskAlarm(alarmTime: number): string {
  const alarmDate = new Date(alarmTime);
  const now = new Date();
  const time = `${pad2(alarmDate.getHours())}:${pad2(alarmDate.getMinutes())}`;

  if (isSameLocalDay(alarmDate, now)) {
    return time;
  }

  const date = `${pad2(alarmDate.getDate())}.${pad2(alarmDate.getMonth() + 1)}`;

  if (alarmDate.getFullYear() === now.getFullYear()) {
    return `${date} ${time}`;
  }

  return `${date}.${alarmDate.getFullYear()} ${time}`;
}

function renderTaskAlarmHtml(task: NoteSummary, completed: boolean): string {
  if (!task.todo_due || task.todo_due <= 0) {
    return "";
  }

  const overdue = !completed && task.todo_due < Date.now();
  const classes = ["task-alarm", overdue ? "overdue" : ""]
    .filter(Boolean)
    .join(" ");
  const label = formatTaskAlarm(task.todo_due);

  return `<span class="${classes}" title="${escapeHtml(label)}">🔔 ${escapeHtml(label)}</span>`;
}

function renderTaskItemHtml(
  task: NoteSummary,
  title: string,
  datePrefix = "",
): string {
  const completed = isTaskCompleted(task);
  const alarmHtml = renderTaskAlarmHtml(task, completed);
  const visibleTitle = datePrefix ? `${datePrefix} ${title}` : title;

  return `<li class="day-task ${completed ? "completed" : ""}">
    <input
      class="task-checkbox"
      type="checkbox"
      data-action="toggleTask"
      data-note-id="${escapeHtml(task.id)}"
      data-completed="${completed ? "true" : "false"}"
      title="${escapeHtml(task.title)}"
      ${completed ? "checked" : ""}
    />
    <button
      class="task-title"
      data-action="openNote"
      data-note-id="${escapeHtml(task.id)}"
      title="${escapeHtml(task.title)}"
    >${escapeHtml(visibleTitle)}</button>
    ${alarmHtml}
  </li>`;
}

function renderTasksSectionHtml(
  dateId: string,
  tasks: readonly NoteSummary[],
  settings: CalendarSettings,
): string {
  const heading = formatLocalizedString(strings.selectedTasksLabel, {
    date: buildDayIdentifier(dateId, settings),
  });

  const items = tasks.length === 0
    ? `<div class="selected-day-empty">${escapeHtml(strings.noTasksForDayLabel)}</div>`
    : `<ul class="selected-day-list">${tasks
        .map((task) =>
          renderTaskItemHtml(
            task,
            stripDayIdentifierFromTitle(task.title, dateId, settings),
          ),
        )
        .join("")}</ul>`;

  return `
    <section class="day-section day-tasks">
      <div class="selected-day-header">${escapeHtml(heading)}</div>
      ${items}
      <button class="create-note-button" data-action="createTask" data-date="${escapeHtml(dateId)}">
        ${escapeHtml(strings.createTaskButtonLabel)}
      </button>
    </section>
  `;
}

function renderNotesSectionHtml(
  dateId: string,
  notes: readonly NoteSummary[],
  settings: CalendarSettings,
): string {
  const heading = formatLocalizedString(strings.selectedNotesLabel, {
    date: buildDayIdentifier(dateId, settings),
  });

  const items = notes.length === 0
    ? `<div class="selected-day-empty">${escapeHtml(strings.noNotesForDayLabel)}</div>`
    : `<ul class="selected-day-list">${notes
        .map(
          (note) => `<li><button
            class="day-note"
            data-action="openNote"
            data-note-id="${escapeHtml(note.id)}"
            title="${escapeHtml(note.title)}"
          >${escapeHtml(note.title)}</button></li>`,
        )
        .join("")}</ul>`;

  return `
    <section class="day-section day-notes">
      <div class="selected-day-header">${escapeHtml(heading)}</div>
      ${items}
      <button class="create-note-button" data-action="createNote" data-date="${escapeHtml(dateId)}">
        ${escapeHtml(strings.createNoteButtonLabel)}
      </button>
    </section>
  `;
}

function buildVisibleItemCountsByDate(): Map<string, number> {
  const counts = new Map<string, number>();

  for (const [date, notes] of visibleNotesByDate) {
    counts.set(date, notes.length);
  }

  for (const [date, tasks] of visibleTasksByDate) {
    counts.set(date, (counts.get(date) ?? 0) + tasks.length);
  }

  return counts;
}

function formatOverdueDatePrefix(dateId: string): string {
  const [year, month, day] = dateId.split("-");
  const currentYear = String(new Date().getFullYear());

  return year === currentYear ? `${day}.${month}` : `${day}.${month}.${year}`;
}

function renderOverdueTasksSectionHtml(
  overdueTasks: readonly CalendarTaskWithDate[],
  settings: CalendarSettings,
): string {
  if (overdueTasks.length === 0) {
    return "";
  }

  const visibleTasks = showAllOverdueTasks
    ? overdueTasks
    : overdueTasks.slice(0, COLLAPSED_OVERDUE_TASK_LIMIT);
  const heading = formatLocalizedString(strings.overdueTasksLabel, {
    count: overdueTasks.length,
  });
  const toggleLabel = showAllOverdueTasks
    ? strings.hideOverdueTasksLabel
    : strings.showAllOverdueTasksLabel;

  return `
    <section class="overdue-tasks day-section">
      <div class="selected-day-header overdue-header">${escapeHtml(heading)}</div>
      <ul class="selected-day-list overdue-task-list">
        ${visibleTasks
          .map(({ task, dateId }) =>
            renderTaskItemHtml(
              task,
              stripDayIdentifierFromTitle(task.title, dateId, settings),
              formatOverdueDatePrefix(dateId),
            ),
          )
          .join("")}
      </ul>
      ${overdueTasks.length > COLLAPSED_OVERDUE_TASK_LIMIT
        ? `<button class="overdue-toggle" data-action="toggleOverdueTasks">${escapeHtml(toggleLabel)}</button>`
        : ""}
    </section>
  `;
}

function renderSelectedDaySectionHtml(
  dateId: string,
  tasks: readonly NoteSummary[],
  notes: readonly NoteSummary[],
  settings: CalendarSettings,
): string {
  return `
    <div class="selected-day">
      ${renderTasksSectionHtml(dateId, tasks, settings)}
      ${renderNotesSectionHtml(dateId, notes, settings)}
    </div>
  `;
}

function renderCalendarHtml(
  year: number,
  month: number,
  noteCountsByDate: Map<string, number>,
  notesByDate: Map<string, NoteSummary[]>,
  tasksByDate: Map<string, NoteSummary[]>,
  overdueTasks: readonly CalendarTaskWithDate[],
  settings: CalendarSettings,
): string {
  const todayId = getTodayDateId();
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
    const dayIdentifier = buildDayIdentifier(dateId, settings);
    const noteCount = noteCountsByDate.get(dateId) ?? 0;
    const hasNote = noteCount > 0;
    const isToday = dateId === todayId;
    const isSelected = dateId === selectedDateId;

    const classes = [
      "day",
      hasNote ? "has-note" : "",
      isToday ? "today" : "",
      isSelected ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const title = buildDayButtonTitle(dayIdentifier);
    const markerHtml = renderDayMarkerHtml(noteCount);

    cells.push(`
			<button
				class="${classes}"
				data-action="${SELECT_DATE_ACTION}"
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
			</div>

			<div class="weekdays">
				${weekdaysHtml}
			</div>

			<div class="calendar-grid">
				${cells.join("\n")}
			</div>

			${renderOverdueTasksSectionHtml(overdueTasks, settings)}

			${
              selectedDateId
                ? renderSelectedDaySectionHtml(
                    selectedDateId,
                    tasksByDate.get(selectedDateId) ?? [],
                    notesByDate.get(selectedDateId) ?? [],
                    settings,
                  )
                : ""
            }
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
  visibleNotesByDate = existingMarkers.notesByDate;
  visibleTasksByDate = existingMarkers.tasksByDate;
  visibleOverdueTasks = existingMarkers.overdueTasks;

  const html = renderCalendarHtml(
    currentYear,
    currentMonth,
    existingMarkers.noteCountsByDate,
    existingMarkers.notesByDate,
    existingMarkers.tasksByDate,
    existingMarkers.overdueTasks,
    settings,
  );

  await joplin.views.panels.setHtml(panelHandle, html);
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
  if (!selectedDateId) {
    selectedDateId = getTodayDateId();
  }

  await renderCalendar();
  await joplin.views.panels.show(panelHandle, true);
}

export async function toggleOverdueTasks(): Promise<void> {
  const settings = await getCalendarSettings();

  showAllOverdueTasks = !showAllOverdueTasks;

  const html = renderCalendarHtml(
    currentYear,
    currentMonth,
    buildVisibleItemCountsByDate(),
    visibleNotesByDate,
    visibleTasksByDate,
    visibleOverdueTasks,
    settings,
  );

  await joplin.views.panels.setHtml(panelHandle, html);
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
  selectedDateId = getTodayDateId();

  await renderCalendar();
}

export async function goToPrevMonth(): Promise<void> {
  currentMonth -= 1;

  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear -= 1;
  }

  selectedDateId = null;

  await renderCalendar();
}

export async function goToNextMonth(): Promise<void> {
  currentMonth += 1;

  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }

  selectedDateId = null;

  await renderCalendar();
}

export async function selectCalendarDate(dateId: string): Promise<void> {
  const settings = await getCalendarSettings();

  selectedDateId = dateId === selectedDateId ? null : dateId;

  const html = renderCalendarHtml(
    currentYear,
    currentMonth,
    buildVisibleItemCountsByDate(),
    visibleNotesByDate,
    visibleTasksByDate,
    visibleOverdueTasks,
    settings,
  );

  await joplin.views.panels.setHtml(panelHandle, html);
}
