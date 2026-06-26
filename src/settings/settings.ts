import joplin from "api";
import { SettingItemType } from "api/types";

import {
  DEFAULT_NEW_NOTE_TITLE_FORMAT,
  DEFAULT_NOTEBOOK_PATH_PATTERN,
  DEFAULT_WEEK_START,
  JOPLIN_DATE_FORMAT_SETTING_KEY,
  JOPLIN_DEFAULT_DATE_FORMAT,
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

const DATE_FORMAT_FALLBACK_WARNING =
  "Failed to read Joplin date format. Using default date format.";

async function resolveDayIdentifierFormat(): Promise<string> {
  try {
    const [joplinDateFormat] = await joplin.settings.globalValues([
      JOPLIN_DATE_FORMAT_SETTING_KEY,
    ]);
    const format = String(joplinDateFormat ?? "").trim();

    if (format) {
      return momentFormatToPattern(format);
    }
  } catch (error) {
    console.warn(DATE_FORMAT_FALLBACK_WARNING, error);
  }

  return momentFormatToPattern(JOPLIN_DEFAULT_DATE_FORMAT);
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

type CachedCalendarSettings = Omit<CalendarSettings, "dayIdentifierFormat">;

let cachedCalendarSettings: CachedCalendarSettings | null = null;

export function invalidateCalendarSettingsCache(): void {
  cachedCalendarSettings = null;
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
  const [cached, dayIdentifierFormat] = await Promise.all([
    loadCachedCalendarSettings(),
    resolveDayIdentifierFormat(),
  ]);

  return { dayIdentifierFormat, ...cached };
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
