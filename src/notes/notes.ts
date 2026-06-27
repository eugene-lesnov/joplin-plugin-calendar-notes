import joplin from "api";
import { ModelType } from "api/types";

import {
  DEFAULT_NEW_NOTE_TITLE_FORMAT,
  PLUGIN_ID,
} from "../core/constants";
import {
  formatDateByPattern,
  formatDateExpression,
  formatDateId,
  formatTimeByPattern,
  getDateTokenValues,
  getTodayDateId,
  isoWeekNumber,
  pad2,
  parseDateFromTitle,
  parseDateId,
  quarterName,
  startOfLocalDayMs,
} from "../core/dateUtils";
import strings, {
  formatLocalizedString,
  getRepeatLabel,
} from "../core/localization";
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
  getNotebookTreeIdsForPaths,
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
  TaggedTaskGroup,
  TaggedTasksResult,
  TaskCompletionResult,
  TaskMetadata,
} from "../core/types";

const NOTE_PAGE_LIMIT = 100;
export const NOTE_LIST_FIELDS = [
  "id",
  "title",
  "parent_id",
  "deleted_time",
  "created_time",
  "is_todo",
  "todo_completed",
  "todo_due",
];
export const NOTE_FIELDS = [
  ...NOTE_LIST_FIELDS,
  "body",
];

const DAY_IDENTIFIER_PLACEHOLDER_REPLACEMENT_PATTERN = /\{\{\s*dayIdentifier\s*\}\}/g;
const DATE_PLACEHOLDER_PATTERN = /\{\{\s*date:([^}]+)\s*\}\}/g;
const TEXT_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;
const TITLE_DUPLICATE_SUFFIX_SEPARATOR = " ";
const CALENDAR_PATH_PLACEHOLDER_PATTERN = /\{\{\s*(year|month|quarter|week)\s*\}\}/g;
const REPEAT_DIALOG_ID = "calendarTaskRepeatDialog";
const REPEAT_FORM_NAME = "repeatForm";
const REPEAT_INPUT_NAME = "repeat";
const REPEAT_NONE_VALUE = "none";
const REPEAT_FREQUENCIES: RepeatFrequency[] = ["daily", "weekly", "monthly", "yearly"];

let repeatDialogHandle: string | null = null;
const createFolderIdCache = new Map<string, string | null>();
const rootFolderIdCache = new Map<string, string | null>();
const treeIdsByPath = new Map<string, Set<string>>();
const templateSourceCache = new Map<string, NoteTemplateSource>();
const taskMetadataCache = new Map<string, TaskMetadata>();

type MonthNoteMarkers = {
  datesByNoteId: Map<string, string>;
  noteCountsByDate: Map<string, number>;
  notesByDate: Map<string, NoteSummary[]>;
  tasksByDate?: Map<string, NoteSummary[]>;
};

const MARKERS_BY_MONTH_MAX = 36;
const markersByMonth = new Map<string, MonthNoteMarkers>();
const reservedTaskTitlesByDate = new Map<string, Set<string>>();
const processingTaskCompletionNoteIds = new Set<string>();

export function clearCalendarNoteCaches(): void {
  createFolderIdCache.clear();
  rootFolderIdCache.clear();
  treeIdsByPath.clear();
  templateSourceCache.clear();
  taskMetadataCache.clear();
  markersByMonth.clear();
  reservedTaskTitlesByDate.clear();
}

export function clearCalendarMonthMarkers(): void {
  markersByMonth.clear();
  reservedTaskTitlesByDate.clear();
}

export function hasCachedMonthMarkers(): boolean {
  return markersByMonth.size > 0;
}

export function invalidateCalendarMonthMarkers(year: number, month: number): void {
  const suffix = `\u0000${year}-${month}`;

  for (const key of markersByMonth.keys()) {
    if (key.endsWith(suffix)) {
      markersByMonth.delete(key);
    }
  }
}

export function invalidateCalendarMonthMarkersForNote(noteId: string): void {
  for (const [key, markers] of markersByMonth) {
    if (markers.datesByNoteId.has(noteId) || hasNoteInMarkers(markers.tasksByDate, noteId)) {
      markersByMonth.delete(key);
      reservedTaskTitlesByDate.delete(key);
    }
  }
}

type TagSummary = { id: string; title: string };

function parseTaggedTaskTagNames(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isTaggedTaskCandidate(note: NoteSummary, settings: CalendarSettings): boolean {
  return isTodoNote(note)
    && !note.todo_due
    && !isDeletedNote(note)
    && !isTodoCompleted(note)
    && !resolveAnyCalendarNoteDateId(note.title, settings);
}

function buildTagGroupId(tags: readonly TagSummary[]): string {
  return tags.map((tag) => tag.id).sort().join(",");
}

async function getRequestedTags(
  tagNames: ReadonlySet<string>,
): Promise<Map<string, TagSummary[]>> {
  const tagsByName = new Map<string, TagSummary[]>();
  let page = 1;

  while (true) {
    const response = await joplin.data.get(["tags"], {
      fields: ["id", "title"],
      limit: NOTE_PAGE_LIMIT,
      page,
    });

    for (const tag of response.items as TagSummary[]) {
      const tagName = tag.title.toLowerCase();

      if (tagNames.has(tagName)) {
        const tags = tagsByName.get(tagName) ?? [];
        tags.push(tag);
        tagsByName.set(tagName, tags);
      }
    }

    if (!response.has_more) {
      break;
    }

    page += 1;
  }

  return tagsByName;
}

async function getTaggedTodoNotes(
  tags: readonly TagSummary[],
  settings: CalendarSettings,
): Promise<NoteSummary[]> {
  const tasksById = new Map<string, NoteSummary>();

  for (const tag of tags) {
    let tagPage = 1;

    while (true) {
      const response = await joplin.data.get(["tags", tag.id, "notes"], {
        fields: NOTE_LIST_FIELDS,
        limit: NOTE_PAGE_LIMIT,
        page: tagPage,
      });

      for (const note of response.items as NoteSummary[]) {
        if (isTaggedTaskCandidate(note, settings)) {
          tasksById.set(note.id, note);
        }
      }

      if (!response.has_more) {
        break;
      }

      tagPage += 1;
    }
  }

  return [...tasksById.values()];
}

export async function getTaggedTasks(settings: CalendarSettings): Promise<TaggedTasksResult> {
  const tagNames = parseTaggedTaskTagNames(settings.taggedTasksTags);

  if (tagNames.size === 0) {
    return { groups: [] };
  }

  const tagsByName = await getRequestedTags(tagNames);
  const groups: TaggedTaskGroup[] = [];

  for (const tagName of tagNames) {
    const tags = tagsByName.get(tagName) ?? [];

    if (tags.length === 0) {
      continue;
    }

    const tasks = await getTaggedTodoNotes(tags, settings);

    if (tasks.length > 0) {
      await attachTaskMetadata(tasks);
      groups.push({
        tagId: buildTagGroupId(tags),
        tagName: tags[0].title,
        tasks: tasks.sort(sortTasks),
      });
    }
  }

  return { groups };
}


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

export function isCalendarNoteTitleForDate(
  title: string,
  dateId: string,
  settings: CalendarSettings,
): boolean {
  const dayIdentifier = buildDayIdentifier(dateId, settings);

  return title.startsWith(dayIdentifier);
}

export function resolveAnyCalendarNoteDateId(
  title: string,
  settings: CalendarSettings,
): string | null {
  const date = parseDateFromTitle(title, settings.dayIdentifierFormat);

  return date ? formatDateId(date.year, date.month, date.day) : null;
}

export function resolveCalendarNoteDateId(
  title: string,
  year: number,
  month: number,
  settings: CalendarSettings,
): string | null {
  const date = parseDateFromTitle(title, settings.dayIdentifierFormat);

  if (!date || date.year !== year || date.month !== month) {
    return null;
  }

  return formatDateId(date.year, date.month, date.day);
}

async function findNoteByExactTitleInFolder(
  folderId: string,
  title: string,
): Promise<NoteSummary | null> {
  let page = 1;

  while (true) {
    const response = await joplin.data.get(["folders", folderId, "notes"], {
      fields: NOTE_LIST_FIELDS,
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
      fields: NOTE_LIST_FIELDS,
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

export async function readNoteTaskMetadata(noteId: string, useCache = true): Promise<TaskMetadata> {
  const cached = taskMetadataCache.get(noteId);

  if (useCache && cached) {
    return cached;
  }

  let metadata: TaskMetadata;

  try {
    metadata = normalizeTaskMetadata(
      await joplin.data.userDataGet<TaskMetadata>(
        ModelType.Note,
        noteId,
        TASK_METADATA_USER_DATA_KEY,
      ),
    );
  } catch {
    metadata = {};
  }

  taskMetadataCache.set(noteId, metadata);
  return metadata;
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
    taskMetadataCache.set(noteId, normalized);
    return;
  }

  await joplin.data.userDataDelete(
    ModelType.Note,
    noteId,
    TASK_METADATA_USER_DATA_KEY,
  );
  taskMetadataCache.set(noteId, normalized);
}

async function withTaskMetadata(note: NoteSummary): Promise<NoteSummary> {
  return {
    ...note,
    metadata: await readNoteTaskMetadata(note.id),
  };
}

async function attachTaskMetadata(tasks: NoteSummary[]): Promise<void> {
  const metadataList = await Promise.all(
    tasks.map((task) => readNoteTaskMetadata(task.id)),
  );

  tasks.forEach((task, index) => {
    task.metadata = metadataList[index];
  });
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

  const cached = templateSourceCache.get(templatePath);

  if (cached) {
    return cached;
  }

  const templateNote = await findNoteByJoplinPath(templatePath);

  if (!templateNote) {
    throw new Error(`Template note not found by path: ${templatePath}`);
  }

  const source = {
    body: await getNoteBody(templateNote.id),
    noteId: templateNote.id,
  };

  templateSourceCache.set(templatePath, source);
  return source;
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

function getDateReplacements(
  dateId: string,
  dayIdentifier: string,
): Record<string, string> {
  const date = parseDateId(dateId);
  const replacements: Record<string, string> = {
    date: dayIdentifier,
  };

  for (const [token, value] of getDateTokenValues(date)) {
    replacements[token] = value;
  }

  return replacements;
}

export function renderNoteTemplate(
  rawTemplate: string,
  dateId: string,
  title: string,
  settings: CalendarSettings,
  createdAt = new Date(),
): string {
  if (!rawTemplate.trim()) {
    return "";
  }

  const date = parseDateId(dateId);
  const dayIdentifier = buildDayIdentifier(dateId, settings);

  let body = rawTemplate.replace(/\\n/g, "\n");

  body = body.replace(DATE_PLACEHOLDER_PATTERN, (_, pattern: string) => {
    return formatDateExpression(date, pattern.trim());
  });

  const replacements: Record<string, string> = {
    title,
    noteTitle: title,
    time: formatTimeByPattern(createdAt, settings.timeFormat),
    ...getDateReplacements(dateId, dayIdentifier),
  };

  body = body.replace(TEXT_PLACEHOLDER_PATTERN, (match, key: string) => {
    return replacements[key] ?? match;
  });

  return body;
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
    time: formatTimeByPattern(createdAt, settings.timeFormat),
    ...getDateReplacements(dateId, dayIdentifier),
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

function addFolderToCachedTree(path: string, folderId: string | null): void {
  const cached = treeIdsByPath.get(path);

  if (cached && folderId) {
    cached.add(folderId);
  }
}

async function getCachedTreeIds(path: string): Promise<Set<string>> {
  const cached = treeIdsByPath.get(path);

  if (cached) {
    return cached;
  }

  const treeIds = await getNotebookTreeIds(path);
  treeIdsByPath.set(path, treeIds);

  return treeIds;
}

async function ensureCachedTreeIds(paths: string[]): Promise<void> {
  const missing = paths.filter((path) => !treeIdsByPath.has(path));

  if (missing.length === 0) {
    return;
  }

  const resolved = await getNotebookTreeIdsForPaths(missing);

  for (const path of missing) {
    treeIdsByPath.set(path, resolved.get(path) ?? new Set());
  }
}

async function getNotebookFolderIdForCreate(
  rootPath: string,
  dateId: string,
  pattern: string,
): Promise<string | null> {
  const path = buildNotebookFolderPath(rootPath, dateId, pattern);

  if (createFolderIdCache.has(path)) {
    const folderId = createFolderIdCache.get(path) ?? null;
    addFolderToCachedTree(rootPath, folderId);
    return folderId;
  }

  const notebook = await ensureNotebookPath(path);
  const folderId = notebook?.id ?? null;
  createFolderIdCache.set(path, folderId);
  addFolderToCachedTree(rootPath, folderId);

  return folderId;
}

async function getNotebookRootFolderIdForCreate(path: string): Promise<string | null> {
  if (rootFolderIdCache.has(path)) {
    return rootFolderIdCache.get(path) ?? null;
  }

  const notebook = await ensureNotebookPath(path);
  const folderId = notebook?.id ?? null;
  rootFolderIdCache.set(path, folderId);
  addFolderToCachedTree(path, folderId);

  return folderId;
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
  return getCachedTreeIds(settings.notebookNotesPath);
}

async function getTasksTreeIds(settings: CalendarSettings): Promise<Set<string>> {
  const taskTreeIds = await getCachedTreeIds(settings.tasksPath);
  const completedTaskTreeIds = await getCachedTreeIds(settings.completedTasksPath);

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

export function compareCalendarNotesByTitle(
  first: NoteSummary,
  second: NoteSummary,
): number {
  return first.title.localeCompare(second.title);
}

export function sortTasks(first: NoteSummary, second: NoteSummary): number {
  const firstCompleted = isTodoCompleted(first);
  const secondCompleted = isTodoCompleted(second);

  if (firstCompleted !== secondCompleted) {
    return firstCompleted ? 1 : -1;
  }

  const firstAlarmTime = first.todo_due ?? 0;
  const secondAlarmTime = second.todo_due ?? 0;
  const firstHasAlarm = firstAlarmTime > 0;
  const secondHasAlarm = secondAlarmTime > 0;

  if (firstHasAlarm !== secondHasAlarm) {
    return firstHasAlarm ? -1 : 1;
  }

  if (firstHasAlarm && firstAlarmTime !== secondAlarmTime) {
    return firstAlarmTime - secondAlarmTime;
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
      fields: NOTE_LIST_FIELDS,
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

function buildMonthMarkersKey(
  year: number,
  month: number,
  settings: CalendarSettings,
): string {
  const signature = [
    settings.dayIdentifierFormat,
    settings.notebookNotesPath,
    settings.tasksPath,
    settings.completedTasksPath,
  ].join("\u0001");

  return `${signature}\u0000${year}-${month}`;
}

async function getMonthNoteMarkers(
  year: number,
  month: number,
  settings: CalendarSettings,
): Promise<MonthNoteMarkers> {
  const key = buildMonthMarkersKey(year, month, settings);
  const cached = markersByMonth.get(key);

  if (cached) {
    return cached;
  }

  const datesByNoteId = new Map<string, string>();
  const notesByDate = new Map<string, NoteSummary[]>();
  const notesFolderIds = await getNotebookNotesTreeIds(settings);

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

  for (const notes of notesByDate.values()) {
    notes.sort(compareCalendarNotesByTitle);
  }

  const noteCountsByDate = new Map<string, number>();
  for (const [dateId, notes] of notesByDate) {
    noteCountsByDate.set(dateId, notes.length);
  }

  const markers: MonthNoteMarkers = { datesByNoteId, noteCountsByDate, notesByDate };
  markersByMonth.set(key, markers);

  if (markersByMonth.size > MARKERS_BY_MONTH_MAX) {
    markersByMonth.delete(markersByMonth.keys().next().value);
  }

  return markers;
}

export async function getExistingCalendarNoteMarkers(
  year: number,
  month: number,
  settings: CalendarSettings,
): Promise<ExistingCalendarNoteMarkers> {
  const tasksByDate = new Map<string, NoteSummary[]>();
  const overdueTasks: CalendarTaskWithDate[] = [];
  const today = new Date();
  const todayId = formatDateId(today.getFullYear(), today.getMonth(), today.getDate());

  await ensureCachedTreeIds([
    settings.notebookNotesPath,
    settings.tasksPath,
    settings.completedTasksPath,
  ]);

  const monthNotes = await getMonthNoteMarkers(year, month, settings);
  const tasksFolderIds = await getTasksTreeIds(settings);

  const datesByNoteId = new Map(monthNotes.datesByNoteId);
  const tasksWithMetadata = new Set<NoteSummary>();

  for (const folderId of tasksFolderIds) {
    await scanFolderNotes(folderId, (note) => {
      if (isDeletedNote(note) || !isTodoNote(note)) {
        return;
      }

      const dateId = resolveCalendarNoteDateId(
        note.title,
        year,
        month,
        settings,
      );
      const overdueDateId = !isTodoCompleted(note)
        ? resolveAnyCalendarNoteDateId(note.title, settings)
        : null;

      if (dateId) {
        datesByNoteId.set(note.id, dateId);
        monthNotes.datesByNoteId.set(note.id, dateId);
        appendItemForDate(tasksByDate, dateId, note);
        tasksWithMetadata.add(note);
      }

      if (overdueDateId && overdueDateId < todayId) {
        overdueTasks.push({ task: note, dateId: overdueDateId });
        tasksWithMetadata.add(note);
      }
    });
  }

  await attachTaskMetadata([...tasksWithMetadata]);

  for (const tasks of tasksByDate.values()) {
    tasks.sort(sortTasks);
  }

  monthNotes.tasksByDate = tasksByDate;

  overdueTasks.sort((first, second) => {
    const dateComparison = first.dateId.localeCompare(second.dateId);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return first.task.title.localeCompare(second.task.title);
  });

  return {
    datesByNoteId,
    noteCountsByDate: new Map(monthNotes.noteCountsByDate),
    notesByDate: new Map(monthNotes.notesByDate),
    tasksByDate,
    overdueTasks,
  };
}

function setsIntersect(
  first: ReadonlySet<string>,
  second: ReadonlySet<string>,
): boolean {
  const [smaller, larger] = first.size <= second.size ? [first, second] : [second, first];

  for (const value of smaller) {
    if (larger.has(value)) {
      return true;
    }
  }

  return false;
}

function hasNoteInMarkers(
  notesByDate: Map<string, NoteSummary[]> | undefined,
  noteId: string,
): boolean {
  if (!notesByDate) {
    return false;
  }

  for (const notes of notesByDate.values()) {
    if (notes.some((note) => note.id === noteId)) {
      return true;
    }
  }

  return false;
}

function getCachedDayTitles(
  baseTitle: string,
  dateId: string,
  settings: CalendarSettings,
  notesByDate: Map<string, NoteSummary[]> | undefined,
): Set<string> | null {
  const date = parseDateId(dateId);

  if (resolveCalendarNoteDateId(baseTitle, date.year, date.month, settings) !== dateId) {
    return null;
  }

  if (!notesByDate) {
    return null;
  }

  return new Set((notesByDate.get(dateId) ?? []).map((note) => note.title));
}

function getCachedDayNoteTitles(
  baseTitle: string,
  dateId: string,
  settings: CalendarSettings,
): Set<string> | null {
  const date = parseDateId(dateId);
  const cached = markersByMonth.get(buildMonthMarkersKey(date.year, date.month, settings));

  return getCachedDayTitles(baseTitle, dateId, settings, cached?.notesByDate);
}

function getCachedDayTaskTitles(
  baseTitle: string,
  dateId: string,
  settings: CalendarSettings,
): Set<string> | null {
  const date = parseDateId(dateId);
  const key = buildMonthMarkersKey(date.year, date.month, settings);
  const cached = markersByMonth.get(key);
  const titles = getCachedDayTitles(baseTitle, dateId, settings, cached?.tasksByDate);

  if (!titles) {
    return null;
  }

  const reservedTitles = reservedTaskTitlesByDate.get(`${key}\u0000${dateId}`);

  for (const title of reservedTitles ?? []) {
    titles.add(title);
  }

  return titles;
}

function reserveTaskTitle(dateId: string, settings: CalendarSettings, title: string): () => void {
  const date = parseDateId(dateId);
  const key = `${buildMonthMarkersKey(date.year, date.month, settings)}\u0000${dateId}`;
  let titles = reservedTaskTitlesByDate.get(key);

  if (!titles) {
    titles = new Set<string>();
    reservedTaskTitlesByDate.set(key, titles);
  }

  titles.add(title);

  return () => {
    titles.delete(title);

    if (titles.size === 0) {
      reservedTaskTitlesByDate.delete(key);
    }
  };
}

function appendCreatedTaskToMonthMarkers(
  dateId: string,
  settings: CalendarSettings,
  task: NoteSummary,
): void {
  const date = parseDateId(dateId);
  const cached = markersByMonth.get(buildMonthMarkersKey(date.year, date.month, settings));

  if (!cached?.tasksByDate) {
    return;
  }

  cached.datesByNoteId.set(task.id, dateId);
  appendItemForDate(cached.tasksByDate, dateId, task);
}

function makeUniqueTitleFromKnownTitles(
  baseTitle: string,
  knownTitles: ReadonlySet<string>,
): string {
  if (!knownTitles.has(baseTitle)) {
    return baseTitle;
  }

  let index = 2;

  while (true) {
    const title = `${baseTitle}${TITLE_DUPLICATE_SUFFIX_SEPARATOR}(${index})`;

    if (!knownTitles.has(title)) {
      return title;
    }

    index += 1;
  }
}

async function makeUniqueNoteTitle(
  baseTitle: string,
  folderIds: ReadonlySet<string>,
  knownTitles: ReadonlySet<string> | null = null,
): Promise<string> {
  if (knownTitles) {
    return makeUniqueTitleFromKnownTitles(baseTitle, knownTitles);
  }

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

  const body = renderNoteTemplate(templateSource.body, dateId, title, settings, createdAt);
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

  const body = renderNoteTemplate(templateSource.body, dateId, title, settings, createdAt);
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
  openAfterCreate = true,
): Promise<NoteSummary | null> {
  const effectiveSettings = settings ?? (await getCalendarSettings());
  const createdAt = new Date();
  const baseTitle = renderNoteTitle(dateId, effectiveSettings, createdAt);
  const noteFolderIds = await getNotebookNotesTreeIds(effectiveSettings);
  const taskFolderIds = await getTasksTreeIds(effectiveSettings);
  const knownTitles = setsIntersect(noteFolderIds, taskFolderIds)
    ? null
    : getCachedDayNoteTitles(baseTitle, dateId, effectiveSettings);
  const title = await makeUniqueNoteTitle(baseTitle, noteFolderIds, knownTitles);
  const created = await createCalendarNote(dateId, title, effectiveSettings, createdAt);

  if (created && openAfterCreate) {
    await joplin.commands.execute("openNote", created.id);
  }

  return created;
}

export async function createCalendarTaskForDate(
  dateId: string,
  settings?: CalendarSettings,
  openAfterCreate = true,
): Promise<NoteSummary | null> {
  const effectiveSettings = settings ?? (await getCalendarSettings());
  const dayIdentifier = buildDayIdentifier(dateId, effectiveSettings);
  const taskFolderIds = await getTasksTreeIds(effectiveSettings);
  const baseTitle = `${dayIdentifier} - ${strings.newTaskDefaultTitle}`;
  const knownTitles = getCachedDayTaskTitles(baseTitle, dateId, effectiveSettings);
  const title = knownTitles
    ? makeUniqueTitleFromKnownTitles(baseTitle, knownTitles)
    : await makeUniqueNoteTitle(baseTitle, taskFolderIds);
  const releaseReservedTitle = knownTitles
    ? reserveTaskTitle(dateId, effectiveSettings, title)
    : null;
  let created: NoteSummary | null = null;

  try {
    created = await createCalendarTask(dateId, title, effectiveSettings);
  } finally {
    releaseReservedTitle?.();
  }

  if (created) {
    appendCreatedTaskToMonthMarkers(dateId, effectiveSettings, created);
  }

  if (created && openAfterCreate) {
    await joplin.commands.execute("openNote", created.id);
  }

  return created;
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

async function renderRepeatedTaskBody(
  previousTask: NoteSummary,
  nextDateId: string,
  nextTitle: string,
  settings: CalendarSettings,
  createdAt: Date,
): Promise<string> {
  if (!settings.taskTemplatePath) {
    return previousTask.body ?? "";
  }

  try {
    const templateSource = await readNoteTemplateSource(settings.taskTemplatePath);
    return renderNoteTemplate(templateSource.body, nextDateId, nextTitle, settings, createdAt);
  } catch (error) {
    console.warn("Failed to read repeated task template. Copying previous body.", error);
    return previousTask.body ?? "";
  }
}

async function createNextRepeatedTask(
  task: NoteSummary,
  dateId: string,
  metadata: TaskMetadata,
  settings: CalendarSettings,
): Promise<boolean> {
  if (!metadata.repeat) {
    return false;
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
    return false;
  }

  const parentId = await getNotebookRootFolderIdForCreate(settings.tasksPath);

  if (!parentId) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
    return false;
  }

  const createdAt = new Date();
  const dayStart = startOfLocalDayMs(nextDateId);
  const nextAlarm = shiftAlarmToDate(task.todo_due, dateId, nextDateId);
  const body = await renderRepeatedTaskBody(
    task,
    nextDateId,
    nextTitle,
    settings,
    createdAt,
  );
  const payload: Record<string, unknown> = {
    title: nextTitle,
    body,
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
  await copyNoteTags(task.id, created.id);
  await writeNoteTaskMetadata(created.id, metadata);

  return true;
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
        fields: NOTE_LIST_FIELDS,
        limit: NOTE_PAGE_LIMIT,
        page,
      });

      const items = response.items as NoteSummary[];

      for (const rawNote of items) {
        if (
          isDeletedNote(rawNote)
          || !isTodoNote(rawNote)
          || !isCalendarNoteTitleForDate(rawNote.title, dateId, settings)
        ) {
          continue;
        }

        const note = await withTaskMetadata(rawNote);

        if (getTaskMetadata(note).repeat?.id === repeatId) {
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
  return resolveAnyCalendarNoteDateId(task.title, settings);
}

async function createNextRepeatedTaskIfNeeded(
  task: NoteSummary,
  dateId: string,
  settings: CalendarSettings,
): Promise<boolean> {
  const metadata = getTaskMetadata(task);

  if (!metadata.repeat) {
    return false;
  }

  return createNextRepeatedTask(task, dateId, metadata, settings);
}

async function withTaskCompletionProcessingLock<T>(
  noteId: string,
  operation: () => Promise<T>,
): Promise<T | undefined> {
  if (processingTaskCompletionNoteIds.has(noteId)) {
    return undefined;
  }

  processingTaskCompletionNoteIds.add(noteId);

  try {
    return await operation();
  } finally {
    processingTaskCompletionNoteIds.delete(noteId);
  }
}

async function updateTaskCompletionState(
  noteId: string,
  completed: boolean,
  showError: boolean,
): Promise<TaskCompletionResult> {
  const task = await getNoteWithBody(noteId);

  if (isDeletedNote(task) || !isTodoNote(task)) {
    return { applied: false, createdRepeatedTask: false, shouldRender: true };
  }

  const wasCompleted = isTodoCompleted(task);
  const settings = await getCalendarSettings();
  const parentId = await getTaskCompletionFolderId(completed, settings, showError);

  if (!parentId) {
    return { applied: false, createdRepeatedTask: false, shouldRender: true };
  }

  const shouldUpdateCompletion = wasCompleted !== completed;
  const shouldMoveTask = task.parent_id !== parentId;
  const hasRepeat = shouldUpdateCompletion
    && Boolean((await readNoteTaskMetadata(noteId)).repeat);

  if (!shouldUpdateCompletion && !shouldMoveTask) {
    return { applied: false, createdRepeatedTask: false, shouldRender: true };
  }

  const payload: Record<string, unknown> = {};

  if (shouldMoveTask) {
    payload.parent_id = parentId;
  }

  if (shouldUpdateCompletion) {
    payload.todo_completed = completed ? Date.now() : 0;
  }

  await joplin.data.put(["notes", noteId], null, payload);

  const shouldRender = shouldMoveTask || hasRepeat;

  if (!completed || wasCompleted) {
    return { applied: true, createdRepeatedTask: false, shouldRender };
  }

  const dateId = resolveTaskDateId(task, settings);

  if (!dateId) {
    return { applied: true, createdRepeatedTask: false, shouldRender };
  }

  const createdRepeatedTask = await createNextRepeatedTaskIfNeeded(task, dateId, settings);

  return {
    applied: true,
    createdRepeatedTask,
    shouldRender: shouldRender || createdRepeatedTask,
  };
}

export async function setCalendarTaskCompleted(
  noteId: string,
  completed: boolean,
): Promise<TaskCompletionResult> {
  const result = await withTaskCompletionProcessingLock(noteId, () =>
    updateTaskCompletionState(noteId, completed, true),
  );

  return result ?? { applied: false, createdRepeatedTask: false, shouldRender: true };
}

export async function syncCalendarTaskCompletionLocation(noteId: string): Promise<void> {
  await withTaskCompletionProcessingLock(noteId, async () => {
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

    if (!parentId || task.parent_id === parentId) {
      return;
    }

    await joplin.data.put(["notes", noteId], null, {
      parent_id: parentId,
    });

    if (completed) {
      await createNextRepeatedTaskIfNeeded(task, dateId, settings);
    }
  });
}

function renderRepeatDialogHtml(currentFrequency: RepeatFrequency | typeof REPEAT_NONE_VALUE): string {
  const option = (value: RepeatFrequency | typeof REPEAT_NONE_VALUE, label: string) => {
    const selected = currentFrequency === value;

    return `
      <label style="display:block;margin:8px 0;">
        <input type="radio" name="${REPEAT_INPUT_NAME}" value="${value}" ${selected ? "checked autofocus" : ""} />
        ${label}
      </label>
    `;
  };

  return `
    <form name="${REPEAT_FORM_NAME}">
      <h2>${strings.taskRepeatDialogTitle}</h2>
      ${option(REPEAT_NONE_VALUE, strings.taskRepeatNoneLabel)}
      ${REPEAT_FREQUENCIES.map((frequency) => option(frequency, getRepeatLabel(frequency))).join("")}
    </form>
    <script>
      document.querySelector('input[name="${REPEAT_INPUT_NAME}"]:checked')?.focus();
    </script>
  `;
}

async function getRepeatDialogHandle(): Promise<string> {
  if (!repeatDialogHandle) {
    repeatDialogHandle = await joplin.views.dialogs.create(REPEAT_DIALOG_ID);
  }

  return repeatDialogHandle;
}

export async function clearTaskRepeat(noteId: string): Promise<void> {
  const task = await getNoteWithBody(noteId);

  if (isDeletedNote(task) || !isTodoNote(task) || isTodoCompleted(task)) {
    return;
  }

  await writeNoteTaskMetadata(noteId, {});
}

export async function setTaskRepeat(noteId: string): Promise<void> {
  const task = await getNoteWithBody(noteId);

  if (isDeletedNote(task) || !isTodoNote(task) || isTodoCompleted(task)) {
    return;
  }

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

  const selected = result.formData?.[REPEAT_FORM_NAME]?.[REPEAT_INPUT_NAME];
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
