import joplin from "api";

import { PANEL_ID } from "../core/constants";
import {
  daysInMonth,
  escapeHtml,
  formatDateId,
  getTodayDateId,
  pad2,
  weekOffset,
  weekdayLabels,
} from "../core/dateUtils";
import strings, {
  formatLocalizedString,
  getLocales,
  getRepeatLabel,
} from "../core/localization";
import { isMobilePlatform } from "../core/platform";
import {
  NOTE_LIST_FIELDS,
  buildDayIdentifier,
  compareCalendarNotesByTitle,
  getExistingCalendarNoteMarkers,
  getTaggedTasks,
  getTaggedTasksSignature,
  isCalendarNoteTitleForDate,
  isDeletedNote,
  resolveCalendarNoteDateId,
  sortTasks,
} from "../notes/notes";
import { getCalendarSettings } from "../settings/settings";
import type {
  CalendarMessage,
  CalendarSettings,
  CalendarTaskWithDate,
  NoteSummary,
  PanelHtmlMessage,
  PanelMessage,
  PatchVisibleNoteMessage,
  PatchVisibleNotesMessage,
  TaggedTaskGroup,
} from "../core/types";

const CALENDAR_REFRESH_DEBOUNCE_MS = 250;
const NOTE_CHANGE_DELETE_EVENT = 3;
const PANEL_ROOT_ID = "calendar-notes-root";
const SELECT_DATE_ACTION = "selectDate";

let panelHandle: string;
let currentYear: number;
let currentMonth: number;
let visibleCalendarNoteDatesById = new Map<string, string>();
let visibleNotesByDate: Map<string, NoteSummary[]> = new Map();
let visibleTasksByDate: Map<string, NoteSummary[]> = new Map();
let visibleOverdueTasks: CalendarTaskWithDate[] = [];
let showAllOverdueTasks = false;
let showTaggedTasks = false;
let visibleTaggedTasks: TaggedTaskGroup[] = [];
let lastTaggedTasksSignature: string | null = null;
const expandedTaggedTaskGroupIds = new Set<string>();
let selectedDateId: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight = false;
let refreshPending = false;
let renderSeq = 0;
let panelShellReady = false;
let taggedTasksPollTimer: ReturnType<typeof setTimeout> | null = null;
let taggedTasksPollInFlight = false;
let fastTaggedTasksPollingUntil = 0;
const TAGGED_TASKS_FAST_POLL_MS = 750;
const TAGGED_TASKS_DESKTOP_IDLE_POLL_MS = 2_500;
const TAGGED_TASKS_MOBILE_IDLE_POLL_MS = 15_000;
const TAGGED_TASKS_HIDDEN_POLL_MS = 30_000;
const TAGGED_TASKS_FAST_POLL_WINDOW_MS = 12_000;

export async function setupPanel(
  onMessage: (message: CalendarMessage) => Promise<PanelMessage | void>,
): Promise<void> {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDateId = getTodayDateId();

  panelHandle = await joplin.views.panels.create(PANEL_ID);

  await joplin.views.panels.addScript(panelHandle, "./panel/webview.css");
  await joplin.views.panels.addScript(panelHandle, "./panel/webview.js");
  await joplin.views.panels.setHtml(
    panelHandle,
    renderPanelShell(strings.loadingCalendar, await isMobilePlatform()),
  );

  await joplin.views.panels.onMessage(panelHandle, onMessage);

  scheduleTaggedTasksPoll(0);
}

function renderPanelShell(contentHtml: string, isMobile: boolean): string {
  const mobileAttribute = isMobile ? ' data-mobile="true"' : "";

  return `<div id="${PANEL_ROOT_ID}"${mobileAttribute}>${contentHtml}</div>`;
}

function makePanelHtmlMessage(html: string): PanelHtmlMessage {
  return {
    name: "setPanelHtml",
    html,
  };
}

async function updatePanelHtml(html: string): Promise<PanelHtmlMessage> {
  const message = makePanelHtmlMessage(html);

  if (!panelShellReady) {
    await joplin.views.panels.setHtml(
      panelHandle,
      renderPanelShell(html, await isMobilePlatform()),
    );
    panelShellReady = true;
    return message;
  }

  joplin.views.panels.postMessage(panelHandle, message);
  return message;
}

function postPanelMessage(message: PanelMessage): PanelMessage {
  joplin.views.panels.postMessage(panelHandle, message);
  return message;
}

async function isPanelVisible(): Promise<boolean> {
  return joplin.views.panels.visible(panelHandle);
}

async function getActiveNote(noteId: string): Promise<NoteSummary | null> {
  try {
    const note = (await joplin.data.get(["notes", noteId], {
      fields: NOTE_LIST_FIELDS,
    })) as NoteSummary;

    if (isDeletedNote(note)) {
      return null;
    }

    return note;
  } catch {
    return null;
  }
}

const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormat(
  locales: string[] | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locales ? locales.join(",") : ""}|${JSON.stringify(options)}`;
  let formatter = dateTimeFormatCache.get(key);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locales, options);
    dateTimeFormatCache.set(key, formatter);
  }

  return formatter;
}

function formatMonthLabel(year: number, month: number): string {
  const date = new Date(year, month, 1);
  const monthOptions: Intl.DateTimeFormatOptions = { month: "long" };
  const yearOptions: Intl.DateTimeFormatOptions = { year: "numeric" };

  try {
    const monthName = getDateTimeFormat(getLocales(), monthOptions).format(date);
    const yearLabel = getDateTimeFormat(getLocales(), yearOptions).format(date);

    return `${monthName} ${yearLabel}`;
  } catch (error) {
    console.warn("Failed to format month with plugin locales.", error);

    const monthName = getDateTimeFormat(undefined, monthOptions).format(date);
    const yearLabel = getDateTimeFormat(undefined, yearOptions).format(date);

    return `${monthName} ${yearLabel}`;
  }
}

function getTaskMarkerClass(tasks: NoteSummary[]): string | null {
  if (tasks.length <= 0) {
    return null;
  }

  return tasks.every(isTaskCompleted) ? "task-done" : "task-open";
}

function renderDayMarkerHtml(noteCount: number, taskMarkerClass: string | null): string {
  const markers = [
    noteCount > 0 ? '<span class="day-marker note-marker"></span>' : "",
    taskMarkerClass ? `<span class="day-marker ${taskMarkerClass}"></span>` : "",
  ].filter(Boolean);

  if (markers.length <= 0) {
    return "";
  }

  return `<span class="day-markers">${markers.join("")}</span>`;
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

function formatTaskAlarm(alarmTime: number, taskDateId: string): string {
  const alarmDate = new Date(alarmTime);
  const taskDate = new Date(`${taskDateId}T00:00:00`);
  const time = `${pad2(alarmDate.getHours())}:${pad2(alarmDate.getMinutes())}`;

  if (isSameLocalDay(alarmDate, taskDate)) {
    return time;
  }

  const date = `${pad2(alarmDate.getDate())}.${pad2(alarmDate.getMonth() + 1)}`;

  if (alarmDate.getFullYear() === taskDate.getFullYear()) {
    return `${date} ${time}`;
  }

  return `${date}.${alarmDate.getFullYear()} ${time}`;
}

function formatTaskDateLabel(dateId: string): string {
  const [year, month, day] = dateId.split("-");
  const currentYear = String(new Date().getFullYear());

  return year === currentYear ? `${day}.${month}` : `${day}.${month}.${year}`;
}

function renderTaskRepeatHtml(task: NoteSummary, completed: boolean): string {
  const repeat = task.metadata?.repeat;

  if (!repeat) {
    if (completed) {
      return "";
    }

    return `<span
      role="button"
      tabindex="0"
      class="task-repeat-button empty"
      data-action="setTaskRepeat"
      data-note-id="${escapeHtml(task.id)}"
      data-can-clear-repeat="false"
      title="${escapeHtml(strings.taskRepeatSetHint)}"
    ><span class="task-repeat-icon">↻</span></span>`;
  }

  const label = getRepeatLabel(repeat.frequency);
  const repeatTitle = formatLocalizedString(strings.taskRepeatMetaLabel, { repeat: label });

  if (completed) {
    return `<span
      class="task-repeat-label active"
      title="${escapeHtml(repeatTitle)}"
    ><span class="task-repeat-icon">↻</span><span class="task-repeat-text">${escapeHtml(label)}</span></span>`;
  }

  const title = `${repeatTitle}. ${strings.taskRepeatClearHint}`;

  return `<span
    role="button"
    tabindex="0"
    class="task-repeat-button active"
    data-action="setTaskRepeat"
    data-note-id="${escapeHtml(task.id)}"
    data-can-clear-repeat="true"
    title="${escapeHtml(title)}"
  ><span class="task-repeat-icon">↻</span><span class="task-repeat-text">${escapeHtml(label)}</span></span>`;
}

function renderTaskAlarmHtml(task: NoteSummary, completed: boolean, dateId: string): string {
  if (!task.todo_due || task.todo_due <= 0) {
    return "";
  }

  const overdue = !completed && task.todo_due < Date.now();
  const classes = ["task-alarm", overdue ? "overdue" : ""]
    .filter(Boolean)
    .join(" ");
  const label = formatTaskAlarm(task.todo_due, dateId);
  const title = formatLocalizedString(strings.taskAlarmTitleLabel, {
    alarm: label,
    date: formatTaskDateLabel(dateId),
  });

  return `<span class="${classes}" title="${escapeHtml(title)}">🔔 ${escapeHtml(label)}</span>`;
}

function renderTaskItemHtml(
  task: NoteSummary,
  title: string,
  dateId: string,
  datePrefix = "",
  showRepeat = true,
): string {
  const completed = isTaskCompleted(task);
  const repeat = showRepeat ? task.metadata?.repeat : undefined;
  const alarmHtml = renderTaskAlarmHtml(task, completed, dateId);
  const repeatHtml = showRepeat ? renderTaskRepeatHtml(task, completed) : "";
  const repeatMetaHtml = repeat
    ? `<span class="task-repeat-mobile-text">↻ ${escapeHtml(getRepeatLabel(repeat.frequency))}</span>`
    : "";
  const hasMeta = Boolean(repeatMetaHtml || alarmHtml);
  const inlineRepeatHtml = hasMeta && completed ? "" : repeatHtml;
  const metaHtml = hasMeta ? `<span class="task-meta">${repeatMetaHtml}${alarmHtml}</span>` : "";
  const visibleTitle = datePrefix ? `${datePrefix} ${title}` : title;

  return `<li class="day-task ${completed ? "completed" : ""} ${hasMeta ? "has-meta" : ""}">
    <input
      class="task-checkbox"
      type="checkbox"
      data-action="toggleTask"
      data-note-id="${escapeHtml(task.id)}"
      data-completed="${completed ? "true" : "false"}"
      title="${escapeHtml(task.title)}"
      ${completed ? "checked" : ""}
    />
    <span
      role="button"
      tabindex="0"
      class="task-title"
      data-action="openNote"
      data-note-id="${escapeHtml(task.id)}"
      title="${escapeHtml(task.title)}"
    >${escapeHtml(visibleTitle)}</span>
    ${inlineRepeatHtml}
    ${metaHtml}
  </li>`;
}

function renderTasksSectionHtml(
  dateId: string,
  tasks: readonly NoteSummary[],
  settings: CalendarSettings,
): string {
  const items = tasks.length === 0
    ? ""
    : `<ul class="selected-day-list">${tasks
        .map((task) =>
          renderTaskItemHtml(
            task,
            stripDayIdentifierFromTitle(task.title, dateId, settings),
            dateId,
          ),
        )
        .join("")}</ul>`;

  return `
    <section class="day-section day-tasks">
      <div class="section-header">
        <div class="section-title-action">
          <div class="selected-day-header">${escapeHtml(strings.tasksSectionLabel)}</div>
          <span
            role="button"
            tabindex="0"
            class="add-item-button"
            data-action="createTask"
            data-date="${escapeHtml(dateId)}"
            title="${escapeHtml(strings.createTaskButtonTitle)}"
            aria-label="${escapeHtml(strings.createTaskButtonTitle)}"
          >${escapeHtml(strings.createTaskButtonLabel)}</span>
        </div>
      </div>
      ${items}
    </section>
  `;
}

function renderNotesSectionHtml(
  dateId: string,
  notes: readonly NoteSummary[],
): string {
  const items = notes.length === 0
    ? ""
    : `<ul class="selected-day-list">${notes
        .map(
          (note) => `<li><span
            role="button"
            tabindex="0"
            class="day-note"
            data-action="openNote"
            data-note-id="${escapeHtml(note.id)}"
            title="${escapeHtml(note.title)}"
          >${escapeHtml(note.title)}</span></li>`,
        )
        .join("")}</ul>`;

  return `
    <section class="day-section day-notes">
      <div class="section-header">
        <div class="section-title-action">
          <div class="selected-day-header">${escapeHtml(strings.notesSectionLabel)}</div>
          <span
            role="button"
            tabindex="0"
            class="add-item-button"
            data-action="createNote"
            data-date="${escapeHtml(dateId)}"
            title="${escapeHtml(strings.createNoteButtonTitle)}"
            aria-label="${escapeHtml(strings.createNoteButtonTitle)}"
          >${escapeHtml(strings.createNoteButtonLabel)}</span>
        </div>
      </div>
      ${items}
    </section>
  `;
}

function buildVisibleNoteCountsByDate(): Map<string, number> {
  const counts = new Map<string, number>();

  for (const [date, notes] of visibleNotesByDate) {
    counts.set(date, notes.length);
  }

  return counts;
}

async function renderVisiblePanel(): Promise<PanelHtmlMessage> {
  const settings = await getCalendarSettings();

  const html = renderCalendarHtml(
    currentYear,
    currentMonth,
    buildVisibleNoteCountsByDate(),
    visibleNotesByDate,
    visibleTasksByDate,
    visibleOverdueTasks,
    visibleTaggedTasks,
    settings,
  );

  return updatePanelHtml(html);
}

function addVisibleCalendarItem(
  dateId: string,
  note: NoteSummary,
  target: Map<string, NoteSummary[]>,
  compare: (first: NoteSummary, second: NoteSummary) => number,
): void {
  const items = [...(target.get(dateId) ?? []), note].sort(compare);

  target.set(dateId, items);
  visibleCalendarNoteDatesById.set(note.id, dateId);
}

function renderOverdueTasksSectionHtml(
  overdueTasks: readonly CalendarTaskWithDate[],
  settings: CalendarSettings,
): string {
  if (overdueTasks.length === 0) {
    return "";
  }

  const heading = formatLocalizedString(strings.overdueTasksLabel, {
    count: overdueTasks.length,
  });
  const toggleClass = showAllOverdueTasks ? "expanded" : "collapsed";

  return `
    <section class="overdue-tasks day-section">
      <div class="overdue-summary">
        <div class="selected-day-header overdue-header">⚠ ${escapeHtml(heading)}</div>
        <span role="button" tabindex="0" class="overdue-toggle ${toggleClass}" data-action="toggleOverdueTasks" aria-label="${escapeHtml(heading)}"></span>
      </div>
      ${showAllOverdueTasks
        ? `<ul class="selected-day-list overdue-task-list">
            ${overdueTasks
              .map(({ task, dateId }) =>
                renderTaskItemHtml(
                  task,
                  stripDayIdentifierFromTitle(task.title, dateId, settings),
                  dateId,
                  formatTaskDateLabel(dateId),
                ),
              )
              .join("")}
          </ul>`
        : ""}
    </section>
  `;
}

function renderTaggedTasksSectionHtml(
  groups: readonly TaggedTaskGroup[],
): string {
  if (groups.length === 0) {
    return "";
  }

  const toggleClass = showTaggedTasks ? "expanded" : "collapsed";
  const sections = showTaggedTasks
    ? groups.map((group) => {
      const isVisible = expandedTaggedTaskGroupIds.has(group.tagId);
      const groupToggleClass = isVisible ? "expanded" : "collapsed";
      const items = isVisible
        ? group.tasks.map((task) =>
          renderTaskItemHtml(task, task.title, "", "", false),
        ).join("")
        : "";

      return `
        <div class="tag-group${isVisible ? " expanded" : ""}">
          <div class="tag-group-summary">
            <div class="tag-group-header">${escapeHtml(group.tagName)}</div>
            <span
              role="button"
              tabindex="0"
              class="tag-group-toggle ${groupToggleClass}"
              data-action="toggleTaggedTaskGroup"
              data-tag-id="${escapeHtml(group.tagId)}"
              aria-label="${escapeHtml(group.tagName)}"
            ></span>
          </div>
          ${isVisible ? `<ul class="selected-day-list">${items}</ul>` : ""}
        </div>
      `;
    }).join("")
    : "";

  return `
    <section class="tagged-tasks day-section">
      <div class="tagged-tasks-summary">
        <div class="selected-day-header">${escapeHtml(strings.taggedTasksSectionLabel)}</div>
        <span role="button" tabindex="0" class="tagged-tasks-toggle ${toggleClass}" data-action="toggleTaggedTasks" aria-label="${escapeHtml(strings.taggedTasksSectionLabel)}"></span>
      </div>
      ${sections}
    </section>
  `;
}

function renderSelectedDaySectionHtml(
  dateId: string,
  tasks: readonly NoteSummary[],
  notes: readonly NoteSummary[],
  settings: CalendarSettings,
): string {
  const title = formatLocalizedString(strings.selectedDayLabel, {
    date: buildDayIdentifier(dateId, settings),
  });

  return `
    <div class="selected-day">
      <div class="selected-day-title">${escapeHtml(title)}</div>
      ${renderTasksSectionHtml(dateId, tasks, settings)}
      ${renderNotesSectionHtml(dateId, notes)}
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
  taggedTasks: readonly TaggedTaskGroup[],
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
    const taskMarkerClass = getTaskMarkerClass(tasksByDate.get(dateId) ?? []);
    const hasTask = Boolean(taskMarkerClass);
    const isToday = dateId === todayId;
    const isSelected = dateId === selectedDateId;

    const classes = [
      "day",
      hasNote || hasTask ? "has-marker" : "",
      isToday ? "today" : "",
      isSelected ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const title = buildDayButtonTitle(dayIdentifier);
    const markerHtml = renderDayMarkerHtml(noteCount, taskMarkerClass);

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
				<button class="today-button" data-action="today" title="${escapeHtml(strings.todayButtonLabel)}">${escapeHtml(strings.todayButtonLabel)}</button>
				<button class="nav-button" data-action="nextMonth" title="${escapeHtml(strings.nextMonthTitle)}">›</button>
			</div>

			<div class="weekdays">
				${weekdaysHtml}
			</div>

			<div class="calendar-grid">
				${cells.join("\n")}
			</div>

			${renderOverdueTasksSectionHtml(overdueTasks, settings)}

			${renderTaggedTasksSectionHtml(taggedTasks)}

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

export async function renderCalendar(): Promise<PanelHtmlMessage | void> {
  const mySeq = ++renderSeq;
  const settings = await getCalendarSettings();
  const [existingMarkers, taggedTasks] = await Promise.all([
    getExistingCalendarNoteMarkers(currentYear, currentMonth, settings),
    getTaggedTasks(settings),
  ]);

  if (mySeq !== renderSeq) {
    return;
  }

  visibleCalendarNoteDatesById = new Map(existingMarkers.datesByNoteId);
  visibleNotesByDate = existingMarkers.notesByDate;
  visibleTasksByDate = existingMarkers.tasksByDate;
  visibleOverdueTasks = existingMarkers.overdueTasks;
  visibleTaggedTasks = taggedTasks.groups;
  pruneExpandedTaggedTaskGroups(visibleTaggedTasks);
  lastTaggedTasksSignature = buildTaggedTasksSignature(visibleTaggedTasks);

  const html = renderCalendarHtml(
    currentYear,
    currentMonth,
    existingMarkers.noteCountsByDate,
    existingMarkers.notesByDate,
    existingMarkers.tasksByDate,
    existingMarkers.overdueTasks,
    visibleTaggedTasks,
    settings,
  );

  return updatePanelHtml(html);
}

export async function refreshVisibleCalendar(): Promise<PanelHtmlMessage | void> {
  if (!(await isPanelVisible())) {
    return;
  }

  return renderCalendar();
}

function buildTaggedTasksSignature(groups: readonly TaggedTaskGroup[]): string {
  return groups
    .map((group) => {
      const tasks = group.tasks
        .map((task) => `${task.id}:${task.title}:${task.todo_completed ?? 0}`)
        .sort()
        .join("|");

      return `${group.tagId}:${group.tagName}#${tasks}`;
    })
    .join("~");
}

function pruneExpandedTaggedTaskGroups(groups: readonly TaggedTaskGroup[]): void {
  const visibleGroupIds = new Set(groups.map((group) => group.tagId));

  for (const groupId of expandedTaggedTaskGroupIds) {
    if (!visibleGroupIds.has(groupId)) {
      expandedTaggedTaskGroupIds.delete(groupId);
    }
  }
}

function getTaggedTasksPollInterval(isMobile: boolean): number {
  if (Date.now() < fastTaggedTasksPollingUntil) {
    return TAGGED_TASKS_FAST_POLL_MS;
  }

  return isMobile ? TAGGED_TASKS_MOBILE_IDLE_POLL_MS : TAGGED_TASKS_DESKTOP_IDLE_POLL_MS;
}

async function scheduleTaggedTasksPoll(delayMs?: number): Promise<void> {
  if (taggedTasksPollTimer) {
    clearTimeout(taggedTasksPollTimer);
  }

  const isMobile = await isMobilePlatform();
  const delay = delayMs ?? getTaggedTasksPollInterval(isMobile);

  taggedTasksPollTimer = setTimeout(() => {
    taggedTasksPollTimer = null;
    void pollTaggedTasks();
  }, delay);
}

export function activateFastTaggedTasksPolling(): void {
  fastTaggedTasksPollingUntil = Date.now() + TAGGED_TASKS_FAST_POLL_WINDOW_MS;
  void scheduleTaggedTasksPoll(0);
}

async function pollTaggedTasks(): Promise<void> {
  if (taggedTasksPollInFlight) {
    return;
  }

  taggedTasksPollInFlight = true;
  let nextPollDelay: number | undefined;

  try {
    if (!(await isPanelVisible())) {
      nextPollDelay = TAGGED_TASKS_HIDDEN_POLL_MS;
      return;
    }

    const settings = await getCalendarSettings();

    if (!settings.taggedTasksTags.trim()) {
      lastTaggedTasksSignature = "";
      return;
    }

    const signature = await getTaggedTasksSignature(settings);

    if (signature !== lastTaggedTasksSignature) {
      await renderCalendar();
    }
  } finally {
    taggedTasksPollInFlight = false;
    void scheduleTaggedTasksPoll(nextPollDelay);
  }
}

async function runCoalescedRefresh(): Promise<void> {
  if (refreshInFlight) {
    refreshPending = true;
    return;
  }

  refreshInFlight = true;
  try {
    do {
      refreshPending = false;
      await renderCalendar();
    } while (refreshPending);
  } finally {
    refreshInFlight = false;
  }
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
    void runCoalescedRefresh();
  }, CALENDAR_REFRESH_DEBOUNCE_MS);
}

function findVisibleNoteInCache(noteId: string, dateId: string): NoteSummary | null {
  const note = visibleNotesByDate.get(dateId)?.find((item) => item.id === noteId);
  const task = visibleTasksByDate.get(dateId)?.find((item) => item.id === noteId);
  const overdueTask = visibleOverdueTasks.find((item) => item.task.id === noteId)?.task;

  return note ?? task ?? overdueTask ?? null;
}

function canPatchVisibleNote(previous: NoteSummary, next: NoteSummary): boolean {
  return previous.is_todo === next.is_todo
    && previous.parent_id === next.parent_id
    && previous.todo_completed === next.todo_completed
    && previous.todo_due === next.todo_due;
}

function updateVisibleNoteCache(note: NoteSummary, dateId: string): void {
  const updateItems = (items: NoteSummary[]) =>
    items.map((item) => item.id === note.id ? { ...item, ...note } : item);

  visibleNotesByDate.set(dateId, updateItems(visibleNotesByDate.get(dateId) ?? []));
  visibleTasksByDate.set(dateId, updateItems(visibleTasksByDate.get(dateId) ?? []));
  visibleOverdueTasks = visibleOverdueTasks.map((item) =>
    item.task.id === note.id ? { ...item, task: { ...item.task, ...note } } : item,
  );
}

function makePatchVisibleNoteMessage(
  note: NoteSummary,
  dateId: string,
  settings: CalendarSettings,
): PatchVisibleNoteMessage {
  const text = note.is_todo === 1
    ? stripDayIdentifierFromTitle(note.title, dateId, settings)
    : note.title;
  const overdueText = note.is_todo === 1
    ? `${formatTaskDateLabel(dateId)} ${text}`
    : text;

  return {
    name: "patchVisibleNote",
    id: note.id,
    title: note.title,
    text,
    overdueText,
  };
}

export async function patchVisibleCalendarNotes(
  noteIds: readonly string[],
): Promise<PanelMessage | void> {
  if (!(await isPanelVisible())) {
    return;
  }

  const settings = await getCalendarSettings();
  const patches: PatchVisibleNoteMessage[] = [];

  for (const noteId of noteIds) {
    const currentDateId = visibleCalendarNoteDatesById.get(noteId);

    if (!currentDateId) {
      continue;
    }

    const previous = findVisibleNoteInCache(noteId, currentDateId);
    const note = await getActiveNote(noteId);

    if (!previous || !note) {
      return renderCalendar();
    }

    const nextDateId = resolveCalendarNoteDateId(
      note.title,
      currentYear,
      currentMonth,
      settings,
    );

    if (nextDateId !== currentDateId || !canPatchVisibleNote(previous, note)) {
      return renderCalendar();
    }

    if (previous.title !== note.title) {
      updateVisibleNoteCache(note, currentDateId);
      patches.push(makePatchVisibleNoteMessage(note, currentDateId, settings));
    }
  }

  if (patches.length === 0) {
    return;
  }

  const message: PatchVisibleNotesMessage = {
    name: "patchVisibleNotes",
    patches,
  };

  return message;
}

export async function patchVisibleCalendarNoteChange(
  noteId: string,
  eventType: number,
): Promise<boolean> {
  if (!(await isPanelVisible())) {
    return true;
  }

  const currentDateId = visibleCalendarNoteDatesById.get(noteId);

  if (!currentDateId) {
    return false;
  }

  if (eventType === NOTE_CHANGE_DELETE_EVENT) {
    await renderCalendar();
    return true;
  }

  const note = await getActiveNote(noteId);

  if (!note) {
    await renderCalendar();
    return true;
  }

  const settings = await getCalendarSettings();
  const previous = findVisibleNoteInCache(noteId, currentDateId);
  const nextDateId = resolveCalendarNoteDateId(
    note.title,
    currentYear,
    currentMonth,
    settings,
  );

  if (!previous || nextDateId !== currentDateId || !canPatchVisibleNote(previous, note)) {
    await renderCalendar();
    return true;
  }

  updateVisibleNoteCache(note, currentDateId);
  postPanelMessage(makePatchVisibleNoteMessage(note, currentDateId, settings));
  return true;
}

function isVisibleTaggedTask(noteId: string): boolean {
  return visibleTaggedTasks.some((group) =>
    group.tasks.some((task) => task.id === noteId),
  );
}


export async function shouldRefreshCalendarForNoteChange(
  noteId: string,
  eventType: number,
): Promise<boolean> {
  if (!(await isPanelVisible())) {
    return false;
  }

  if (visibleCalendarNoteDatesById.has(noteId) || isVisibleTaggedTask(noteId)) {
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

export async function hasStaleVisibleCalendarNoteMarkers(
  noteIds: readonly string[],
): Promise<boolean> {
  if (!(await isPanelVisible())) {
    return false;
  }

  const relevantIds = noteIds.filter((id) => visibleCalendarNoteDatesById.has(id));

  if (relevantIds.length === 0) {
    return false;
  }

  const settings = await getCalendarSettings();
  const notes = await Promise.all(relevantIds.map((id) => getActiveNote(id)));

  return relevantIds.some((id, index) => {
    const note = notes[index];

    if (!note) {
      return true;
    }

    const dateId = visibleCalendarNoteDatesById.get(id)!;
    return !isCalendarNoteTitleForDate(note.title, dateId, settings);
  });
}

export async function showCalendarPanel(): Promise<void> {
  if (!selectedDateId) {
    selectedDateId = getTodayDateId();
  }

  await renderCalendar();
  await joplin.views.panels.show(panelHandle, true);
}

export async function addCreatedCalendarNote(
  dateId: string,
  note: NoteSummary | null,
): Promise<PanelHtmlMessage> {
  if (!note) {
    return renderVisiblePanel();
  }

  addVisibleCalendarItem(dateId, note, visibleNotesByDate, compareCalendarNotesByTitle);
  return renderVisiblePanel();
}

export async function addCreatedCalendarTask(
  dateId: string,
  task: NoteSummary | null,
): Promise<PanelHtmlMessage> {
  if (!task) {
    return renderVisiblePanel();
  }

  addVisibleCalendarItem(dateId, task, visibleTasksByDate, sortTasks);
  return renderVisiblePanel();
}

export async function toggleOverdueTasks(): Promise<PanelHtmlMessage> {
  showAllOverdueTasks = !showAllOverdueTasks;

  return renderVisiblePanel();
}

export async function toggleTaggedTasks(): Promise<PanelHtmlMessage> {
  showTaggedTasks = !showTaggedTasks;

  return renderVisiblePanel();
}

export async function toggleTaggedTaskGroup(tagId: string): Promise<PanelHtmlMessage> {
  if (!tagId) {
    return renderVisiblePanel();
  }

  if (expandedTaggedTaskGroupIds.has(tagId)) {
    expandedTaggedTaskGroupIds.delete(tagId);
  } else {
    expandedTaggedTaskGroupIds.add(tagId);
  }

  return renderVisiblePanel();
}

export async function toggleCalendarPanel(): Promise<void> {
  const isVisible = await joplin.views.panels.visible(panelHandle);

  if (isVisible) {
    await joplin.views.panels.hide(panelHandle);
    return;
  }

  await showCalendarPanel();
}

export async function goToToday(): Promise<PanelHtmlMessage | void> {
  const today = new Date();

  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  selectedDateId = getTodayDateId();

  return renderCalendar();
}

export async function goToPrevMonth(): Promise<PanelHtmlMessage | void> {
  currentMonth -= 1;

  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear -= 1;
  }

  selectedDateId = null;

  return renderCalendar();
}

export async function goToNextMonth(): Promise<PanelHtmlMessage | void> {
  currentMonth += 1;

  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }

  selectedDateId = null;

  return renderCalendar();
}

export async function selectCalendarDate(dateId: string): Promise<PanelHtmlMessage> {
  const settings = await getCalendarSettings();

  selectedDateId = dateId === selectedDateId ? null : dateId;

  const html = renderCalendarHtml(
    currentYear,
    currentMonth,
    buildVisibleNoteCountsByDate(),
    visibleNotesByDate,
    visibleTasksByDate,
    visibleOverdueTasks,
    visibleTaggedTasks,
    settings,
  );

  return updatePanelHtml(html);
}
