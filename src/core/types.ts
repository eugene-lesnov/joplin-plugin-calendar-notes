export type WeekStart = "monday" | "sunday";

export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RepeatRule = {
  id: string;
  frequency: RepeatFrequency;
  interval: number;
};

export type TaskMetadata = {
  repeat?: RepeatRule;
};

export type CalendarMessage =
  | { name: "selectDate"; date: string }
  | { name: "openNote"; id: string }
  | { name: "createNote"; date: string }
  | { name: "createTask"; date: string }
  | { name: "toggleTask"; id: string; completed: boolean }
  | { name: "setTaskRepeat"; id: string }
  | { name: "clearTaskRepeat"; id: string }
  | { name: "toggleOverdueTasks" }
  | { name: "prevWeek" }
  | { name: "nextWeek" }
  | { name: "prevMonth" }
  | { name: "nextMonth" }
  | { name: "today" }
  | { name: "refresh" };

export type PanelHtmlMessage = {
  name: "setPanelHtml";
  html: string;
};

export type NoteSummary = {
  id: string;
  title: string;
  parent_id?: string;
  body?: string;
  metadata?: TaskMetadata;
  deleted_time?: number;
  created_time?: number;
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

export type AgendaDayData = {
  dateId: string;
  notes: NoteSummary[];
  tasks: NoteSummary[];
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
  notebookNotesPath: string;
  notebookNotesPathPattern: string;
  noteTemplatePath: string;
  tasksPath: string;
  completedTasksPath: string;
  taskTemplatePath: string;
};

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};
