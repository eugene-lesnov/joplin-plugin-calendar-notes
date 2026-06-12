export interface AppLocalization {
  settingsSectionLabel: string;
  dayIdentifierFormatLabel: string;
  dayIdentifierFormatDescription: string;
  dayIdentifierFormatDotsLabel: string;
  dayIdentifierFormatIsoLabel: string;
  dayIdentifierFormatSlashesLabel: string;
  dayIdentifierFormatUsLabel: string;
  dayIdentifierFormatCompactLabel: string;
  dayIdentifierFormatDashesEuLabel: string;
  dayIdentifierFormatDashesUsLabel: string;
  newNoteTitleFormatLabel: string;
  newNoteTitleFormatDescription: string;
  newNoteTitleFormatDateAndTimeLabel: string;
  newNoteTitleFormatDateOnlyLabel: string;
  weekStartLabel: string;
  weekStartDescription: string;
  defaultNotebookNotesPath: string;
  defaultTasksPath: string;
  defaultCompletedTasksPath: string;
  notebookNotesPathLabel: string;
  notebookNotesPathDescription: string;
  notebookNotesPathPatternLabel: string;
  notebookNotesPathPatternDescription: string;
  noteTemplateLabel: string;
  noteTemplateDescription: string;
  tasksPathLabel: string;
  tasksPathDescription: string;
  completedTasksPathLabel: string;
  completedTasksPathDescription: string;
  taskTemplateLabel: string;
  taskTemplateDescription: string;
  toggleCalendarCommandLabel: string;
  loadingCalendar: string;
  createDateNoteTitle: string;
  previousMonthTitle: string;
  nextMonthTitle: string;
  todayButtonLabel: string;
  overdueTasksLabel: string;
  showAllOverdueTasksLabel: string;
  hideOverdueTasksLabel: string;
  selectedDayLabel: string;
  tasksSectionLabel: string;
  notesSectionLabel: string;
  createTaskButtonLabel: string;
  createNoteButtonLabel: string;
  newTaskDefaultTitle: string;
  taskRepeatDialogTitle: string;
  taskRepeatNoneLabel: string;
  taskRepeatDailyLabel: string;
  taskRepeatWeeklyLabel: string;
  taskRepeatMonthlyLabel: string;
  taskRepeatYearlyLabel: string;
  taskRepeatMetaLabel: string;
  taskRepeatClearHint: string;
  taskAlarmTitleLabel: string;
  createCalendarNoteNoNotebookError: string;
  createCalendarNoteTemplateReadError: string;
  createCalendarTaskTemplateReadError: string;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const defaultStrings: AppLocalization = {
  settingsSectionLabel: "Calendar Notes",
  dayIdentifierFormatLabel: "Date format",
  dayIdentifierFormatDescription:
    "Date format in note titles. The plugin uses this date to understand which day a note belongs to.",
  dayIdentifierFormatDotsLabel: "25.01.2026",
  dayIdentifierFormatIsoLabel: "2026-01-25",
  dayIdentifierFormatSlashesLabel: "25/01/2026",
  dayIdentifierFormatUsLabel: "01/25/2026",
  dayIdentifierFormatCompactLabel: "20260125",
  dayIdentifierFormatDashesEuLabel: "25-01-2026",
  dayIdentifierFormatDashesUsLabel: "01-25-2026",
  newNoteTitleFormatLabel: "New note title",
  newNoteTitleFormatDescription:
    "How notes created from the calendar will be named.",
  newNoteTitleFormatDateAndTimeLabel: "Date and time, e.g. 25.01.2026 - 14:30",
  newNoteTitleFormatDateOnlyLabel: "Date with automatic numbering, e.g. 25.01.2026, 25.01.2026 (2)",
  weekStartLabel: "Week starts on",
  weekStartDescription: "First day of week in the calendar.",
  defaultNotebookNotesPath: "Calendar notes",
  defaultTasksPath: "Tasks",
  defaultCompletedTasksPath: "Completed tasks",
  notebookNotesPathLabel: "Notes: notebook",
  notebookNotesPathDescription:
    "Where new calendar notes are created. If the notebook does not exist, it will be created.",
  notebookNotesPathPatternLabel: "Notes: nested notebooks",
  notebookNotesPathPatternDescription:
    "Optional nested notebooks for notes. Example: {{year}}/{{month}}. Leave empty to create notes directly in the notes notebook.",
  noteTemplateLabel: "Notes: new note template",
  noteTemplateDescription:
    "Joplin note to use as the text template for new notes. Example: Templates/Calendar note. Available: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
  tasksPathLabel: "Tasks: notebook",
  tasksPathDescription:
    "Where new active tasks are created and searched. If the notebook does not exist, it will be created.",
  completedTasksPathLabel: "Tasks: completed notebook",
  completedTasksPathDescription:
    "Where completed tasks are moved. If the notebook does not exist, it will be created.",
  taskTemplateLabel: "Tasks: new task template",
  taskTemplateDescription:
    "Joplin note to use as the text template for new tasks. Example: Templates/Calendar task. Available: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
  toggleCalendarCommandLabel: "Toggle Calendar",
  loadingCalendar: "Loading calendar...",
  createDateNoteTitle: "Select notes for {{title}}",
  previousMonthTitle: "Previous month",
  nextMonthTitle: "Next month",
  todayButtonLabel: "Today",
  overdueTasksLabel: "Overdue tasks: {{count}}",
  showAllOverdueTasksLabel: "Show all",
  hideOverdueTasksLabel: "Hide",
  selectedDayLabel: "{{date}}",
  tasksSectionLabel: "Tasks",
  notesSectionLabel: "Notes",
  createTaskButtonLabel: "+ New task",
  createNoteButtonLabel: "+ New note",
  newTaskDefaultTitle: "New task",
  taskRepeatDialogTitle: "Task repeat",
  taskRepeatNoneLabel: "Do not repeat",
  taskRepeatDailyLabel: "Every day",
  taskRepeatWeeklyLabel: "Every week",
  taskRepeatMonthlyLabel: "Every month",
  taskRepeatYearlyLabel: "Every year",
  taskRepeatMetaLabel: "Repeats: {{repeat}}",
  taskRepeatClearHint: "Right-click to remove repeat.",
  taskAlarmTitleLabel: "Reminder: {{alarm}}. Calendar day: {{date}}.",
  createCalendarNoteNoNotebookError:
    "Cannot create a calendar note: no notebook was found.",
  createCalendarNoteTemplateReadError:
    "Cannot create a calendar note: failed to find or read template note {{path}}.",
  createCalendarTaskTemplateReadError:
    "Cannot create a calendar task: failed to find or read template note {{path}}.",
};

const localizations: Record<string, Partial<AppLocalization>> = {
  ru: {
    settingsSectionLabel: "Calendar Notes",
    dayIdentifierFormatLabel: "Формат даты",
    dayIdentifierFormatDescription:
      "Формат даты в названии заметки. Плагин использует эту дату, чтобы понять, к какому дню относится заметка.",
    dayIdentifierFormatDotsLabel: "25.01.2026",
    dayIdentifierFormatIsoLabel: "2026-01-25",
    dayIdentifierFormatSlashesLabel: "25/01/2026",
    dayIdentifierFormatUsLabel: "01/25/2026",
    dayIdentifierFormatCompactLabel: "20260125",
    dayIdentifierFormatDashesEuLabel: "25-01-2026",
    dayIdentifierFormatDashesUsLabel: "01-25-2026",
    newNoteTitleFormatLabel: "Название новой заметки",
    newNoteTitleFormatDescription:
      "Как будут называться заметки, созданные из календаря.",
    newNoteTitleFormatDateAndTimeLabel: "Дата и время, например 25.01.2026 - 14:30",
    newNoteTitleFormatDateOnlyLabel: "Дата с автонумерацией, например 25.01.2026, 25.01.2026 (2)",
    weekStartLabel: "Первый день недели",
    weekStartDescription: "Первый день недели в календаре.",
    defaultNotebookNotesPath: "Календарные заметки",
    defaultTasksPath: "Задачи",
    defaultCompletedTasksPath: "Завершенные задачи",
    notebookNotesPathLabel: "Заметки: блокнот",
    notebookNotesPathDescription:
      "Куда создавать новые календарные заметки. Если блокнота нет, он будет создан.",
    notebookNotesPathPatternLabel: "Заметки: вложенные блокноты",
    notebookNotesPathPatternDescription:
      "Необязательные вложенные блокноты для заметок. Пример: {{year}}/{{month}}. Оставьте пустым, чтобы создавать заметки прямо в блокноте заметок.",
    noteTemplateLabel: "Заметки: шаблон новой заметки",
    noteTemplateDescription:
      "Заметка Joplin, из которой брать текст для новых заметок. Пример: Шаблоны/Календарная заметка. Доступно: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
    tasksPathLabel: "Задачи: блокнот",
    tasksPathDescription:
      "Куда создавать новые активные задачи и где их искать. Если блокнота нет, он будет создан.",
    completedTasksPathLabel: "Задачи: блокнот завершенных",
    completedTasksPathDescription:
      "Куда переносить завершенные задачи. Если блокнота нет, он будет создан.",
    taskTemplateLabel: "Задачи: шаблон новой задачи",
    taskTemplateDescription:
      "Заметка Joplin, из которой брать текст для новых задач. Пример: Шаблоны/Календарная задача. Доступно: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
    toggleCalendarCommandLabel: "Показать или скрыть календарь",
    loadingCalendar: "Загрузка календаря...",
    createDateNoteTitle: "Показать заметки за {{title}}",
    previousMonthTitle: "Предыдущий месяц",
    nextMonthTitle: "Следующий месяц",
    todayButtonLabel: "Сегодня",
    overdueTasksLabel: "Просроченные задачи: {{count}}",
    showAllOverdueTasksLabel: "Показать все",
    hideOverdueTasksLabel: "Скрыть",
    selectedDayLabel: "{{date}}",
    tasksSectionLabel: "Задачи",
    notesSectionLabel: "Заметки",
    createTaskButtonLabel: "+",
    createNoteButtonLabel: "+",
    newTaskDefaultTitle: "Новая задача",
    taskRepeatDialogTitle: "Повтор задачи",
    taskRepeatNoneLabel: "Не повторять",
    taskRepeatDailyLabel: "Каждый день",
    taskRepeatWeeklyLabel: "Каждую неделю",
    taskRepeatMonthlyLabel: "Каждый месяц",
    taskRepeatYearlyLabel: "Каждый год",
    taskRepeatMetaLabel: "Повтор: {{repeat}}",
    taskRepeatClearHint: "ПКМ — удалить повтор.",
    taskAlarmTitleLabel: "Напоминание: {{alarm}}. День задачи: {{date}}.",
    createCalendarNoteNoNotebookError: "Не удалось создать календарную заметку: блокнот не найден.",
    createCalendarNoteTemplateReadError:
      "Не удалось создать календарную заметку: не получилось найти или прочитать заметку-шаблон {{path}}",
    createCalendarTaskTemplateReadError:
      "Не удалось создать календарную задачу: не получилось найти или прочитать заметку-шаблон {{path}}",
  },
};

let supportedLanguages: string[] = [];

const strings: AppLocalization = { ...defaultStrings };

const getNavigatorLanguages = (): readonly string[] => {
  if (typeof navigator === "undefined") {
    return [];
  }

  if (navigator.languages?.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
};

const normalizeLocale = (locale: string): string => locale.replace("_", "-");

const getLanguageCode = (locale: string): string | undefined => {
  const localeSeparatorIndex = locale.indexOf("-");

  return localeSeparatorIndex === -1 ? undefined : locale.substring(0, localeSeparatorIndex);
};

const getSupportedLanguages = (locales: readonly string[]): string[] => {
  const languages: string[] = [];

  for (const locale of locales) {
    const normalizedLocale = normalizeLocale(locale);
    languages.push(normalizedLocale);

    const languageCode = getLanguageCode(normalizedLocale);

    if (languageCode) {
      languages.push(languageCode);
    }
  }

  return languages;
};

const findLocalization = (languages: readonly string[]): Partial<AppLocalization> => {
  for (const language of languages) {
    const localization = localizations[language];

    if (localization) {
      return localization;
    }
  }

  return {};
};

const applyLocalization = (localization: Partial<AppLocalization>) => {
  Object.assign(strings, defaultStrings, localization);
};

export const setLocale = (supportedLocales: readonly string[] | string) => {
  const locales = typeof supportedLocales === "string" ? [supportedLocales] : supportedLocales;
  const languages = getSupportedLanguages(locales);

  supportedLanguages = languages;
  applyLocalization(findLocalization(languages));
};

setLocale(getNavigatorLanguages());

export const getLocales = () => {
  return [...supportedLanguages];
};

export const formatLocalizedString = (
  template: string,
  values: Record<string, string | number>,
): string => {
  return template.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
};

export default strings;
