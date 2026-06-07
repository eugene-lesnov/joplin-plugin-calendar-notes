import joplin from "api";
import { ModelType } from "api/types";

import {
  DEFAULT_NEW_NOTE_TITLE_FORMAT,
  PLUGIN_ID,
} from "../core/constants";
import {
  daysInMonth,
  escapeHtml,
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
  getNextRepeatDateId,
  shiftAlarmToDate,
} from "../tasks/repeat";
import {
  TASK_METADATA_USER_DATA_KEY,
  createRepeatId,
  normalizeTaskMetadata,
} from "../tasks/taskMetadata";
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
  RepeatFrequency,
  TaskMetadata,
} from "../core/types";

const NOTE_PAGE_LIMIT = 100;
export const NOTE_FIELDS = [
  "id",
  "title",
  "parent_id",
  "body",
  "deleted_time",
  "created_time",
  "is_todo",
  "todo_completed",
  "todo_due",
];

const DAY_IDENTIFIER_PLACEHOLDER_REPLACEMENT_PATTERN = /\{\{\s*dayIdentifier\s*\}\}/g;
const DATE_PLACEHOLDER_PATTERN = /\{\{\s*date:([^}]+)\s*\}\}/g;
const TEXT_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;
const TITLE_DUPLICATE_SUFFIX_SEPARATOR = " ";
const CALENDAR_PATH_PLACEHOLDER_PATTERN = /\{\{\s*(year|month|quarter|week)\s*\}\}/g;
const REPEAT_DIALOG_ID = "calendarTaskRepeatDialog";

const REPEAT_NONE_VALUE = "none";
const REPEAT_FREQUENCIES: RepeatFrequency[] = ["daily", "weekly", "monthly", "yearly"];

let repeatDialogHandle: string | null = null;

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

async function readNoteTaskMetadata(noteId: string): Promise<TaskMetadata> {
  try {
    return normalizeTaskMetadata(
      await joplin.data.userDataGet<TaskMetadata>(
        ModelType.Note,
        noteId,
        TASK_METADATA_USER_DATA_KEY,
      ),
    );
  } catch {
    return {};
  }
}

async function writeNoteTaskMetadata(noteId: string, metadata: TaskMetadata): Promise<void> {
  const normalized = normalizeTaskMetadata(metadata);

  if (normalized.repeat) {
    await joplin.data.userDataSet(
      ModelType.Note,
      noteId,
      TASK_METADATA_USER_DATA_KEY,
      normalized,
    );
    return;
  }

  await joplin.data.userDataDelete(
    ModelType.Note,
    noteId,
    TASK_METADATA_USER_DATA_KEY,
  );
}

async function withTaskMetadata(note: NoteSummary): Promise<NoteSummary> {
  return {
    ...note,
    metadata: await readNoteTaskMetadata(note.id),
  };
}

async function getNoteWithBody(noteId: string): Promise<NoteSummary> {
  const note = (await joplin.data.get(["notes", noteId], {
    fields: NOTE_FIELDS,
  })) as NoteSummary;

  return withTaskMetadata({
    ...note,
    body: note.body ?? "",
  });
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

type NoteTemplateSource = {
  body: string;
  noteId: string | null;
};

async function readNoteTemplateSource(templatePath: string): Promise<NoteTemplateSource> {
  if (!templatePath) {
    return { body: "", noteId: null };
  }

  const templateNote = await findNoteByJoplinPath(templatePath);

  if (!templateNote) {
    throw new Error(`Template note not found by path: ${templatePath}`);
  }

  return {
    body: await getNoteBody(templateNote.id),
    noteId: templateNote.id,
  };
}

async function copyNoteTags(sourceNoteId: string | null, targetNoteId: string): Promise<void> {
  if (!sourceNoteId) {
    return;
  }

  let page = 1;

  while (true) {
    const response = await joplin.data.get(["notes", sourceNoteId, "tags"], {
      fields: ["id"],
      limit: NOTE_PAGE_LIMIT,
      page,
    });
    const tags = response.items as Array<{ id: string }>;

    for (const tag of tags) {
      try {
        await joplin.data.post(["tags", tag.id, "notes"], null, {
          id: targetNoteId,
        });
      } catch (error) {
        console.warn("Failed to copy template tag.", error);
      }
    }

    if (!response.has_more) {
      break;
    }

    page += 1;
  }
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

function buildNotebookFolderPath(rootPath: string, dateId: string, pattern: string): string {
  const relativePath = renderCalendarNotesPathPattern(dateId, pattern);

  return splitNotebookPath([
    rootPath,
    relativePath,
  ].join("/")).join("/");
}

async function getNotebookFolderIdForCreate(
  rootPath: string,
  dateId: string,
  pattern: string,
): Promise<string | null> {
  const notebook = await ensureNotebookPath(
    buildNotebookFolderPath(rootPath, dateId, pattern),
  );

  return notebook?.id ?? null;
}

async function getNotebookRootFolderIdForCreate(path: string): Promise<string | null> {
  const notebook = await ensureNotebookPath(path);

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

async function getNotebookNotesTreeIds(settings: CalendarSettings): Promise<Set<string>> {
  return getNotebookTreeIds(settings.notebookNotesPath);
}

async function getTasksTreeIds(settings: CalendarSettings): Promise<Set<string>> {
  const taskTreeIds = await getNotebookTreeIds(settings.tasksPath);
  const completedTaskTreeIds = await getNotebookTreeIds(settings.completedTasksPath);

  return new Set([...taskTreeIds, ...completedTaskTreeIds]);
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

function getTaskMetadata(note: NoteSummary): TaskMetadata {
  return note.metadata ?? {};
}

function hasTaskRepeat(note: NoteSummary): boolean {
  return Boolean(getTaskMetadata(note).repeat);
}

function sortTasks(first: NoteSummary, second: NoteSummary): number {
  const firstCompleted = isTodoCompleted(first);
  const secondCompleted = isTodoCompleted(second);

  if (firstCompleted !== secondCompleted) {
    return firstCompleted ? 1 : -1;
  }

  const createdTimeComparison = (first.created_time ?? 0) - (second.created_time ?? 0);

  if (createdTimeComparison !== 0) {
    return createdTimeComparison;
  }

  return first.title.localeCompare(second.title);
}

async function scanFolderNotes(
  folderId: string,
  onNote: (note: NoteSummary) => void | Promise<void>,
): Promise<void> {
  let page = 1;

  while (true) {
    const response = await joplin.data.get(["folders", folderId, "notes"], {
      fields: NOTE_FIELDS,
      limit: NOTE_PAGE_LIMIT,
      page,
    });

    const items = response.items as NoteSummary[];

    for (const note of items) {
      await onNote(note);
    }

    if (!response.has_more) {
      break;
    }

    page += 1;
  }
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

  const notesFolderIds = await getNotebookNotesTreeIds(settings);
  const tasksFolderIds = await getTasksTreeIds(settings);

  for (const folderId of notesFolderIds) {
    await scanFolderNotes(folderId, (note) => {
      if (isDeletedNote(note) || isTodoNote(note)) {
        return;
      }

      const dateId = resolveCalendarNoteDateId(
        note.title,
        year,
        month,
        settings,
      );

      if (dateId) {
        datesByNoteId.set(note.id, dateId);
        appendItemForDate(notesByDate, dateId, note);
      }
    });
  }

  for (const folderId of tasksFolderIds) {
    await scanFolderNotes(folderId, async (rawNote) => {
      if (isDeletedNote(rawNote) || !isTodoNote(rawNote)) {
        return;
      }

      const note = await withTaskMetadata(rawNote);
      const dateId = resolveCalendarNoteDateId(
        note.title,
        year,
        month,
        settings,
      );
      const overdueDateId = !isTodoCompleted(note)
        ? resolveCalendarNoteDateIdInRange(note.title, currentYear - 10, currentYear, settings)
        : null;

      if (dateId) {
        datesByNoteId.set(note.id, dateId);
        appendItemForDate(tasksByDate, dateId, note);
      }

      if (overdueDateId && overdueDateId < todayId) {
        overdueTasks.push({ task: note, dateId: overdueDateId });
      }
    });
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
  const parentId = await getNotebookFolderIdForCreate(
    settings.notebookNotesPath,
    dateId,
    settings.notebookNotesPathPattern,
  );

  if (!parentId) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
    return null;
  }

  let templateSource: NoteTemplateSource = { body: "", noteId: null };

  try {
    templateSource = await readNoteTemplateSource(settings.noteTemplatePath);
  } catch (error) {
    console.warn("Failed to read calendar note template.", error);
    await joplin.views.dialogs.showMessageBox(
      formatLocalizedString(strings.createCalendarNoteTemplateReadError, {
        path: settings.noteTemplatePath,
      }),
    );
    return null;
  }

  const body = renderNoteTemplate(templateSource.body, dateId, title, createdAt);
  const dayStart = startOfLocalDayMs(dateId);
  const created = await joplin.data.post(["notes"], null, {
    title,
    body,
    parent_id: parentId,
    user_created_time: dayStart,
    user_updated_time: dayStart,
    source_application: PLUGIN_ID,
  }) as NoteSummary;

  await copyNoteTags(templateSource.noteId, created.id);
  return created;
}

async function createCalendarTask(
  dateId: string,
  title: string,
  settings: CalendarSettings,
): Promise<NoteSummary | null> {
  const parentId = await getNotebookRootFolderIdForCreate(settings.tasksPath);

  if (!parentId) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
    return null;
  }

  const createdAt = new Date();
  let templateSource: NoteTemplateSource = { body: "", noteId: null };

  try {
    templateSource = await readNoteTemplateSource(settings.taskTemplatePath);
  } catch (error) {
    console.warn("Failed to read calendar task template.", error);
    await joplin.views.dialogs.showMessageBox(
      formatLocalizedString(strings.createCalendarTaskTemplateReadError, {
        path: settings.taskTemplatePath,
      }),
    );
    return null;
  }

  const body = renderNoteTemplate(templateSource.body, dateId, title, createdAt);
  const dayStart = startOfLocalDayMs(dateId);
  const created = await joplin.data.post(["notes"], null, {
    title,
    body,
    parent_id: parentId,
    is_todo: 1,
    todo_completed: 0,
    user_created_time: dayStart,
    user_updated_time: dayStart,
    source_application: PLUGIN_ID,
  }) as NoteSummary;

  await copyNoteTags(templateSource.noteId, created.id);
  return created;
}

export async function createCalendarNoteForDate(
  dateId: string,
  settings?: CalendarSettings,
): Promise<void> {
  const effectiveSettings = settings ?? (await getCalendarSettings());

  const createdAt = new Date();
  const baseTitle = renderNoteTitle(dateId, effectiveSettings, createdAt);
  const noteFolderIds = await getNotebookNotesTreeIds(effectiveSettings);
  const title = await makeUniqueNoteTitle(baseTitle, noteFolderIds);
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
  const taskFolderIds = await getTasksTreeIds(effectiveSettings);
  const baseTitle = `${dayIdentifier} - ${strings.newTaskDefaultTitle}`;
  const title = await makeUniqueNoteTitle(baseTitle, taskFolderIds);
  const created = await createCalendarTask(dateId, title, effectiveSettings);

  if (created) {
    await joplin.commands.execute("openNote", created.id);
  }
}

function getTodayDateId(): string {
  const today = new Date();
  return formatDateId(today.getFullYear(), today.getMonth(), today.getDate());
}


function getRepeatLabel(frequency: RepeatFrequency): string {
  if (frequency === "daily") {
    return strings.taskRepeatDailyLabel;
  }

  if (frequency === "weekly") {
    return strings.taskRepeatWeeklyLabel;
  }

  if (frequency === "monthly") {
    return strings.taskRepeatMonthlyLabel;
  }

  return strings.taskRepeatYearlyLabel;
}

function replaceTaskDateInTitle(
  title: string,
  dateId: string,
  nextDateId: string,
  settings: CalendarSettings,
): string {
  const currentIdentifier = buildDayIdentifier(dateId, settings);
  const nextIdentifier = buildDayIdentifier(nextDateId, settings);

  if (title.startsWith(currentIdentifier)) {
    return `${nextIdentifier}${title.slice(currentIdentifier.length)}`;
  }

  return `${nextIdentifier} - ${title}`;
}

type RepeatedTaskContent = {
  body: string;
  tagSourceNoteId: string | null;
};

async function renderRepeatedTaskContent(
  previousTask: NoteSummary,
  nextDateId: string,
  nextTitle: string,
  settings: CalendarSettings,
  createdAt: Date,
): Promise<RepeatedTaskContent> {
  if (!settings.taskTemplatePath) {
    return {
      body: previousTask.body ?? "",
      tagSourceNoteId: previousTask.id,
    };
  }

  try {
    const templateSource = await readNoteTemplateSource(settings.taskTemplatePath);
    return {
      body: renderNoteTemplate(templateSource.body, nextDateId, nextTitle, createdAt),
      tagSourceNoteId: templateSource.noteId,
    };
  } catch (error) {
    console.warn("Failed to read repeated task template. Copying previous body and tags.", error);
    return {
      body: previousTask.body ?? "",
      tagSourceNoteId: previousTask.id,
    };
  }
}

async function createNextRepeatedTask(
  task: NoteSummary,
  dateId: string,
  metadata: TaskMetadata,
  settings: CalendarSettings,
): Promise<void> {
  if (!metadata.repeat) {
    return;
  }

  const nextDateId = getNextRepeatDateId(dateId, metadata.repeat, getTodayDateId());
  const taskFolderIds = await getTasksTreeIds(settings);
  const nextTitle = replaceTaskDateInTitle(task.title, dateId, nextDateId, settings);

  const existing = await findRepeatedTaskByDate(
    taskFolderIds,
    metadata.repeat.id,
    nextDateId,
    settings,
  );

  if (existing) {
    return;
  }

  const parentId = await getNotebookRootFolderIdForCreate(settings.tasksPath);

  if (!parentId) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
    return;
  }

  const createdAt = new Date();
  const dayStart = startOfLocalDayMs(nextDateId);
  const nextAlarm = shiftAlarmToDate(task.todo_due, dateId, nextDateId);
  const content = await renderRepeatedTaskContent(
    task,
    nextDateId,
    nextTitle,
    settings,
    createdAt,
  );
  const payload: Record<string, unknown> = {
    title: nextTitle,
    body: content.body,
    parent_id: parentId,
    is_todo: 1,
    todo_completed: 0,
    user_created_time: dayStart,
    user_updated_time: dayStart,
    source_application: PLUGIN_ID,
  };

  if (nextAlarm !== undefined) {
    payload.todo_due = nextAlarm;
  }

  const created = await joplin.data.post(["notes"], null, payload) as NoteSummary;
  await copyNoteTags(content.tagSourceNoteId, created.id);
  await writeNoteTaskMetadata(created.id, metadata);
}


async function findRepeatedTaskByDate(
  folderIds: ReadonlySet<string>,
  repeatId: string,
  dateId: string,
  settings: CalendarSettings,
): Promise<NoteSummary | null> {
  for (const folderId of folderIds) {
    let page = 1;

    while (true) {
      const response = await joplin.data.get(["folders", folderId, "notes"], {
        fields: NOTE_FIELDS,
        limit: NOTE_PAGE_LIMIT,
        page,
      });

      const items = response.items as NoteSummary[];

      for (const rawNote of items) {
        const note = await withTaskMetadata(rawNote);
        const repeat = getTaskMetadata(note).repeat;

        if (
          !isDeletedNote(note)
          && isTodoNote(note)
          && repeat?.id === repeatId
          && isCalendarNoteTitleForDate(note.title, dateId, settings)
        ) {
          return note;
        }
      }

      if (!response.has_more) {
        break;
      }

      page += 1;
    }
  }

  return null;
}


async function getTaskCompletionFolderId(
  completed: boolean,
  settings: CalendarSettings,
  showError: boolean,
): Promise<string | null> {
  const targetPath = completed ? settings.completedTasksPath : settings.tasksPath;
  const parentId = await getNotebookRootFolderIdForCreate(targetPath);

  if (parentId) {
    return parentId;
  }

  if (showError) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
  } else {
    console.warn(`Failed to resolve task notebook: ${targetPath}`);
  }

  return null;
}

function resolveTaskDateId(task: NoteSummary, settings: CalendarSettings): string | null {
  return resolveCalendarNoteDateIdInRange(
    task.title,
    new Date().getFullYear() - 10,
    new Date().getFullYear() + 10,
    settings,
  );
}

async function createNextRepeatedTaskIfNeeded(
  task: NoteSummary,
  dateId: string,
  settings: CalendarSettings,
): Promise<void> {
  const metadata = getTaskMetadata(task);

  if (metadata.repeat) {
    await createNextRepeatedTask(task, dateId, metadata, settings);
  }
}

export async function setCalendarTaskCompleted(
  noteId: string,
  completed: boolean,
): Promise<void> {
  const task = await getNoteWithBody(noteId);
  const settings = await getCalendarSettings();
  const parentId = await getTaskCompletionFolderId(completed, settings, true);

  if (!parentId) {
    return;
  }

  await joplin.data.put(["notes", noteId], null, {
    parent_id: parentId,
    todo_completed: completed ? Date.now() : 0,
  });

  if (!completed) {
    return;
  }

  const dateId = resolveTaskDateId(task, settings);

  if (!dateId) {
    return;
  }

  await createNextRepeatedTaskIfNeeded(task, dateId, settings);
}

export async function syncCalendarTaskCompletionLocation(noteId: string): Promise<void> {
  const task = await getNoteWithBody(noteId);

  if (isDeletedNote(task) || !isTodoNote(task)) {
    return;
  }

  const settings = await getCalendarSettings();
  const dateId = resolveTaskDateId(task, settings);

  if (!dateId) {
    return;
  }

  const completed = isTodoCompleted(task);
  const parentId = await getTaskCompletionFolderId(completed, settings, false);

  if (!parentId) {
    return;
  }

  const shouldMoveTask = task.parent_id !== parentId;

  if (!shouldMoveTask) {
    return;
  }

  await joplin.data.put(["notes", noteId], null, {
    parent_id: parentId,
  });

  if (completed) {
    await createNextRepeatedTaskIfNeeded(task, dateId, settings);
  }
}

function renderRepeatDialogHtml(currentFrequency: RepeatFrequency | typeof REPEAT_NONE_VALUE): string {
  const option = (value: RepeatFrequency | typeof REPEAT_NONE_VALUE, label: string) => `
    <label style="display:block;margin:8px 0;">
      <input type="radio" name="repeat" value="${value}" ${currentFrequency === value ? "checked" : ""} />
      ${label}
    </label>
  `;

  return `
    <form name="repeatForm">
      <h2>${strings.taskRepeatDialogTitle}</h2>
      ${option(REPEAT_NONE_VALUE, strings.taskRepeatNoneLabel)}
      ${REPEAT_FREQUENCIES.map((frequency) => option(frequency, getRepeatLabel(frequency))).join("")}
    </form>
  `;
}

async function getRepeatDialogHandle(): Promise<string> {
  if (!repeatDialogHandle) {
    repeatDialogHandle = await joplin.views.dialogs.create(REPEAT_DIALOG_ID);
  }

  return repeatDialogHandle;
}

export async function clearTaskRepeat(noteId: string): Promise<void> {
  await writeNoteTaskMetadata(noteId, {});
}

export async function setTaskRepeat(noteId: string): Promise<void> {
  const task = await getNoteWithBody(noteId);
  const metadata = getTaskMetadata(task);
  const currentFrequency = metadata.repeat?.frequency ?? REPEAT_NONE_VALUE;
  const dialog = await getRepeatDialogHandle();

  await joplin.views.dialogs.setHtml(dialog, renderRepeatDialogHtml(currentFrequency));
  await joplin.views.dialogs.setButtons(dialog, [
    { id: "ok" },
    { id: "cancel" },
  ]);

  const result = await joplin.views.dialogs.open(dialog);

  if (result.id !== "ok") {
    return;
  }

  const selected = result.formData?.repeatForm?.repeat;
  const frequency = REPEAT_FREQUENCIES.find((item) => item === selected);
  const nextMetadata: TaskMetadata = frequency
    ? {
        repeat: {
          id: metadata.repeat?.id ?? createRepeatId(),
          frequency,
          interval: 1,
        },
      }
    : {};

  await writeNoteTaskMetadata(noteId, nextMetadata);
}
