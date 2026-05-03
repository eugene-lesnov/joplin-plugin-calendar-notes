import type { CalendarNoteMode, WeekStart } from "./types";

export const PLUGIN_ID = "calendar-notes";
export const PANEL_ID = "calendarNotesPanel";

export const SETTINGS_SECTION = "calendarNotesSection";
export const SETTING_NOTE_MODE = "noteMode";
export const SETTING_ZEN_MODE_TITLE_FORMAT = "zenModeTitleFormat";
export const SETTING_FLOW_MODE_TITLE_FORMAT = "flowModeTitleFormat";
export const SETTING_WEEK_START = "weekStart";
export const SETTING_CALENDAR_NOTES_PATH = "calendarNotesPath";
export const SETTING_CALENDAR_NOTES_PATH_PATTERN = "calendarNotesPathPattern";
export const SETTING_CALENDAR_NOTE_TEMPLATE_PATH = "calendarNoteTemplatePath";

export const DEFAULT_NOTE_MODE: CalendarNoteMode = "zen";
export const DEFAULT_ZEN_MODE_TITLE_FORMAT = "{{YYYY-MM-dd}}";
export const DEFAULT_FLOW_MODE_TITLE_FORMAT = "{{zenModeTitle}} - {{time}}";
export const DEFAULT_WEEK_START: WeekStart = "monday";
export const DEFAULT_CALENDAR_NOTES_PATH = "Calendar Notes";
export const DEFAULT_CALENDAR_NOTES_PATH_PATTERN = "{{year}}/{{month}}";
