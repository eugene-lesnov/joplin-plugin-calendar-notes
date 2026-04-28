import joplin from "api";
import { SettingItemType } from "api/types";

import {
  DEFAULT_FLOW_MODE_TITLE_FORMAT,
  DEFAULT_NOTE_MODE,
  DEFAULT_WEEK_START,
  DEFAULT_ZEN_MODE_TITLE_FORMAT,
  SETTINGS_SECTION,
  SETTING_CALENDAR_NOTES_PATH,
  SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
  SETTING_FLOW_MODE_TITLE_FORMAT,
  SETTING_NOTE_MODE,
  SETTING_WEEK_START,
  SETTING_ZEN_MODE_TITLE_FORMAT,
} from "./constants";
import { weekdayLongName } from "./dateUtils";
import strings from "./localization";
import type { CalendarNoteMode, CalendarSettings, WeekStart } from "./types";

const ZEN_MODE_TITLE_PLACEHOLDER_PATTERN = /\{\{\s*zenModeTitle\s*\}\}/;

function normalizeNoteMode(value: unknown): CalendarNoteMode {
  return value === "flow" ? "flow" : DEFAULT_NOTE_MODE;
}

function normalizeZenModeTitleFormat(value: unknown): string {
  const format = String(value ?? "").trim();

  if (!format) {
    return DEFAULT_ZEN_MODE_TITLE_FORMAT;
  }

  return format;
}

function normalizeFlowModeTitleFormat(value: unknown): string {
  const format = String(value ?? "").trim();

  if (!format || !ZEN_MODE_TITLE_PLACEHOLDER_PATTERN.test(format)) {
    return DEFAULT_FLOW_MODE_TITLE_FORMAT;
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
    SETTING_NOTE_MODE,
    SETTING_ZEN_MODE_TITLE_FORMAT,
    SETTING_FLOW_MODE_TITLE_FORMAT,
    SETTING_WEEK_START,
    SETTING_CALENDAR_NOTES_PATH,
    SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
  ]);

  return {
    noteMode: normalizeNoteMode(values[SETTING_NOTE_MODE]),
    zenModeTitleFormat: normalizeZenModeTitleFormat(
      values[SETTING_ZEN_MODE_TITLE_FORMAT],
    ),
    flowModeTitleFormat: normalizeFlowModeTitleFormat(
      values[SETTING_FLOW_MODE_TITLE_FORMAT],
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
    [SETTING_NOTE_MODE]: {
      value: DEFAULT_NOTE_MODE,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.noteModeLabel,
      description: strings.noteModeDescription,
      isEnum: true,
      options: {
        zen: strings.zenModeLabel,
        flow: strings.flowModeLabel,
      },
    },

    [SETTING_ZEN_MODE_TITLE_FORMAT]: {
      value: DEFAULT_ZEN_MODE_TITLE_FORMAT,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.zenModeTitleFormatLabel,
      description: strings.zenModeTitleFormatDescription,
    },

    [SETTING_FLOW_MODE_TITLE_FORMAT]: {
      value: DEFAULT_FLOW_MODE_TITLE_FORMAT,
      type: SettingItemType.String,
      section: SETTINGS_SECTION,
      public: true,
      label: strings.flowModeTitleFormatLabel,
      description: strings.flowModeTitleFormatDescription,
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
