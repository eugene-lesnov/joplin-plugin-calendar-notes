import joplin from "api";
import { SettingItemType } from "api/types";

import {
  DAY_IDENTIFIER_FORMAT_COMPACT,
  DAY_IDENTIFIER_FORMAT_DASHES_EU,
  DAY_IDENTIFIER_FORMAT_DASHES_US,
  DAY_IDENTIFIER_FORMAT_DOTS,
  DAY_IDENTIFIER_FORMAT_ISO,
  DAY_IDENTIFIER_FORMAT_SLASHES,
  DAY_IDENTIFIER_FORMAT_US,
  DAY_IDENTIFIER_FORMATS,
  DEFAULT_DAY_IDENTIFIER_FORMAT,
  DEFAULT_NEW_NOTE_TITLE_FORMAT,
  DEFAULT_NOTEBOOK_PATH_PATTERN,
  DEFAULT_WEEK_START,
  NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME,
  NEW_NOTE_TITLE_FORMAT_DATE_ONLY,
  NEW_NOTE_TITLE_FORMATS,
  SETTINGS_SECTION,
  SETTING_DAY_IDENTIFIER_FORMAT,
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
import { weekdayLongName } from "../core/dateUtils";
import strings from "../core/localization";
import type { CalendarSettings, WeekStart } from "../core/types";

function normalizeDayIdentifierFormat(value: unknown): string {
  const format = String(value ?? "").trim();

  if (DAY_IDENTIFIER_FORMATS.includes(format)) {
    return format;
  }

  return DEFAULT_DAY_IDENTIFIER_FORMAT;
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

export async function getCalendarSettings(): Promise<CalendarSettings> {
  const values = await joplin.settings.values([
    SETTING_DAY_IDENTIFIER_FORMAT,
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

  return {
    dayIdentifierFormat: normalizeDayIdentifierFormat(
      values[SETTING_DAY_IDENTIFIER_FORMAT],
    ),
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
}

export async function registerSettings(): Promise<void> {
  await joplin.settings.registerSection(SETTINGS_SECTION, {
    label: strings.settingsSectionLabel,
    iconName: "fas fa-calendar-alt",
  });

  await joplin.settings.registerSettings({
    [SETTING_DAY_IDENTIFIER_FORMAT]: {
      value: DEFAULT_DAY_IDENTIFIER_FORMAT,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.dayIdentifierFormatLabel,
      description: strings.dayIdentifierFormatDescription,
      isEnum: true,
      options: {
        [DAY_IDENTIFIER_FORMAT_DOTS]: strings.dayIdentifierFormatDotsLabel,
        [DAY_IDENTIFIER_FORMAT_ISO]: strings.dayIdentifierFormatIsoLabel,
        [DAY_IDENTIFIER_FORMAT_SLASHES]: strings.dayIdentifierFormatSlashesLabel,
        [DAY_IDENTIFIER_FORMAT_US]: strings.dayIdentifierFormatUsLabel,
        [DAY_IDENTIFIER_FORMAT_COMPACT]: strings.dayIdentifierFormatCompactLabel,
        [DAY_IDENTIFIER_FORMAT_DASHES_EU]: strings.dayIdentifierFormatDashesEuLabel,
        [DAY_IDENTIFIER_FORMAT_DASHES_US]: strings.dayIdentifierFormatDashesUsLabel,
      },
    },

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
