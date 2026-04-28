import joplin from "api";
import { MenuItemLocation, ToolbarButtonLocation } from "api/types";

import {
  SETTING_CALENDAR_NOTES_PATH,
  SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
  SETTING_MULTIPLE_NOTE_TITLE_FORMAT,
  SETTING_NOTE_MODE,
  SETTING_NOTE_TITLE_FORMAT,
  SETTING_WEEK_START,
} from "./constants";
import strings, { getLocales, setLocale } from "./localization";
import { openOrCreateCalendarNote } from "./notes";
import {
  goToNextMonth,
  goToPrevMonth,
  goToToday,
  hasStaleVisibleCalendarNoteMarkers,
  hidePanel,
  isVisibleCalendarNote,
  refreshCalendarNow,
  renderCalendar,
  scheduleCalendarRefresh,
  setupPanel,
  shouldRefreshCalendarForNoteChange,
  toggleCalendarPanel,
} from "./panel";
import { registerSettings } from "./settings";
import type {
  CalendarMessage,
  NoteChangeEvent,
  NoteSelectionChangeEvent,
} from "./types";

const TOGGLE_COMMAND = "toggleCalendarNotes";
const TOGGLE_TOOLBAR_BUTTON_ID = "toggleCalendarNotesToolbarButton";
const TOGGLE_MENU_ITEM_ID = "toggleCalendarNotesMenuItem";
const JOPLIN_LOCALE_SETTING_KEY = "locale";

let previousSelectedNoteIds: string[] = [];

const RENDER_AFFECTING_SETTINGS = [
  SETTING_NOTE_MODE,
  SETTING_NOTE_TITLE_FORMAT,
  SETTING_MULTIPLE_NOTE_TITLE_FORMAT,
  SETTING_WEEK_START,
  SETTING_CALENDAR_NOTES_PATH,
  SETTING_CALENDAR_NOTE_TEMPLATE_PATH,
];

async function handlePanelMessage(message: CalendarMessage): Promise<void> {
  if (message.name === "openDate") {
    await openOrCreateCalendarNote(message.date);
    await renderCalendar();
    return;
  }

  if (message.name === "prevMonth") {
    await goToPrevMonth();
    return;
  }

  if (message.name === "nextMonth") {
    await goToNextMonth();
    return;
  }

  if (message.name === "today") {
    await goToToday();
    return;
  }

  if (message.name === "refresh") {
    await refreshCalendarNow();
  }
}

async function handleNoteChange(event: NoteChangeEvent): Promise<void> {
  if (await shouldRefreshCalendarForNoteChange(event.id, event.event)) {
    await scheduleCalendarRefresh();
  }
}

async function handleNoteSelectionChange(
  event: NoteSelectionChangeEvent,
): Promise<void> {
  const selectedNoteIds = event.value ?? [];
  const selectedNoteIdSet = new Set(selectedNoteIds);
  const changedFromVisibleCalendarNote = await Promise.all(
    previousSelectedNoteIds
      .filter((noteId) => !selectedNoteIdSet.has(noteId))
      .map((noteId) => isVisibleCalendarNote(noteId)),
  );

  previousSelectedNoteIds = selectedNoteIds;

  if (
    changedFromVisibleCalendarNote.some(Boolean) &&
    (await hasStaleVisibleCalendarNoteMarkers())
  ) {
    await scheduleCalendarRefresh();
  }
}

async function registerCommands(): Promise<void> {
  await joplin.commands.register({
    name: TOGGLE_COMMAND,
    label: strings.toggleCalendarCommandLabel,
    iconName: "fas fa-calendar-alt",
    execute: async () => {
      await toggleCalendarPanel();
    },
  });

  await joplin.views.toolbarButtons.create(
    TOGGLE_TOOLBAR_BUTTON_ID,
    TOGGLE_COMMAND,
    ToolbarButtonLocation.NoteToolbar,
  );

  await joplin.views.menuItems.create(
    TOGGLE_MENU_ITEM_ID,
    TOGGLE_COMMAND,
    MenuItemLocation.Tools,
  );
}

async function configureLocale(): Promise<void> {
  try {
    const [locale] = await joplin.settings.globalValues([JOPLIN_LOCALE_SETTING_KEY]);

    if (typeof locale === "string" && locale.trim()) {
      setLocale([locale, ...getLocales()]);
    }
  } catch (error) {
    console.warn("Failed to read Joplin locale. Using Electron locale.", error);
  }
}

joplin.plugins.register({
  onStart: async () => {
    await configureLocale();
    await registerSettings();

    await setupPanel(handlePanelMessage);
    previousSelectedNoteIds = await joplin.workspace.selectedNoteIds();

    await joplin.settings.onChange(async (event) => {
      const keys = event.keys ?? [];

      if (keys.some((key) => RENDER_AFFECTING_SETTINGS.includes(key))) {
        await renderCalendar();
      }
    });

    await joplin.workspace.onNoteChange(handleNoteChange);
    await joplin.workspace.onNoteSelectionChange(handleNoteSelectionChange);
    await joplin.workspace.onSyncComplete(async () => {
      await scheduleCalendarRefresh();
    });

    await registerCommands();

    await renderCalendar();
    await hidePanel();
  },
});
