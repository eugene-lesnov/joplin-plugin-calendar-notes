export type WeekStart = "monday" | "sunday";

export type CalendarMessage =
  | { name: "openDate"; date: string }
  | { name: "prevMonth" }
  | { name: "nextMonth" }
  | { name: "today" }
  | { name: "refresh" };

export type NoteSummary = {
  id: string;
  title: string;
  parent_id?: string;
  deleted_time?: number;
};

export type ExistingCalendarNoteMarkers = {
  dates: Set<string>;
  datesByNoteId: Map<string, string>;
};

export type NoteChangeEvent = {
  id: string;
  event: number;
};

export type NoteSelectionChangeEvent = {
  value?: string[];
};

export type FolderSummary = {
  id: string;
  title: string;
  parent_id?: string;
};

export type CalendarSettings = {
  noteTitleFormat: string;
  weekStart: WeekStart;
  calendarNotesPath: string;
  calendarNoteTemplatePath: string;
};

export type CalendarDate = {
  year: number;
  // январь = 0
  month: number;
  day: number;
};
