import type { WeekStart } from "./types";

export const PLUGIN_ID = "calendar-notes";
export const PANEL_ID = "calendarNotesPanel";

export const SETTINGS_SECTION = "calendarNotesSection";
export const SETTING_NEW_NOTE_TITLE_FORMAT = "newNoteTitleFormat";
export const SETTING_WEEK_START = "weekStart";
export const SETTING_NOTEBOOK_NOTES_PATH = "notebookNotesPath";
export const SETTING_NOTEBOOK_NOTES_PATH_PATTERN = "notebookNotesPathPattern";
export const SETTING_NOTE_TEMPLATE_PATH = "noteTemplatePath";
export const SETTING_TASKS_PATH = "tasksPath";
export const SETTING_COMPLETED_TASKS_PATH = "completedTasksPath";
export const SETTING_TASK_TEMPLATE_PATH = "taskTemplatePath";
export const SETTING_TAGGED_TASKS_TAGS = "taggedTasksTags";

export const JOPLIN_DATE_FORMAT_SETTING_KEY = "dateFormat";
export const JOPLIN_TIME_FORMAT_SETTING_KEY = "timeFormat";
export const JOPLIN_DEFAULT_DATE_FORMAT = "DD/MM/YYYY";
export const JOPLIN_DEFAULT_TIME_FORMAT = "HH:mm";

export const NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME = "{{dayIdentifier}} - {{time}}";
export const NEW_NOTE_TITLE_FORMAT_DATE_ONLY = "{{dayIdentifier}}";

export const NEW_NOTE_TITLE_FORMATS = [
  NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME,
  NEW_NOTE_TITLE_FORMAT_DATE_ONLY,
];

export const DEFAULT_DAY_IDENTIFIER_FORMAT = "{{dd.mm.YYYY}}";
export const DEFAULT_NEW_NOTE_TITLE_FORMAT = NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME;
export const DEFAULT_WEEK_START: WeekStart = "monday";
export const DEFAULT_NOTEBOOK_PATH_PATTERN = "{{year}}/{{month}}";

export const TAGGED_TASKS_HIDDEN_POLL_MS = 30_000;
