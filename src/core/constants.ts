import type { WeekStart } from "./types";

export const PLUGIN_ID = "calendar-notes";
export const PANEL_ID = "calendarNotesPanel";

export const SETTINGS_SECTION = "calendarNotesSection";
export const SETTING_DAY_IDENTIFIER_FORMAT = "dayIdentifierFormat";
export const SETTING_NEW_NOTE_TITLE_FORMAT = "newNoteTitleFormat";
export const SETTING_WEEK_START = "weekStart";
export const SETTING_NOTEBOOK_NOTES_PATH = "notebookNotesPath";
export const SETTING_NOTEBOOK_NOTES_PATH_PATTERN = "notebookNotesPathPattern";
export const SETTING_NOTE_TEMPLATE_PATH = "noteTemplatePath";
export const SETTING_TASKS_PATH = "tasksPath";
export const SETTING_COMPLETED_TASKS_PATH = "completedTasksPath";
export const SETTING_TASK_TEMPLATE_PATH = "taskTemplatePath";
export const SETTING_TAGGED_TASKS_TAGS = "taggedTasksTags";

export const DAY_IDENTIFIER_FORMAT_DOTS = "{{dd.mm.YYYY}}";
export const DAY_IDENTIFIER_FORMAT_ISO = "{{YYYY-MM-dd}}";
export const DAY_IDENTIFIER_FORMAT_SLASHES = "{{dd/MM/YYYY}}";
export const DAY_IDENTIFIER_FORMAT_US = "{{MM/dd/YYYY}}";
export const DAY_IDENTIFIER_FORMAT_COMPACT = "{{YYYYMMdd}}";
export const DAY_IDENTIFIER_FORMAT_DASHES_EU = "{{dd-MM-YYYY}}";
export const DAY_IDENTIFIER_FORMAT_DASHES_US = "{{MM-dd-YYYY}}";

export const NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME = "{{dayIdentifier}} - {{time}}";
export const NEW_NOTE_TITLE_FORMAT_DATE_ONLY = "{{dayIdentifier}}";

export const DAY_IDENTIFIER_FORMATS = [
  DAY_IDENTIFIER_FORMAT_DOTS,
  DAY_IDENTIFIER_FORMAT_ISO,
  DAY_IDENTIFIER_FORMAT_SLASHES,
  DAY_IDENTIFIER_FORMAT_US,
  DAY_IDENTIFIER_FORMAT_COMPACT,
  DAY_IDENTIFIER_FORMAT_DASHES_EU,
  DAY_IDENTIFIER_FORMAT_DASHES_US,
];

export const NEW_NOTE_TITLE_FORMATS = [
  NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME,
  NEW_NOTE_TITLE_FORMAT_DATE_ONLY,
];

export const DEFAULT_DAY_IDENTIFIER_FORMAT = DAY_IDENTIFIER_FORMAT_DOTS;
export const DEFAULT_NEW_NOTE_TITLE_FORMAT = NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME;
export const DEFAULT_WEEK_START: WeekStart = "monday";
export const DEFAULT_NOTEBOOK_PATH_PATTERN = "{{year}}/{{month}}";
