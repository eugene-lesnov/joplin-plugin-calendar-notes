import joplin from "api";

import {
  DEFAULT_NEW_NOTE_TITLE_FORMAT,
  PLUGIN_ID,
} from "../core/constants";
import {
  daysInMonth,
  formatDateByPattern,
  formatDateExpression,
  formatDateId,
  isoWeekNumber,
  pad2,
  parseDateId,
  quarterName,
  startOfLocalDayMs,
} from "../core/dateUtils";
import strings, { formatLocalizedString } from "../core/localization";
import {
  ensureNotebookPath,
  getNotebookTreeIds,
  resolveNotebookPath,
  splitNotebookPath,
} from "./notebooks";
import { getCalendarSettings } from "../settings/settings";
import type {
  CalendarSettings,
  CalendarTaskWithDate,
  ExistingCalendarNoteMarkers,
  NoteSummary,
} from "../core/types";

const NOTE_PAGE_LIMIT = 100;
export const NOTE_FIELDS = [
  "id",
  "title",
  "parent_id",
  "deleted_time",
  "is_todo",
  "todo_completed",
  "todo_due",
];

const DAY_IDENTIFIER_PLACEHOLDER_REPLACEMENT_PATTERN = /\{\{\s*dayIdentifier\s*\}\}/g;
const DATE_PLACEHOLDER_PATTERN = /\{\{\s*date:([^}]+)\s*\}\}/g;
const TEXT_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;
const TITLE_DUPLICATE_SUFFIX_SEPARATOR = " ";
const CALENDAR_PATH_PLACEHOLDER_PATTERN = /\{\{\s*(year|month|quarter|week)\s*\}\}/g;

export function buildDayIdentifier(
  dateId: string,
  settings: CalendarSettings,
): string {
  const date = parseDateId(dateId);
  return formatDateByPattern(date, settings.dayIdentifierFormat);
}

export function isDeletedNote(note: NoteSummary): boolean {
  return Boolean(note.deleted_time && note.deleted_time > 0);
}

function buildExpectedCalendarDayIdentifiers(
  year: number,
  month: number,
  settings: CalendarSettings,
): Map<string, string> {
  const expectedIdentifiers = new Map<string, string>();
  const count = daysInMonth(year, month);

  for (let day = 1; day <= count; day++) {
    const dateId = formatDateId(year, month, day);
    const identifier = buildDayIdentifier(dateId, settings);

    expectedIdentifiers.set(identifier, dateId);
  }

  return expectedIdentifiers;
}

export function isCalendarNoteTitleForDate(
  title: string,
  dateId: string,
  settings: CalendarSettings,
): boolean {
  const dayIdentifier = buildDayIdentifier(dateId, settings);

  return title.startsWith(dayIdentifier);
}

export function resolveCalendarNoteDateId(
  title: string,
  year: number,
  month: number,
  settings: CalendarSettings,
): string | null {
  const expectedIdentifiers = buildExpectedCalendarDayIdentifiers(year, month, settings);
  const candidates = [...expectedIdentifiers.entries()].sort(
    ([firstIdentifier], [secondIdentifier]) => secondIdentifier.length - firstIdentifier.length,
  );

  for (const [, dateId] of candidates) {
    if (isCalendarNoteTitleForDate(title, dateId, settings)) {
      return dateId;
    }
  }

  return null;
}

function resolveCalendarNoteDateIdInRange(
  title: string,
  startYear: number,
  endYear: number,
  settings: CalendarSettings,
): string | null {
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month++) {
      const dateId = resolveCalendarNoteDateId(title, year, month, settings);

      if (dateId) {
        return dateId;
      }
    }
  }

  return null;
}

async function findNoteByExactTitleInFolder(
  folderId: string,
  title: string,
): Promise<NoteSummary | null> {
  let page = 1;

  while (true) {
    const response = await joplin.data.get(["folders", folderId, "notes"], {
      fields: NOTE_FIELDS,
      limit: NOTE_PAGE_LIMIT,
      page,
    });

    const items = response.items as NoteSummary[];
    const found = items.find(
      (note) => note.title === title && !isDeletedNote(note),
    );

    if (found) {
      return found;
    }

    if (!response.has_more) {
      return null;
    }

    page += 1;
  }
}

async function findNoteByExactTitleAnywhere(
  title: string,
): Promise<NoteSummary | null> {
  let page = 1;

  while (true) {
    const response = await joplin.data.get(["notes"], {
      fields: NOTE_FIELDS,
      limit: NOTE_PAGE_LIMIT,
      page,
    });

    const items = response.items as NoteSummary[];
    const found = items.find(
      (note) => note.title === title && !isDeletedNote(note),
    );

    if (found) {
      return found;
    }

    if (!response.has_more) {
      return null;
    }

    page += 1;
  }
}

async function getNoteBody(noteId: string): Promise<string> {
  const note = (await joplin.data.get(["notes", noteId], {
    fields: ["body"],
  })) as { body?: string | null };

  return note.body ?? "";
}

async function findNoteByJoplinPath(path: string): Promise<NoteSummary | null> {
  const segments = splitNotebookPath(path);

  if (segments.length === 0) {
    return null;
  }

  const noteTitle = segments[segments.length - 1];
  const notebookSegments = segments.slice(0, -1);

  if (notebookSegments.length === 0) {
    return findNoteByExactTitleAnywhere(noteTitle);
  }

  const notebook = await resolveNotebookPath(notebookSegments.join("/"));

  if (!notebook) {
    return null;
  }

  return findNoteByExactTitleInFolder(notebook.id, noteTitle);
}

async function readNoteTemplateNote(templatePath: string): Promise<string> {
  if (!templatePath) {
    return "";
  }

  const templateNote = await findNoteByJoplinPath(templatePath);

  if (!templateNote) {
    throw new Error(`Template note not found by path: ${templatePath}`);
  }

  return getNoteBody(templateNote.id);
}

function getDateReplacements(dateId: string): Record<string, string> {
  const date = parseDateId(dateId);
  const year = String(date.year);
  const shortYear = year.slice(-2);
  const month = date.month + 1;
  const day = date.day;

  return {
    date: dateId,
    isoDate: dateId,

    YYYY: year,
    yyyy: year,
    YY: shortYear,

    MM: pad2(month),
    mm: pad2(month),
    M: String(month),
    m: String(month),

    DD: pad2(day),
    dd: pad2(day),
    D: String(day),
    d: String(day),
  };
}

export function renderNoteTemplate(
  rawTemplate: string,
  dateId: string,
  title: string,
  createdAt = new Date(),
): string {
  if (!rawTemplate.trim()) {
    return "";
  }

  const date = parseDateId(dateId);

  let body = rawTemplate.replace(/\\n/g, "\n");

  body = body.replace(DATE_PLACEHOLDER_PATTERN, (_, pattern: string) => {
    return formatDateExpression(date, pattern.trim());
  });

  const replacements: Record<string, string> = {
    title,
    noteTitle: title,
    time: formatTime(createdAt),
    ...getDateReplacements(dateId),
  };

  body = body.replace(TEXT_PLACEHOLDER_PATTERN, (match, key: string) => {
    return replacements[key] ?? match;
  });

  return body;
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function renderNoteTitle(
  dateId: string,
  settings: CalendarSettings,
  createdAt = new Date(),
): string {
  const format = settings.newNoteTitleFormat || DEFAULT_NEW_NOTE_TITLE_FORMAT;
  const date = parseDateId(dateId);
  const dayIdentifier = buildDayIdentifier(dateId, settings);

  let title = format.replace(DAY_IDENTIFIER_PLACEHOLDER_REPLACEMENT_PATTERN, dayIdentifier);

  title = title.replace(DATE_PLACEHOLDER_PATTERN, (_, pattern: string) => {
    return formatDateExpression(date, pattern.trim());
  });

  const replacements: Record<string, string> = {
    title: dayIdentifier,
    noteTitle: dayIdentifier,
    dayIdentifier,
    time: formatTime(createdAt),
    ...getDateReplacements(dateId),
  };

  title = title.replace(TEXT_PLACEHOLDER_PATTERN, (match, key: string) => {
    return replacements[key] ?? match;
  });

  return title.trim() || dayIdentifier;
}

function renderCalendarNotesPathPattern(
  dateId: string,
  pattern: string,
): string {
  const date = parseDateId(dateId);
  const month = date.month + 1;
  const replacements: Record<string, string> = {
    year: String(date.year),
    month: pad2(month),
    quarter: quarterName(date.month),
    week: `W${pad2(isoWeekNumber(date))}`,
  };

  return pattern.replace(CALENDAR_PATH_PLACEHOLDER_PATTERN, (match, key: string) => {
    return replacements[key] ?? match;
  });
}

function buildCalendarNotesFolderPath(
  dateId: string,
  settings: CalendarSettings,
): string {
  const relativePath = renderCalendarNotesPathPattern(
    dateId,
    settings.calendarNotesPathPattern,
  );

  return splitNotebookPath([
    settings.calendarNotesPath,
    relativePath,
  ].join("/")).join("/");
}

async function getCalendarNotesFolderIdForCreate(
  dateId: string,
  settings: CalendarSettings,
): Promise<string | null> {
  const notebook = await ensureNotebookPath(
    buildCalendarNotesFolderPath(dateId, settings),
  );

  return notebook?.id ?? null;
}

async function findNoteByExactTitleInFolders(
  folderIds: ReadonlySet<string>,
  title: string,
): Promise<NoteSummary | null> {
  for (const folderId of folderIds) {
    const found = await findNoteByExactTitleInFolder(folderId, title);

    if (found) {
      return found;
    }
  }

  return null;
}

async function getCalendarNotebookTreeIds(
  settings: CalendarSettings,
): Promise<Set<string>> {
  return getNotebookTreeIds(settings.calendarNotesPath);
}

function isTodoNote(note: NoteSummary): boolean {
  return note.is_todo === 1;
}

function isTodoCompleted(note: NoteSummary): boolean {
  return Boolean(note.todo_completed && note.todo_completed > 0);
}

function appendItemForDate(
  itemsByDate: Map<string, NoteSummary[]>,
  dateId: string,
  note: NoteSummary,
): void {
  const existing = itemsByDate.get(dateId);

  if (existing) {
    existing.push(note);
    return;
  }

  itemsByDate.set(dateId, [note]);
}

function sortTasks(first: NoteSummary, second: NoteSummary): number {
  const firstCompleted = isTodoCompleted(first);
  const secondCompleted = isTodoCompleted(second);

  if (firstCompleted !== secondCompleted) {
    return firstCompleted ? 1 : -1;
  }

  return first.title.localeCompare(second.title);
}

export async function getExistingCalendarNoteMarkers(
  year: number,
  month: number,
  settings: CalendarSettings,
): Promise<ExistingCalendarNoteMarkers> {
  const datesByNoteId = new Map<string, string>();
  const notesByDate = new Map<string, NoteSummary[]>();
  const tasksByDate = new Map<string, NoteSummary[]>();
  const overdueTasks: CalendarTaskWithDate[] = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const todayId = formatDateId(currentYear, today.getMonth(), today.getDate());

  const folderIds = await getCalendarNotebookTreeIds(settings);

  for (const folderId of folderIds) {
    let page = 1;

    while (true) {
      const response = await joplin.data.get(["folders", folderId, "notes"], {
        fields: NOTE_FIELDS,
        limit: NOTE_PAGE_LIMIT,
        page,
      });

      const items = response.items as NoteSummary[];

      for (const note of items) {
        if (isDeletedNote(note)) {
          continue;
        }

        const dateId = resolveCalendarNoteDateId(
          note.title,
          year,
          month,
          settings,
        );
        const overdueDateId = isTodoNote(note) && !isTodoCompleted(note)
          ? resolveCalendarNoteDateIdInRange(note.title, currentYear - 10, currentYear, settings)
          : null;

        if (dateId) {
          datesByNoteId.set(note.id, dateId);

          if (isTodoNote(note)) {
            appendItemForDate(tasksByDate, dateId, note);
          } else {
            appendItemForDate(notesByDate, dateId, note);
          }
        }

        if (overdueDateId && overdueDateId < todayId) {
          overdueTasks.push({ task: note, dateId: overdueDateId });
        }
      }

      if (!response.has_more) {
        break;
      }

      page += 1;
    }
  }

  for (const notes of notesByDate.values()) {
    notes.sort((first, second) => first.title.localeCompare(second.title));
  }

  for (const tasks of tasksByDate.values()) {
    tasks.sort(sortTasks);
  }

  overdueTasks.sort((first, second) => {
    const dateComparison = first.dateId.localeCompare(second.dateId);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return first.task.title.localeCompare(second.task.title);
  });

  const noteCountsByDate = new Map<string, number>();
  for (const [dateId, notes] of notesByDate) {
    noteCountsByDate.set(dateId, notes.length);
  }

  for (const [dateId, tasks] of tasksByDate) {
    noteCountsByDate.set(dateId, (noteCountsByDate.get(dateId) ?? 0) + tasks.length);
  }

  return {
    datesByNoteId,
    noteCountsByDate,
    notesByDate,
    tasksByDate,
    overdueTasks,
  };
}

async function makeUniqueNoteTitle(
  baseTitle: string,
  folderIds: ReadonlySet<string>,
): Promise<string> {
  if (!(await findNoteByExactTitleInFolders(folderIds, baseTitle))) {
    return baseTitle;
  }

  let index = 2;

  while (true) {
    const title = `${baseTitle}${TITLE_DUPLICATE_SUFFIX_SEPARATOR}(${index})`;

    if (!(await findNoteByExactTitleInFolders(folderIds, title))) {
      return title;
    }

    index += 1;
  }
}

async function createCalendarNote(
  dateId: string,
  title: string,
  settings: CalendarSettings,
  createdAt: Date,
): Promise<NoteSummary | null> {
  const parentId = await getCalendarNotesFolderIdForCreate(dateId, settings);

  if (!parentId) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
    return null;
  }

  let rawTemplate = "";

  try {
    rawTemplate = await readNoteTemplateNote(settings.calendarNoteTemplatePath);
  } catch (error) {
    console.warn("Failed to read calendar note template.", error);
    await joplin.views.dialogs.showMessageBox(
      formatLocalizedString(strings.createCalendarNoteTemplateReadError, {
        path: settings.calendarNoteTemplatePath,
      }),
    );
    return null;
  }

  const body = renderNoteTemplate(rawTemplate, dateId, title, createdAt);
  const dayStart = startOfLocalDayMs(dateId);

  return joplin.data.post(["notes"], null, {
    title,
    body,
    parent_id: parentId,
    user_created_time: dayStart,
    user_updated_time: dayStart,
    source_application: PLUGIN_ID,
  }) as Promise<NoteSummary>;
}

async function createCalendarTask(
  dateId: string,
  title: string,
  settings: CalendarSettings,
): Promise<NoteSummary | null> {
  const parentId = await getCalendarNotesFolderIdForCreate(dateId, settings);

  if (!parentId) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
    return null;
  }

  const createdAt = new Date();
  let rawTemplate = "";

  try {
    rawTemplate = await readNoteTemplateNote(settings.calendarTaskTemplatePath);
  } catch (error) {
    console.warn("Failed to read calendar task template.", error);
    await joplin.views.dialogs.showMessageBox(
      formatLocalizedString(strings.createCalendarTaskTemplateReadError, {
        path: settings.calendarTaskTemplatePath,
      }),
    );
    return null;
  }

  const body = renderNoteTemplate(rawTemplate, dateId, title, createdAt);
  const dayStart = startOfLocalDayMs(dateId);

  return joplin.data.post(["notes"], null, {
    title,
    body,
    parent_id: parentId,
    is_todo: 1,
    todo_completed: 0,
    user_created_time: dayStart,
    user_updated_time: dayStart,
    source_application: PLUGIN_ID,
  }) as Promise<NoteSummary>;
}

export async function createCalendarNoteForDate(
  dateId: string,
  settings?: CalendarSettings,
): Promise<void> {
  const effectiveSettings = settings ?? (await getCalendarSettings());

  const createdAt = new Date();
  const baseTitle = renderNoteTitle(dateId, effectiveSettings, createdAt);
  const calendarFolderIds = await getCalendarNotebookTreeIds(effectiveSettings);
  const title = await makeUniqueNoteTitle(baseTitle, calendarFolderIds);
  const created = await createCalendarNote(dateId, title, effectiveSettings, createdAt);

  if (created) {
    await joplin.commands.execute("openNote", created.id);
  }
}

export async function createCalendarTaskForDate(
  dateId: string,
  settings?: CalendarSettings,
): Promise<void> {
  const effectiveSettings = settings ?? (await getCalendarSettings());
  const dayIdentifier = buildDayIdentifier(dateId, effectiveSettings);
  const calendarFolderIds = await getCalendarNotebookTreeIds(effectiveSettings);
  const baseTitle = `${dayIdentifier} - ${strings.newTaskDefaultTitle}`;
  const title = await makeUniqueNoteTitle(baseTitle, calendarFolderIds);
  const created = await createCalendarTask(dateId, title, effectiveSettings);

  if (created) {
    await joplin.commands.execute("openNote", created.id);
  }
}

export async function setCalendarTaskCompleted(
  noteId: string,
  completed: boolean,
): Promise<void> {
  await joplin.data.put(["notes", noteId], null, {
    todo_completed: completed ? Date.now() : 0,
  });
}
