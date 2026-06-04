import type {
  RepeatFrequency,
  TaskMetadata,
} from "../core/types";

export const TASK_METADATA_USER_DATA_KEY = "calendar-notes:task";

const EMPTY_METADATA: TaskMetadata = {};

function isRepeatFrequency(value: unknown): value is RepeatFrequency {
  return value === "daily"
    || value === "weekly"
    || value === "monthly"
    || value === "yearly";
}

function normalizeRepeat(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const repeat = value as TaskMetadata["repeat"];

  if (!repeat || !isRepeatFrequency(repeat.frequency)) {
    return undefined;
  }

  return {
    id: typeof repeat.id === "string" && repeat.id.trim()
      ? repeat.id
      : createRepeatId(),
    frequency: repeat.frequency,
    interval: Number.isInteger(repeat.interval) && repeat.interval > 0
      ? repeat.interval
      : 1,
  };
}

export function normalizeTaskMetadata(value: unknown): TaskMetadata {
  if (!value || typeof value !== "object") {
    return EMPTY_METADATA;
  }

  const metadata = value as TaskMetadata;
  const repeat = normalizeRepeat(metadata.repeat);
  const normalized: TaskMetadata = {};

  if (repeat) {
    normalized.repeat = repeat;
  }

  return normalized;
}

export function createRepeatId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
