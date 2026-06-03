export type WeekStart = "monday" | "sunday";

export type CalendarMessage =
  | { name: "selectDate"; date: string }
  | { name: "openNote"; id: string }
  | { name: "createNote"; date: string }
  | { name: "createTask"; date: string }
  | { name: "toggleTask"; id: string; completed: boolean }
  | { name: "toggleOverdueTasks" }
  | { name: "prevMonth" }
  | { name: "nextMonth" }
  | { name: "today" };

export type NoteSummary = {
  id: string;
  title: string;
  parent_id?: string;
  deleted_time?: number;
  is_todo?: number;
  todo_completed?: number;
  todo_due?: number;
};

export type CalendarTaskWithDate = {
  task: NoteSummary;
  dateId: string;
};

export type ExistingCalendarNoteMarkers = {
  datesByNoteId: Map<string, string>;
  noteCountsByDate: Map<string, number>;
  notesByDate: Map<string, NoteSummary[]>;
  tasksByDate: Map<string, NoteSummary[]>;
  overdueTasks: CalendarTaskWithDate[];
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
  dayIdentifierFormat: string;
  newNoteTitleFormat: string;
  weekStart: WeekStart;
  calendarNotesPath: string;
  calendarNotesPathPattern: string;
  calendarNoteTemplatePath: string;
  calendarTaskTemplatePath: string;
};

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};
