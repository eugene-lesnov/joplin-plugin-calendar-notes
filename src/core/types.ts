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
  | { name: "toggleTaggedTasks" }
  | { name: "toggleTaggedTaskGroup"; tagId: string }
  | { name: "prevMonth" }
  | { name: "nextMonth" }
  | { name: "today" }
  | { name: "refresh" }
  | { name: "patchVisibleNotes"; ids: string[] };

export type PanelHtmlMessage = {
  name: "setPanelHtml";
  html: string;
};

export type PatchVisibleNoteMessage = {
  name: "patchVisibleNote";
  id: string;
  title: string;
  text: string;
  overdueText: string;
};

export type PatchVisibleNotesMessage = {
  name: "patchVisibleNotes";
  patches: PatchVisibleNoteMessage[];
};

export type PanelMessage = PanelHtmlMessage | PatchVisibleNoteMessage | PatchVisibleNotesMessage;

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

export type TaggedTaskGroup = {
  tagId: string;
  tagName: string;
  tasks: NoteSummary[];
};

export type TaggedTasksResult = {
  groups: TaggedTaskGroup[];
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
  taggedTasksTags: string;
};

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};
