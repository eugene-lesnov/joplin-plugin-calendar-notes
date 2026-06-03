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
  calendarNotesPathLabel: string;
  calendarNotesPathDescription: string;
  calendarNotesPathPatternLabel: string;
  calendarNotesPathPatternDescription: string;
  noteTemplateLabel: string;
  noteTemplateDescription: string;
  taskTemplateLabel: string;
  taskTemplateDescription: string;
  toggleCalendarCommandLabel: string;
  loadingCalendar: string;
  createDateNoteTitle: string;
  previousMonthTitle: string;
  nextMonthTitle: string;
  todayButtonLabel: string;
  selectedTasksLabel: string;
  selectedNotesLabel: string;
  createTaskButtonLabel: string;
  createNoteButtonLabel: string;
  noTasksForDayLabel: string;
  noNotesForDayLabel: string;
  newTaskDefaultTitle: string;
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
  calendarNotesPathLabel: "Calendar notes notebook",
  calendarNotesPathDescription:
    "Where new calendar notes are created. If the notebook does not exist, it will be created.",
  calendarNotesPathPatternLabel: "Nested notebook structure",
  calendarNotesPathPatternDescription:
    "Optional nested notebooks inside the main notebook. Example: {{year}}/{{month}}. Leave empty to create notes directly in the main notebook.",
  noteTemplateLabel: "New note template",
  noteTemplateDescription:
    "Joplin note to use as the text template for new notes. Example: Templates/Calendar note. Available: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
  taskTemplateLabel: "New task template",
  taskTemplateDescription:
    "Joplin note to use as the text template for new tasks. Example: Templates/Calendar task. Available: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
  toggleCalendarCommandLabel: "Toggle Calendar",
  loadingCalendar: "Loading calendar...",
  createDateNoteTitle: "Select notes for \"{{title}}\"",
  previousMonthTitle: "Previous month",
  nextMonthTitle: "Next month",
  todayButtonLabel: "Today",
  selectedTasksLabel: "Tasks for {{date}}:",
  selectedNotesLabel: "Notes for {{date}}:",
  createTaskButtonLabel: "+ New task",
  createNoteButtonLabel: "+ New note",
  noTasksForDayLabel: "No tasks yet.",
  noNotesForDayLabel: "No notes yet.",
  newTaskDefaultTitle: "New task",
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
    calendarNotesPathLabel: "Блокнот для календарных заметок",
    calendarNotesPathDescription:
      "Куда создавать новые календарные заметки. Если блокнота нет, он будет создан.",
    calendarNotesPathPatternLabel: "Структура вложенных блокнотов",
    calendarNotesPathPatternDescription:
      "Необязательные вложенные блокноты внутри основного блокнота. Пример: {{year}}/{{month}}. Оставьте пустым, чтобы создавать заметки прямо в основном блокноте.",
    noteTemplateLabel: "Шаблон новой заметки",
    noteTemplateDescription:
      "Заметка Joplin, из которой брать текст для новых заметок. Пример: Шаблоны/Календарная заметка. Доступно: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
    taskTemplateLabel: "Шаблон новой задачи",
    taskTemplateDescription:
      "Заметка Joplin, из которой брать текст для новых задач. Пример: Шаблоны/Календарная задача. Доступно: {{title}}, {{date}}, {{time}}, {{YYYY}}, {{MM}}, {{dd}}, {{date:dd.mm.YYYY}}.",
    toggleCalendarCommandLabel: "Показать или скрыть календарь",
    loadingCalendar: "Загрузка календаря...",
    createDateNoteTitle: "Показать заметки за \"{{title}}\"",
    previousMonthTitle: "Предыдущий месяц",
    nextMonthTitle: "Следующий месяц",
    todayButtonLabel: "Сегодня",
    selectedTasksLabel: "Задачи за {{date}}:",
    selectedNotesLabel: "Заметки за {{date}}:",
    createTaskButtonLabel: "+ Новая задача",
    createNoteButtonLabel: "+ Новая заметка",
    noTasksForDayLabel: "Задач пока нет.",
    noNotesForDayLabel: "Заметок пока нет.",
    newTaskDefaultTitle: "Новая задача",
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
