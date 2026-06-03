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
  DEFAULT_CALENDAR_NOTES_PATH,
  DEFAULT_CALENDAR_NOTES_PATH_PATTERN,
  DEFAULT_DAY_IDENTIFIER_FORMAT,
  DEFAULT_NEW_NOTE_TITLE_FORMAT,
  DEFAULT_WEEK_START,
  NEW_NOTE_TITLE_FORMAT_DATE_AND_TIME,
  NEW_NOTE_TITLE_FORMAT_DATE_ONLY,
  NEW_NOTE_TITLE_FORMATS,
  SETTINGS_SECTION,
  SETTING_CALENDAR_NOTES_PATH,
  SETTING_CALENDAR_NOTES_PATH_PATTERN,
  SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
  SETTING_DAY_IDENTIFIER_FORMAT,
  SETTING_NEW_NOTE_TITLE_FORMAT,
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

function normalizeCalendarNotesPath(value: unknown): string {
  return String(value ?? "").trim() || DEFAULT_CALENDAR_NOTES_PATH;
}

function normalizeCalendarNotesPathPattern(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNoteTemplatePath(value: unknown): string {
  return String(value ?? "").trim();
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  const values = await joplin.settings.values([
    SETTING_DAY_IDENTIFIER_FORMAT,
    SETTING_NEW_NOTE_TITLE_FORMAT,
    SETTING_WEEK_START,
    SETTING_CALENDAR_NOTES_PATH,
    SETTING_CALENDAR_NOTES_PATH_PATTERN,
    SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
  ]);

  return {
    dayIdentifierFormat: normalizeDayIdentifierFormat(
      values[SETTING_DAY_IDENTIFIER_FORMAT],
    ),
    newNoteTitleFormat: normalizeNewNoteTitleFormat(
      values[SETTING_NEW_NOTE_TITLE_FORMAT],
    ),
    weekStart: normalizeWeekStart(values[SETTING_WEEK_START]),
    calendarNotesPath: normalizeCalendarNotesPath(
      values[SETTING_CALENDAR_NOTES_PATH],
    ),
    calendarNotesPathPattern: normalizeCalendarNotesPathPattern(
      values[SETTING_CALENDAR_NOTES_PATH_PATTERN],
    ),
    calendarNoteTemplatePath: normalizeNoteTemplatePath(
      values[SETTING_CALENDAR_NOTE_TEMPLATE_PATH],
    ),
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

    [SETTING_CALENDAR_NOTES_PATH]: {
      value: DEFAULT_CALENDAR_NOTES_PATH,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.calendarNotesPathLabel,
      description: strings.calendarNotesPathDescription,
    },

    [SETTING_CALENDAR_NOTES_PATH_PATTERN]: {
      value: DEFAULT_CALENDAR_NOTES_PATH_PATTERN,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.calendarNotesPathPatternLabel,
      description: strings.calendarNotesPathPatternDescription,
    },

    [SETTING_CALENDAR_NOTE_TEMPLATE_PATH]: {
      value: "",
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.noteTemplateLabel,
      description: strings.noteTemplateDescription,
    },
  });
}
