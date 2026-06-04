import {
  daysInMonth,
  formatDateId,
  parseDateId,
} from "../core/dateUtils";
import type { RepeatFrequency, RepeatRule } from "../core/types";

function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  );
}

function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const targetDay = Math.min(
    date.getDate(),
    daysInMonth(targetYear, targetMonth),
  );

  return new Date(targetYear, targetMonth, targetDay);
}

function addYearsClamped(date: Date, years: number): Date {
  const targetYear = date.getFullYear() + years;
  const targetMonth = date.getMonth();
  const targetDay = Math.min(
    date.getDate(),
    daysInMonth(targetYear, targetMonth),
  );

  return new Date(targetYear, targetMonth, targetDay);
}

function addRepeatInterval(date: Date, frequency: RepeatFrequency, interval: number): Date {
  if (frequency === "daily") {
    return addDays(date, interval);
  }

  if (frequency === "weekly") {
    return addDays(date, interval * 7);
  }

  if (frequency === "monthly") {
    return addMonthsClamped(date, interval);
  }

  return addYearsClamped(date, interval);
}

function dateIdToLocalDate(dateId: string): Date {
  const { year, month, day } = parseDateId(dateId);
  return new Date(year, month, day);
}

function localDateToDateId(date: Date): string {
  return formatDateId(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getNextRepeatDateId(
  dateId: string,
  repeat: RepeatRule,
  todayId: string,
): string {
  const interval = repeat.interval > 0 ? repeat.interval : 1;
  let nextDate = addRepeatInterval(
    dateIdToLocalDate(dateId),
    repeat.frequency,
    interval,
  );

  while (localDateToDateId(nextDate) <= todayId) {
    nextDate = addRepeatInterval(nextDate, repeat.frequency, interval);
  }

  return localDateToDateId(nextDate);
}


export function shiftAlarmToDate(
  alarmTime: number | undefined,
  sourceDateId: string,
  nextDateId: string,
): number | undefined {
  if (!alarmTime || alarmTime <= 0) {
    return undefined;
  }

  const sourceDate = dateIdToLocalDate(sourceDateId);
  const nextDate = dateIdToLocalDate(nextDateId);
  const alarmDate = new Date(alarmTime);
  const alarmDateOnly = new Date(
    alarmDate.getFullYear(),
    alarmDate.getMonth(),
    alarmDate.getDate(),
  );
  const dayOffset = Math.round(
    (alarmDateOnly.getTime() - sourceDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  const shiftedDate = addDays(nextDate, dayOffset);

  return new Date(
    shiftedDate.getFullYear(),
    shiftedDate.getMonth(),
    shiftedDate.getDate(),
    alarmDate.getHours(),
    alarmDate.getMinutes(),
    alarmDate.getSeconds(),
    alarmDate.getMilliseconds(),
  ).getTime();
}
