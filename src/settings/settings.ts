import joplin from "api";
import { SettingItemType } from "api/types";

import {
  DEFAULT_NEW_NOTE_TITLE_FORMAT,
  DEFAULT_NOTEBOOK_PATH_PATTERN,
  DEFAULT_WEEK_START,
  JOPLIN_DATE_FORMAT_SETTING_KEY,
  JOPLIN_DEFAULT_DATE_FORMAT,
  JOPLIN_DEFAULT_TIME_FORMAT,
  JOPLIN_TIME_FORMAT_SETTING_KEY,
  NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME,
  NEW_NOTE_TITLE_FORMAT_DATE_ONLY,
  NEW_NOTE_TITLE_FORMATS,
  SETTINGS_SECTION,
  SETTING_NEW_NOTE_TITLE_FORMAT,
  SETTING_NOTEBOOK_NOTES_PATH,
  SETTING_COMPLETED_TASKS_PATH,
  SETTING_NOTEBOOK_NOTES_PATH_PATTERN,
  SETTING_NOTE_TEMPLATE_PATH,
  SETTING_TASKS_PATH,
  SETTING_TASK_TEMPLATE_PATH,
  SETTING_TAGGED_TASKS_TAGS,
  SETTING_WEEK_START,
} from "../core/constants";
import { momentFormatToPattern, weekdayLongName } from "../core/dateUtils";
import strings from "../core/localization";
import type { CalendarSettings, WeekStart } from "../core/types";

const GLOBAL_FORMAT_FALLBACK_WARNING =
  "Failed to read Joplin date/time formats. Using default formats.";
const TIME_FORMAT_ALPHA_TOKEN_PATTERN = /[A-Za-z]+/g;
const TIME_FORMAT_BRACKET_LITERAL_PATTERN = /\[[^\[\]]*\]/g;
const SUPPORTED_TIME_TOKENS = new Set(["HH", "H", "hh", "h", "mm", "m", "A", "a"]);
const REQUIRED_TIME_TOKENS = new Set(["HH", "H", "hh", "h"]);

type GlobalFormats = {
  dayIdentifierFormat: string;
  timeFormat: string;
};

function normalizeGlobalDateFormat(value: unknown): string {
  const format = String(value ?? "").trim();

  return momentFormatToPattern(format || JOPLIN_DEFAULT_DATE_FORMAT);
}

function stripTimeFormatLiterals(format: string): string | null {
  let stripped = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const literalPattern = new RegExp(TIME_FORMAT_BRACKET_LITERAL_PATTERN.source, "g");

  while ((match = literalPattern.exec(format)) !== null) {
    stripped += format.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
  }

  stripped += format.slice(lastIndex);

  if (stripped.includes("[") || stripped.includes("]")) {
    return null;
  }

  return stripped;
}

function normalizeGlobalTimeFormat(value: unknown): string {
  const format = String(value ?? "").trim();

  if (!format) {
    return momentFormatToPattern(JOPLIN_DEFAULT_TIME_FORMAT);
  }

  const tokenSource = stripTimeFormatLiterals(format);

  if (tokenSource === null) {
    return momentFormatToPattern(JOPLIN_DEFAULT_TIME_FORMAT);
  }

  const tokens = tokenSource.match(TIME_FORMAT_ALPHA_TOKEN_PATTERN) ?? [];

  if (
    tokens.length === 0
    || tokens.some((token) => !SUPPORTED_TIME_TOKENS.has(token))
    || !tokens.some((token) => REQUIRED_TIME_TOKENS.has(token))
  ) {
    return momentFormatToPattern(JOPLIN_DEFAULT_TIME_FORMAT);
  }

  return momentFormatToPattern(format);
}

async function resolveGlobalFormats(): Promise<GlobalFormats> {
  try {
    const [joplinDateFormat, joplinTimeFormat] = await joplin.settings.globalValues([
      JOPLIN_DATE_FORMAT_SETTING_KEY,
      JOPLIN_TIME_FORMAT_SETTING_KEY,
    ]);

    cachedGlobalFormats = {
      dayIdentifierFormat: normalizeGlobalDateFormat(joplinDateFormat),
      timeFormat: normalizeGlobalTimeFormat(joplinTimeFormat),
    };

    return cachedGlobalFormats;
  } catch (error) {
    console.warn(GLOBAL_FORMAT_FALLBACK_WARNING, error);
  }

  cachedGlobalFormats = fallbackGlobalFormats;
  return fallbackGlobalFormats;
}

function normalizeNewNoteTitleFormat(value: unknown): string {
  const format = String(value ?? "").trim();

  if (NEW_NOTE_TITLE_FORMATS.includes(format)) {
    return format;
  }

  return DEFAULT_NEW_NOTE_TITLE_FORMAT;
}

function normalizeWeekStart(value: unknown): WeekStart {
  return value === "sunday" ? "sunday" : "monday";
}

function normalizeNotebookPath(value: unknown, defaultPath: string): string {
  return String(value ?? "").trim() || defaultPath;
}

function normalizeNotebookPathPattern(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTemplatePath(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTaggedTasksTags(value: unknown): string {
  return String(value ?? "").trim();
}

type CachedCalendarSettings = Omit<CalendarSettings, "dayIdentifierFormat" | "timeFormat">;

const fallbackGlobalFormats: GlobalFormats = {
  dayIdentifierFormat: momentFormatToPattern(JOPLIN_DEFAULT_DATE_FORMAT),
  timeFormat: momentFormatToPattern(JOPLIN_DEFAULT_TIME_FORMAT),
};

const fallbackCalendarSettings: CalendarSettings = {
  ...fallbackGlobalFormats,
  newNoteTitleFormat: DEFAULT_NEW_NOTE_TITLE_FORMAT,
  weekStart: DEFAULT_WEEK_START,
  notebookNotesPath: strings.defaultNotebookNotesPath,
  notebookNotesPathPattern: DEFAULT_NOTEBOOK_PATH_PATTERN,
  noteTemplatePath: "",
  tasksPath: strings.defaultTasksPath,
  completedTasksPath: strings.defaultCompletedTasksPath,
  taskTemplatePath: "",
  taggedTasksTags: "",
};

let cachedCalendarSettings: CachedCalendarSettings | null = null;
let cachedGlobalFormats: GlobalFormats | null = null;
let lastCalendarSettings: CalendarSettings | null = null;

export function invalidateCalendarSettingsCache(): void {
  cachedCalendarSettings = null;
  lastCalendarSettings = cachedGlobalFormats
    ? { ...fallbackCalendarSettings, ...cachedGlobalFormats }
    : null;
}

async function loadCachedCalendarSettings(): Promise<CachedCalendarSettings> {
  if (cachedCalendarSettings) {
    return cachedCalendarSettings;
  }

  const values = await joplin.settings.values([
    SETTING_NEW_NOTE_TITLE_FORMAT,
    SETTING_WEEK_START,
    SETTING_NOTEBOOK_NOTES_PATH,
    SETTING_NOTEBOOK_NOTES_PATH_PATTERN,
    SETTING_NOTE_TEMPLATE_PATH,
    SETTING_TASKS_PATH,
    SETTING_COMPLETED_TASKS_PATH,
    SETTING_TASK_TEMPLATE_PATH,
    SETTING_TAGGED_TASKS_TAGS,
  ]);

  cachedCalendarSettings = {
    newNoteTitleFormat: normalizeNewNoteTitleFormat(
      values[SETTING_NEW_NOTE_TITLE_FORMAT],
    ),
    weekStart: normalizeWeekStart(values[SETTING_WEEK_START]),
    notebookNotesPath: normalizeNotebookPath(
      values[SETTING_NOTEBOOK_NOTES_PATH],
      strings.defaultNotebookNotesPath,
    ),
    notebookNotesPathPattern: normalizeNotebookPathPattern(
      values[SETTING_NOTEBOOK_NOTES_PATH_PATTERN],
    ),
    noteTemplatePath: normalizeTemplatePath(values[SETTING_NOTE_TEMPLATE_PATH]),
    tasksPath: normalizeNotebookPath(
      values[SETTING_TASKS_PATH],
      strings.defaultTasksPath,
    ),
    completedTasksPath: normalizeNotebookPath(
      values[SETTING_COMPLETED_TASKS_PATH],
      strings.defaultCompletedTasksPath,
    ),
    taskTemplatePath: normalizeTemplatePath(values[SETTING_TASK_TEMPLATE_PATH]),
    taggedTasksTags: normalizeTaggedTasksTags(values[SETTING_TAGGED_TASKS_TAGS]),
  };

  return cachedCalendarSettings;
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  const [cached, globalFormats] = await Promise.all([
    loadCachedCalendarSettings(),
    resolveGlobalFormats(),
  ]);

  lastCalendarSettings = { ...globalFormats, ...cached };
  return lastCalendarSettings;
}

export function getCachedCalendarSettings(): CalendarSettings {
  return lastCalendarSettings ?? fallbackCalendarSettings;
}

export async function registerSettings(): Promise<void> {
  await joplin.settings.registerSection(SETTINGS_SECTION, {
    label: strings.settingsSectionLabel,
    iconName: "fas fa-calendar-alt",
  });

  await joplin.settings.registerSettings({
    [SETTING_NEW_NOTE_TITLE_FORMAT]: {
      value: DEFAULT_NEW_NOTE_TITLE_FORMAT,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.newNoteTitleFormatLabel,
      description: strings.newNoteTitleFormatDescription,
      isEnum: true,
      options: {
        [NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME]: strings.newNoteTitleFormatDateAndTimeLabel,
        [NEW_NOTE_TITLE_FORMAT_DATE_ONLY]: strings.newNoteTitleFormatDateOnlyLabel,
      },
    },

    [SETTING_WEEK_START]: {
      value: DEFAULT_WEEK_START,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.weekStartLabel,
      description: strings.weekStartDescription,
      isEnum: true,
      options: {
        monday: weekdayLongName("monday"),
        sunday: weekdayLongName("sunday"),
      },
    },

    [SETTING_NOTEBOOK_NOTES_PATH]: {
      value: strings.defaultNotebookNotesPath,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.notebookNotesPathLabel,
      description: strings.notebookNotesPathDescription,
    },

    [SETTING_NOTEBOOK_NOTES_PATH_PATTERN]: {
      value: DEFAULT_NOTEBOOK_PATH_PATTERN,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.notebookNotesPathPatternLabel,
      description: strings.notebookNotesPathPatternDescription,
    },

    [SETTING_NOTE_TEMPLATE_PATH]: {
      value: "",
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.noteTemplateLabel,
      description: strings.noteTemplateDescription,
    },

    [SETTING_TASKS_PATH]: {
      value: strings.defaultTasksPath,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.tasksPathLabel,
      description: strings.tasksPathDescription,
    },

    [SETTING_COMPLETED_TASKS_PATH]: {
      value: strings.defaultCompletedTasksPath,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.completedTasksPathLabel,
      description: strings.completedTasksPathDescription,
    },

    [SETTING_TASK_TEMPLATE_PATH]: {
      value: "",
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.taskTemplateLabel,
      description: strings.taskTemplateDescription,
    },

    [SETTING_TAGGED_TASKS_TAGS]: {
      value: "",
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.taggedTasksSettingsLabel,
      description: strings.taggedTasksSettingsDescription,
    },
  });
}
