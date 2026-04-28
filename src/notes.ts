import joplin from "api";

import {
  DEFAULT_FLOW_MODE_TITLE_FORMAT,
  PLUGIN_ID,
} from "./constants";
import {
  daysInMonth,
  formatDateByPattern,
  formatDateExpression,
  formatDateId,
  pad2,
  parseDateId,
  startOfLocalDayMs,
} from "./dateUtils";
import strings, { formatLocalizedString } from "./localization";
import {
  ensureNotebookPath,
  getFallbackFolderId,
  resolveNotebookPath,
  splitNotebookPath,
} from "./notebooks";
import { getCalendarSettings } from "./settings";
import type {
  CalendarSettings,
  ExistingCalendarNoteMarkers,
  NoteSummary,
} from "./types";

const NOTE_PAGE_LIMIT = 100;
const NOTE_FIELDS = ["id", "title", "parent_id", "deleted_time"];

const ZEN_MODE_TITLE_PLACEHOLDER_PATTERN = /\{\{\s*zenModeTitle\s*\}\}/g;
const DATE_PLACEHOLDER_PATTERN = /\{\{\s*date:([^}]+)\s*\}\}/g;
const TEXT_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;
const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const REGEXP_SPECIAL_CHARS_PATTERN = /[.*+?^${}()|[\]\\]/g;
const TITLE_DUPLICATE_SUFFIX_SEPARATOR = " ";
const DUPLICATE_TITLE_SUFFIX_PATTERN = "(?: \\(\\d+\\))?";
const DYNAMIC_TITLE_PART_PATTERN = ".+";


export function buildNoteTitle(
  dateId: string,
  settings: CalendarSettings,
): string {
  const date = parseDateId(dateId);
  return formatDateByPattern(date, settings.zenModeTitleFormat);
}

export function isDeletedNote(note: NoteSummary): boolean {
  return Boolean(note.deleted_time && note.deleted_time > 0);
}

export function buildExpectedCalendarNoteTitles(
  year: number,
  month: number,
  settings: CalendarSettings,
): Map<string, string> {
  const expectedTitles = new Map<string, string>();
  const count = daysInMonth(year, month);

  for (let day = 1; day <= count; day++) {
    const dateId = formatDateId(year, month, day);
    const title = buildNoteTitle(dateId, settings);

    expectedTitles.set(title, dateId);
  }

  return expectedTitles;
}

function escapeRegExp(value: string): string {
  return value.replace(REGEXP_SPECIAL_CHARS_PATTERN, "\\$&");
}

function renderTemplatePattern(
  format: string,
  renderPlaceholder: (placeholder: string) => string,
): string {
  let pattern = "";
  let index = 0;
  let match: RegExpExecArray | null;

  TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0;

  while ((match = TEMPLATE_PLACEHOLDER_PATTERN.exec(format)) !== null) {
    pattern += escapeRegExp(format.slice(index, match.index));
    pattern += renderPlaceholder(match[1].trim());
    index = match.index + match[0].length;
  }

  TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0;
  pattern += escapeRegExp(format.slice(index));

  return pattern;
}

function buildFlowModeTitlePattern(
  dateId: string,
  settings: CalendarSettings,
): RegExp {
  const format = settings.flowModeTitleFormat || DEFAULT_FLOW_MODE_TITLE_FORMAT;
  const date = parseDateId(dateId);
  const zenModeTitle = buildNoteTitle(dateId, settings);
  const exactReplacements: Record<string, string> = {
    title: zenModeTitle,
    noteTitle: zenModeTitle,
    zenModeTitle,
    ...getDateReplacements(dateId),
  };

  const bodyPattern = renderTemplatePattern(format, (placeholder) => {
    if (placeholder.startsWith("date:")) {
      return escapeRegExp(formatDateExpression(date, placeholder.slice(5).trim()));
    }

    const replacement = exactReplacements[placeholder];

    if (replacement !== undefined) {
      return escapeRegExp(replacement);
    }

    return DYNAMIC_TITLE_PART_PATTERN;
  });

  return new RegExp(`^${bodyPattern}${DUPLICATE_TITLE_SUFFIX_PATTERN}$`);
}

export function isCalendarNoteTitleForDate(
  title: string,
  dateId: string,
  settings: CalendarSettings,
): boolean {
  const zenModeTitle = buildNoteTitle(dateId, settings);

  if (title === zenModeTitle) {
    return true;
  }

  return settings.noteMode === "flow" && buildFlowModeTitlePattern(
    dateId,
    settings,
  ).test(title);
}

export function resolveCalendarNoteDateId(
  title: string,
  year: number,
  month: number,
  settings: CalendarSettings,
): string | null {
  const expectedTitles = buildExpectedCalendarNoteTitles(year, month, settings);

  if (settings.noteMode === "zen") {
    return expectedTitles.get(title) ?? null;
  }

  const candidates = [...expectedTitles.entries()].sort(
    ([firstTitle], [secondTitle]) => secondTitle.length - firstTitle.length,
  );

  for (const [, dateId] of candidates) {
    if (isCalendarNoteTitleForDate(title, dateId, settings)) {
      return dateId;
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
    ...getDateReplacements(dateId),
  };

  body = body.replace(TEXT_PLACEHOLDER_PATTERN, (match, key: string) => {
    return replacements[key] ?? match;
  });

  return body;
}

function formatTimeForTitle(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function renderFlowModeTitle(
  dateId: string,
  settings: CalendarSettings,
  createdAt = new Date(),
): string {
  const format = settings.flowModeTitleFormat || DEFAULT_FLOW_MODE_TITLE_FORMAT;
  const date = parseDateId(dateId);
  const zenModeTitle = buildNoteTitle(dateId, settings);

  let title = format.replace(ZEN_MODE_TITLE_PLACEHOLDER_PATTERN, zenModeTitle);

  title = title.replace(DATE_PLACEHOLDER_PATTERN, (_, pattern: string) => {
    return formatDateExpression(date, pattern.trim());
  });

  const replacements: Record<string, string> = {
    title: zenModeTitle,
    noteTitle: zenModeTitle,
    zenModeTitle,
    time: formatTimeForTitle(createdAt),
    ...getDateReplacements(dateId),
  };

  title = title.replace(TEXT_PLACEHOLDER_PATTERN, (match, key: string) => {
    return replacements[key] ?? match;
  });

  return title.trim() || zenModeTitle;
}

async function getCalendarNotesFolderIdForCreate(
  settings: CalendarSettings,
): Promise<string | null> {
  if (settings.calendarNotesPath) {
    return ensureNotebookPath(settings.calendarNotesPath);
  }

  return getFallbackFolderId();
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


function incrementNoteCount(
  noteCountsByDate: Map<string, number>,
  dateId: string,
): void {
  noteCountsByDate.set(dateId, (noteCountsByDate.get(dateId) ?? 0) + 1);
}

export async function getExistingCalendarNoteMarkers(
  year: number,
  month: number,
  settings: CalendarSettings,
): Promise<ExistingCalendarNoteMarkers> {
  const dates = new Set<string>();
  const datesByNoteId = new Map<string, string>();
  const noteCountsByDate = new Map<string, number>();

  let page = 1;

  while (true) {
    const response = await joplin.data.get(["notes"], {
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

      if (dateId) {
        dates.add(dateId);
        datesByNoteId.set(note.id, dateId);
        incrementNoteCount(noteCountsByDate, dateId);
      }
    }

    if (!response.has_more) {
      break;
    }

    page += 1;
  }

  return { dates, datesByNoteId, noteCountsByDate };
}

async function makeUniqueNoteTitle(baseTitle: string): Promise<string> {
  if (!(await findNoteByExactTitleAnywhere(baseTitle))) {
    return baseTitle;
  }

  let index = 2;

  while (true) {
    const title = `${baseTitle}${TITLE_DUPLICATE_SUFFIX_SEPARATOR}(${index})`;

    if (!(await findNoteByExactTitleAnywhere(title))) {
      return title;
    }

    index += 1;
  }
}

async function createCalendarNote(
  dateId: string,
  title: string,
  settings: CalendarSettings,
): Promise<NoteSummary | null> {
  const parentId = await getCalendarNotesFolderIdForCreate(settings);

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

  const body = renderNoteTemplate(rawTemplate, dateId, title);
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


async function openOrCreateZenModeCalendarNote(
  dateId: string,
  settings: CalendarSettings,
): Promise<void> {
  const title = buildNoteTitle(dateId, settings);
  const existing = await findNoteByExactTitleAnywhere(title);

  if (existing) {
    await joplin.commands.execute("openNote", existing.id);
    return;
  }

  const created = await createCalendarNote(dateId, title, settings);

  if (created) {
    await joplin.commands.execute("openNote", created.id);
  }
}

async function createFlowModeCalendarNote(
  dateId: string,
  settings: CalendarSettings,
): Promise<void> {
  const baseTitle = renderFlowModeTitle(dateId, settings);
  const title = await makeUniqueNoteTitle(baseTitle);
  const created = await createCalendarNote(dateId, title, settings);

  if (created) {
    await joplin.commands.execute("openNote", created.id);
  }
}

async function openOrCreateFlowModeCalendarNote(
  dateId: string,
  settings: CalendarSettings,
): Promise<void> {
  await createFlowModeCalendarNote(dateId, settings);
}

export async function openOrCreateCalendarNote(dateId: string): Promise<void> {
  const settings = await getCalendarSettings();

  if (settings.noteMode === "flow") {
    await openOrCreateFlowModeCalendarNote(dateId, settings);
    return;
  }

  await openOrCreateZenModeCalendarNote(dateId, settings);
}
