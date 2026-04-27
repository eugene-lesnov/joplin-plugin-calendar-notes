import joplin from "api";
import { SettingItemType } from "api/types";

import {
  DEFAULT_NOTE_TITLE_FORMAT,
  DEFAULT_WEEK_START,
  SETTINGS_SECTION,
  SETTING_CALENDAR_NOTES_PATH,
  SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
  SETTING_NOTE_TITLE_FORMAT,
  SETTING_WEEK_START,
} from "./constants";
import { weekdayLongName } from "./dateUtils";
import strings from "./localization";
import type { CalendarSettings, WeekStart } from "./types";

function normalizeNoteTitleFormat(value: unknown): string {
  const format = String(value ?? "").trim();

  if (!format) {
    return DEFAULT_NOTE_TITLE_FORMAT;
  }

  return format;
}

function normalizeWeekStart(value: unknown): WeekStart {
  return value === "sunday" ? "sunday" : "monday";
}

function normalizeCalendarNotesPath(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNoteTemplatePath(value: unknown): string {
  return String(value ?? "").trim();
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  const values = await joplin.settings.values([
    SETTING_NOTE_TITLE_FORMAT,
    SETTING_WEEK_START,
    SETTING_CALENDAR_NOTES_PATH,
    SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
  ]);

  return {
    noteTitleFormat: normalizeNoteTitleFormat(
      values[SETTING_NOTE_TITLE_FORMAT],
    ),
    weekStart: normalizeWeekStart(values[SETTING_WEEK_START]),
    calendarNotesPath: normalizeCalendarNotesPath(
      values[SETTING_CALENDAR_NOTES_PATH],
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
    [SETTING_NOTE_TITLE_FORMAT]: {
      value: DEFAULT_NOTE_TITLE_FORMAT,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.noteTitleFormatLabel,
      description: strings.noteTitleFormatDescription,
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
      value: "",
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.calendarNotesPathLabel,
      description: strings.calendarNotesPathDescription,
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
