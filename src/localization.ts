export interface AppLocalization {
  settingsSectionLabel: string;
  noteTitleFormatLabel: string;
  noteTitleFormatDescription: string;
  weekStartLabel: string;
  weekStartDescription: string;
  calendarNotesPathLabel: string;
  calendarNotesPathDescription: string;
  noteTemplateLabel: string;
  noteTemplateDescription: string;
  toggleCalendarCommandLabel: string;
  loadingCalendar: string;
  openNoteTitle: string;
  createNoteTitle: string;
  previousMonthTitle: string;
  nextMonthTitle: string;
  todayButtonLabel: string;
  refreshCalendarButtonLabel: string;
  refreshCalendarTitle: string;
  createCalendarNoteNoNotebookError: string;
  createCalendarNoteTemplateReadError: string;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const defaultStrings: AppLocalization = {
  settingsSectionLabel: "Calendar Notes",
  noteTitleFormatLabel: "Note title format",
  noteTitleFormatDescription:
    "Format for created/opened calendar notes. Put date expressions in {{...}}; text outside is used as-is. Supported tokens inside {{...}}: YYYY/yyyy, YY, MM/mm, M/m, dd/DD, d/D. Example: Calendar {{dd.mm.YYYY}}.",
  weekStartLabel: "Week starts on",
  weekStartDescription: "Controls the first day of week in the calendar panel.",
  calendarNotesPathLabel: "Calendar notes notebook path",
  calendarNotesPathDescription:
    "Notebook path where new calendar notes are created. Example: Calendar Notes/2026. If empty, new notes are created in the selected notebook. Existing calendar notes are searched globally by title in all notebooks.",
  noteTemplateLabel: "New calendar note template path",
  noteTemplateDescription:
    "Joplin note path used as a template for new calendar notes. Example: Templates/Calendar note. If empty, the note body is empty. The template note body supports placeholders: {{title}}, {{date}}, {{YYYY}}, {{YY}}, {{MM}}, {{M}}, {{dd}}, {{d}}, {{date:dd.mm.YYYY}}.",
  toggleCalendarCommandLabel: "Toggle Calendar",
  loadingCalendar: "Loading calendar...",
  openNoteTitle: "Open note \"{{title}}\"",
  createNoteTitle: "Create note \"{{title}}\"",
  previousMonthTitle: "Previous month",
  nextMonthTitle: "Next month",
  todayButtonLabel: "Today",
  refreshCalendarButtonLabel: "Refresh",
  refreshCalendarTitle: "Refresh calendar note markers",
  createCalendarNoteNoNotebookError:
    "Cannot create a calendar note: no notebook was found.",
  createCalendarNoteTemplateReadError:
    "Cannot create a calendar note: failed to find or read template note {{path}}.",
};

const localizations: Record<string, Partial<AppLocalization>> = {
  ru: {
    settingsSectionLabel: "Calendar Notes",
    noteTitleFormatLabel: "Формат заголовка заметки",
    noteTitleFormatDescription:
      "Формат заголовков календарных заметок при создании и открытии. Выражения даты пишите в {{...}}, обычный текст - без скобок. Поддерживаемые токены внутри {{...}}: YYYY/yyyy, YY, MM/mm, M/m, dd/DD, d/D. Пример: Календарь {{dd.mm.YYYY}}.",
    weekStartLabel: "Первый день недели",
    weekStartDescription: "Определяет, с какого дня начинается неделя в календаре.",
    calendarNotesPathLabel: "Путь к блокноту с календарными заметками",
    calendarNotesPathDescription:
      "Путь к блокноту, в котором будут создаваться новые календарные заметки. Пример: Календарные заметки/2026. Если оставить поле пустым, новые заметки будут создаваться в выбранном блокноте. Уже существующие календарные заметки ищутся по заголовку во всех блокнотах.",
    noteTemplateLabel: "Путь к заметке-шаблону новой календарной заметки",
    noteTemplateDescription:
      "Путь к заметке Joplin, которая используется как шаблон для новых календарных заметок. Пример: Шаблоны/Календарная заметка. Если поле пустое, заметка будет создана без текста. Тело заметки-шаблона поддерживает подстановки: {{title}}, {{date}}, {{YYYY}}, {{YY}}, {{MM}}, {{M}}, {{dd}}, {{d}}, {{date:dd.mm.YYYY}}.",
    toggleCalendarCommandLabel: "Показать или скрыть календарь",
    loadingCalendar: "Загрузка календаря...",
    openNoteTitle: "Открыть заметку \"{{title}}\"",
    createNoteTitle: "Создать заметку \"{{title}}\"",
    previousMonthTitle: "Предыдущий месяц",
    nextMonthTitle: "Следующий месяц",
    todayButtonLabel: "Сегодня",
    refreshCalendarButtonLabel: "Обновить",
    refreshCalendarTitle: "Обновить отметки календарных заметок",
    createCalendarNoteNoNotebookError: "Не удалось создать календарную заметку: блокнот не найден.",
    createCalendarNoteTemplateReadError:
      "Не удалось создать календарную заметку: не получилось найти или прочитать заметку-шаблон {{path}}.",
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
    // Локали Joplin могут использовать формат ro_RO, а navigator.languages - ro-RO.
    // Нормализуем к формату, совместимому с Intl.
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
