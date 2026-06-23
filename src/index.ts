import joplin from "api";
import { MenuItemLocation, ToolbarButtonLocation } from "api/types";

import {
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
} from "./core/constants";
import strings, { getLocales, setLocale } from "./core/localization";
import { isMobilePlatform } from "./core/platform";
import {
  clearCalendarNoteCaches,
  clearTaskRepeat,
  createCalendarNoteForDate,
  createCalendarTaskForDate,
  invalidateTaskMetadataCache,
  setCalendarTaskCompleted,
  setTaskRepeat,
  syncCalendarTaskCompletionLocation,
} from "./notes/notes";
import {
  activateFastTaggedTasksPolling,
  addCreatedCalendarNote,
  addCreatedCalendarTask,
  goToNextMonth,
  goToPrevMonth,
  goToToday,
  hasStaleVisibleCalendarNoteMarkers,
  invalidateCalendarMonthCacheForNoteChange,
  patchVisibleCalendarNoteChange,
  patchVisibleCalendarNotes,
  refreshVisibleCalendar,
  renderCalendar,
  scheduleCalendarRefresh,
  selectCalendarDate,
  shouldRefreshCalendarForNoteChange,
  showCalendarPanel,
  toggleOverdueTasks,
  setupPanel,
  toggleCalendarPanel,
  toggleTaggedTaskGroup,
  toggleTaggedTasks,
} from "./panel/panel";
import { registerSettings } from "./settings/settings";
import type {
  CalendarMessage,
  NoteChangeEvent,
  NoteSelectionChangeEvent,
  PanelMessage,
} from "./core/types";

const TOGGLE_COMMAND = "toggleCalendarNotes";
const TOGGLE_TOOLBAR_BUTTON_ID = "toggleCalendarNotesToolbarButton";
const TOGGLE_MENU_ITEM_ID = "toggleCalendarNotesMenuItem";
const JOPLIN_LOCALE_SETTING_KEY = "locale";

let previousSelectedNoteIds: string[] = [];
let taskCompletionQueue = Promise.resolve();

const RENDER_AFFECTING_SETTINGS = [
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
];

async function shouldOpenCreatedItem(): Promise<boolean> {
  return !(await isMobilePlatform());
}

async function enqueueTaskCompletion(operation: () => Promise<void>): Promise<void> {
  const nextOperation = taskCompletionQueue.then(operation, operation);
  taskCompletionQueue = nextOperation.catch(() => undefined);

  return nextOperation;
}

async function handlePanelMessage(message: CalendarMessage): Promise<PanelMessage | void> {
  activateFastTaggedTasksPolling();

  if (message.name === "selectDate") {
    return selectCalendarDate(message.date);
  }

  if (message.name === "openNote") {
    await joplin.commands.execute("openNote", message.id);

    if (await isMobilePlatform()) {
      await joplin.commands.execute("dismissPluginPanels");
    }

    return;
  }

  if (message.name === "createNote") {
    const note = await createCalendarNoteForDate(
      message.date,
      undefined,
      await shouldOpenCreatedItem(),
    );

    return addCreatedCalendarNote(message.date, note);
  }

  if (message.name === "createTask") {
    const task = await createCalendarTaskForDate(
      message.date,
      undefined,
      await shouldOpenCreatedItem(),
    );

    return addCreatedCalendarTask(message.date, task);
  }

  if (message.name === "toggleTask") {
    await enqueueTaskCompletion(() =>
      setCalendarTaskCompleted(message.id, !message.completed),
    );
    return renderCalendar();
  }

  if (message.name === "setTaskRepeat") {
    if (await isMobilePlatform()) {
      await joplin.commands.execute("dismissPluginPanels");
      await setTaskRepeat(message.id);
      await showCalendarPanel();
      return;
    }

    await setTaskRepeat(message.id);
    return renderCalendar();
  }

  if (message.name === "clearTaskRepeat") {
    await clearTaskRepeat(message.id);
    return renderCalendar();
  }

  if (message.name === "toggleOverdueTasks") {
    return toggleOverdueTasks();
  }

  if (message.name === "toggleTaggedTasks") {
    return toggleTaggedTasks();
  }

  if (message.name === "toggleTaggedTaskGroup") {
    return toggleTaggedTaskGroup(message.tagId);
  }

  if (message.name === "prevMonth") {
    return goToPrevMonth();
  }

  if (message.name === "nextMonth") {
    return goToNextMonth();
  }

  if (message.name === "today") {
    return goToToday();
  }

  if (message.name === "refresh") {
    return refreshVisibleCalendar();
  }

  if (message.name === "patchVisibleNotes") {
    return patchVisibleCalendarNotes(message.ids);
  }
}

async function handleNoteChange(event: NoteChangeEvent): Promise<void> {
  activateFastTaggedTasksPolling();
  invalidateTaskMetadataCache(event.id);
  await invalidateCalendarMonthCacheForNoteChange(event.id, event.event);

  const isMobile = await isMobilePlatform();

  if (isMobile && await patchVisibleCalendarNoteChange(event.id, event.event)) {
    return;
  }

  try {
    await syncCalendarTaskCompletionLocation(event.id);
  } catch (error) {
    console.warn("Failed to sync calendar task completion location.", error);
  }

  if (await shouldRefreshCalendarForNoteChange(event.id, event.event)) {
    await scheduleCalendarRefresh();
  }
}

async function handleNoteSelectionChange(
  event: NoteSelectionChangeEvent,
): Promise<void> {
  if (!(await isMobilePlatform())) {
    activateFastTaggedTasksPolling();
  }

  const selectedNoteIds = event.value ?? [];
  const selectedNoteIdSet = new Set(selectedNoteIds);
  const deselectedNoteIds = previousSelectedNoteIds.filter(
    (noteId) => !selectedNoteIdSet.has(noteId),
  );

  previousSelectedNoteIds = selectedNoteIds;

  if (await hasStaleVisibleCalendarNoteMarkers(deselectedNoteIds)) {
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
        clearCalendarNoteCaches();
        await renderCalendar();
      }
    });

    await joplin.workspace.onNoteChange(handleNoteChange);
    await joplin.workspace.onNoteSelectionChange(handleNoteSelectionChange);
    await joplin.workspace.onSyncComplete(async () => {
      activateFastTaggedTasksPolling();
      clearCalendarNoteCaches();
      await scheduleCalendarRefresh();
    });

    await registerCommands();

    await renderCalendar();
  },
});
