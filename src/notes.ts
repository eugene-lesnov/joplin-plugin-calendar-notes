import joplin from "api";

import { PLUGIN_ID } from "./constants";
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

export function buildNoteTitle(
  dateId: string,
  settings: CalendarSettings,
): string {
  const date = parseDateId(dateId);
  return formatDateByPattern(date, settings.noteTitleFormat);
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

async function findNoteByExactTitleInFolder(
  folderId: string,
  title: string,
): Promise<NoteSummary | null> {
  let page = 1;

  while (true) {
    const response = await joplin.data.get(["folders", folderId, "notes"], {
      fields: ["id", "title", "parent_id", "deleted_time"],
      limit: 100,
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

export function renderNoteTemplate(
  rawTemplate: string,
  dateId: string,
  title: string,
): string {
  if (!rawTemplate.trim()) {
    return "";
  }

  const date = parseDateId(dateId);

  const year = String(date.year);
  const shortYear = year.slice(-2);
  const month = date.month + 1;
  const day = date.day;

  let body = rawTemplate.replace(/\\n/g, "\n");

  body = body.replace(/\{\{\s*date:([^}]+)\s*\}\}/g, (_, pattern: string) => {
    return formatDateExpression(date, pattern.trim());
  });

  const replacements: Record<string, string> = {
    title,
    noteTitle: title,

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

  body = body.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (match, key: string) => {
    return replacements[key] ?? match;
  });

  return body;
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
      fields: ["id", "title", "parent_id", "deleted_time"],
      limit: 100,
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

export async function getExistingCalendarNoteMarkers(
  year: number,
  month: number,
  settings: CalendarSettings,
): Promise<ExistingCalendarNoteMarkers> {
  const dates = new Set<string>();
  const datesByNoteId = new Map<string, string>();

  const expectedTitles = buildExpectedCalendarNoteTitles(year, month, settings);

  let page = 1;

  while (true) {
    const response = await joplin.data.get(["notes"], {
      fields: ["id", "title", "parent_id", "deleted_time"],
      limit: 100,
      page,
    });

    const items = response.items as NoteSummary[];

    for (const note of items) {
      if (isDeletedNote(note)) {
        continue;
      }

      const dateId = expectedTitles.get(note.title);

      if (dateId) {
        dates.add(dateId);
        datesByNoteId.set(note.id, dateId);
      }
    }

    if (!response.has_more) {
      break;
    }

    page += 1;
  }

  return { dates, datesByNoteId };
}

export async function openOrCreateCalendarNote(dateId: string): Promise<void> {
  const settings = await getCalendarSettings();
  const title = buildNoteTitle(dateId, settings);

  const existing = await findNoteByExactTitleAnywhere(title);

  if (existing) {
    await joplin.commands.execute("openNote", existing.id);
    return;
  }

  const parentId = await getCalendarNotesFolderIdForCreate(settings);

  if (!parentId) {
    await joplin.views.dialogs.showMessageBox(
      strings.createCalendarNoteNoNotebookError,
    );
    return;
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
    return;
  }

  const body = renderNoteTemplate(rawTemplate, dateId, title);
  const dayStart = startOfLocalDayMs(dateId);

  const created = await joplin.data.post(["notes"], null, {
    title,
    body,
    parent_id: parentId,
    user_created_time: dayStart,
    user_updated_time: dayStart,
    source_application: PLUGIN_ID,
  });

  await joplin.commands.execute("openNote", created.id);
}
