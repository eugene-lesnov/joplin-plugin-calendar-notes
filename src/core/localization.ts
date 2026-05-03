export interface AppLocalization {
  settingsSectionLabel: string;
  noteModeLabel: string;
  noteModeDescription: string;
  zenModeLabel: string;
  flowModeLabel: string;
  zenModeTitleFormatLabel: string;
  zenModeTitleFormatDescription: string;
  flowModeTitleFormatLabel: string;
  flowModeTitleFormatDescription: string;
  weekStartLabel: string;
  weekStartDescription: string;
  calendarNotesPathLabel: string;
  calendarNotesPathDescription: string;
  calendarNotesPathPatternLabel: string;
  calendarNotesPathPatternDescription: string;
  noteTemplateLabel: string;
  noteTemplateDescription: string;
  toggleCalendarCommandLabel: string;
  loadingCalendar: string;
  openNoteTitle: string;
  createNoteTitle: string;
  createDateNoteTitle: string;
  previousMonthTitle: string;
  nextMonthTitle: string;
  todayButtonLabel: string;
  refreshCalendarTitle: string;
  selectedDayLabel: string;
  createNoteButtonLabel: string;
  noNotesForDayLabel: string;
  createCalendarNoteNoNotebookError: string;
  createCalendarNoteTemplateReadError: string;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const defaultStrings: AppLocalization = {
  settingsSectionLabel: "Calendar Notes",
  noteModeLabel: "Mode",
  noteModeDescription:
    "Choose how a calendar day is represented: as a single note (Zen mode) or as a stream of notes (Flow mode).",
  zenModeLabel: "Zen mode: one note per day",
  flowModeLabel: "Flow mode: multiple notes per day",
  zenModeTitleFormatLabel: "Zen mode: note title format",
  zenModeTitleFormatDescription:
    "Format used in Zen mode for the single note of a day. The same value is also substituted as {{zenModeTitle}} in the Flow mode title format, so it must uniquely identify the day. Put date expressions in {{...}}; plain text outside the braces is kept as-is. Supported tokens inside {{...}}: YYYY/yyyy, YY, MM/mm, M/m, dd/DD, d/D. Example: Calendar {{dd.mm.YYYY}}.",
  flowModeTitleFormatLabel: "Flow mode: note title format",
  flowModeTitleFormatDescription:
    "Format used in Flow mode for each note of a day. Must contain {{zenModeTitle}} — it expands to the title produced by the Zen mode format, allowing the plugin to reliably match notes to a day. Supported placeholders: {{zenModeTitle}}, {{date}}, {{time}}, {{YYYY}}, {{YY}}, {{MM}}, {{M}}, {{dd}}, {{d}}, {{date:dd.mm.YYYY}}. Default: {{zenModeTitle}} - {{time}}.",
  weekStartLabel: "Week starts on",
  weekStartDescription: "Controls the first day of week in the calendar panel.",
  calendarNotesPathLabel: "Calendar notes root notebook path",
  calendarNotesPathDescription:
    "Root notebook path for new calendar notes. Default: Calendar Notes. The plugin creates missing notebooks automatically. Existing calendar notes are searched globally by title in all notebooks.",
  calendarNotesPathPatternLabel: "Calendar notes path pattern",
  calendarNotesPathPatternDescription:
    "Relative notebook path under the root notebook. Supported placeholders: {{year}}, {{month}}, {{quarter}}, {{week}}. Leave empty to create new notes directly in the root notebook without nested notebooks.",
  noteTemplateLabel: "New calendar note template path",
  noteTemplateDescription:
    "Joplin note path used as a template for new calendar notes. Example: Templates/Calendar note. If empty, the note body is empty. The template note body supports placeholders: {{title}}, {{date}}, {{YYYY}}, {{YY}}, {{MM}}, {{M}}, {{dd}}, {{d}}, {{date:dd.mm.YYYY}}.",
  toggleCalendarCommandLabel: "Toggle Calendar",
  loadingCalendar: "Loading calendar...",
  openNoteTitle: "Open note \"{{title}}\"",
  createNoteTitle: "Create note \"{{title}}\"",
  createDateNoteTitle: "Create a new note for \"{{title}}\"",
  previousMonthTitle: "Previous month",
  nextMonthTitle: "Next month",
  todayButtonLabel: "Today",
  refreshCalendarTitle: "Refresh calendar note markers",
  selectedDayLabel: "Notes for {{date}}:",
  createNoteButtonLabel: "+ New note",
  noNotesForDayLabel: "No notes yet.",
  createCalendarNoteNoNotebookError:
    "Cannot create a calendar note: no notebook was found.",
  createCalendarNoteTemplateReadError:
    "Cannot create a calendar note: failed to find or read template note {{path}}.",
};

const localizations: Record<string, Partial<AppLocalization>> = {
  ru: {
    settingsSectionLabel: "Calendar Notes",
    noteModeLabel: "Режим",
    noteModeDescription:
      "Определяет, как отображается календарный день: как одна заметка (Дзен) или как поток заметок (Поток).",
    zenModeLabel: "Дзен: одна заметка на день",
    flowModeLabel: "Поток: несколько заметок на день",
    zenModeTitleFormatLabel: "Дзен: формат заголовка заметки",
    zenModeTitleFormatDescription:
      "Формат заголовка для режима Дзен — единственной заметки дня. Тот же заголовок подставляется как {{zenModeTitle}} в формате режима Поток, поэтому он должен однозначно соответствовать дню. Выражения даты пишите в {{...}}, обычный текст вне скобок остаётся как есть. Поддерживаемые токены внутри {{...}}: YYYY/yyyy, YY, MM/mm, M/m, dd/DD, d/D. Пример: Календарь {{dd.mm.YYYY}}.",
    flowModeTitleFormatLabel: "Поток: формат заголовка заметки",
    flowModeTitleFormatDescription:
      "Формат заголовка для режима Поток — каждой заметки дня. Должен содержать {{zenModeTitle}} — он подставляет заголовок, полученный по формату режима Дзен, чтобы плагин мог связывать заметки с конкретным днём. Поддерживаемые подстановки: {{zenModeTitle}}, {{date}}, {{time}}, {{YYYY}}, {{YY}}, {{MM}}, {{M}}, {{dd}}, {{d}}, {{date:dd.mm.YYYY}}.",
    weekStartLabel: "Первый день недели",
    weekStartDescription: "Определяет, с какого дня начинается неделя в календаре.",
    calendarNotesPathLabel: "Корневой путь к блокноту с календарными заметками",
    calendarNotesPathDescription:
      "Корневой путь для новых календарных заметок. По умолчанию: Calendar Notes. Плагин автоматически создает отсутствующие блокноты. Уже существующие календарные заметки ищутся по заголовку во всех блокнотах.",
    calendarNotesPathPatternLabel: "Шаблон пути календарных заметок",
    calendarNotesPathPatternDescription:
      "Относительный путь к блокноту внутри корневого пути. Поддерживаемые подстановки: {{year}}, {{month}}, {{quarter}}, {{week}}. Если оставить поле пустым, новые заметки будут создаваться в корневом блокноте без вложенных блокнотов.",
    noteTemplateLabel: "Путь к заметке-шаблону новой календарной заметки",
    noteTemplateDescription:
      "Путь к заметке Joplin, которая используется как шаблон для новых календарных заметок. Пример: Шаблоны/Календарная заметка. Если поле пустое, заметка будет создана без текста. Тело заметки-шаблона поддерживает подстановки: {{title}}, {{date}}, {{YYYY}}, {{YY}}, {{MM}}, {{M}}, {{dd}}, {{d}}, {{date:dd.mm.YYYY}}.",
    toggleCalendarCommandLabel: "Показать или скрыть календарь",
    loadingCalendar: "Загрузка календаря...",
    openNoteTitle: "Открыть заметку \"{{title}}\"",
    createNoteTitle: "Создать заметку \"{{title}}\"",
    createDateNoteTitle: "Создать новую заметку за \"{{title}}\"",
    previousMonthTitle: "Предыдущий месяц",
    nextMonthTitle: "Следующий месяц",
    todayButtonLabel: "Сегодня",
    refreshCalendarTitle: "Обновить отметки календарных заметок",
    selectedDayLabel: "Заметки за {{date}}:",
    createNoteButtonLabel: "+ Новая заметка",
    noNotesForDayLabel: "Заметок пока нет.",
    createCalendarNoteNoNotebookError: "Не удалось создать календарную заметку: блокнот не найден.",
    createCalendarNoteTemplateReadError:
      "Не удалось создать календарную заметку: не получилось найти или прочитать заметку-шаблон {{path}}",
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
