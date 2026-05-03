import { DEFAULT_ZEN_MODE_TITLE_FORMAT } from "./constants";
import { getLocales } from "./localization";
import type { CalendarDate, WeekStart } from "./types";

const DAYS_IN_WEEK = 7;
const REFERENCE_WEEK_YEAR = 2026;
const REFERENCE_WEEK_MONTH = 0;
const REFERENCE_WEEK_MONDAY_DAY = 5;
const WEEKDAY_FORMAT_FALLBACK_WARNING = "Failed to format weekday with plugin locales.";
const DATE_FORMAT_EXPRESSION_PATTERN = /\{\{\s*([^{}]*?)\s*\}\}/g;
const ISO_WEEKDAY_SHIFT = 3;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const WEEKDAY_SHORT_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    weekday: "short",
};

const WEEKDAY_LONG_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    weekday: "long",
};

export function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

export function formatDateId(
    year: number,
    month: number,
    day: number,
): string {
    return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export function parseDateId(dateId: string): CalendarDate {
    const [year, month, day] = dateId.split("-").map(Number);

    return {
        year,
        month: month - 1,
        day,
    };
}

function getDateTokenValues(date: CalendarDate): Array<[string, string]> {
    const year = String(date.year);
    const shortYear = year.slice(-2);
    const month = date.month + 1;
    const day = date.day;

    return [
        ["YYYY", year],
        ["yyyy", year],
        ["YY", shortYear],

        ["MM", pad2(month)],
        ["mm", pad2(month)],
        ["M", String(month)],
        ["m", String(month)],

        ["DD", pad2(day)],
        ["dd", pad2(day)],
        ["D", String(day)],
        ["d", String(day)],
    ];
}

export function formatDateExpression(
    date: CalendarDate,
    expression: string,
): string {
    const tokenValues = getDateTokenValues(date);
    let result = "";
    let index = 0;

    while (index < expression.length) {
        const matchedToken = tokenValues.find(([token]) =>
            expression.startsWith(token, index),
        );

        if (matchedToken) {
            const [token, value] = matchedToken;
            result += value;
            index += token.length;
            continue;
        }

        result += expression[index];
        index += 1;
    }

    return result;
}

function renderDatePattern(date: CalendarDate, pattern: string): string {
    return pattern.replace(
        DATE_FORMAT_EXPRESSION_PATTERN,
        (_match, expression: string) =>
            formatDateExpression(date, expression.trim()),
    );
}

export function formatDateByPattern(
    date: CalendarDate,
    pattern: string,
): string {
    const source = pattern.trim();
    const normalizedPattern = source || DEFAULT_ZEN_MODE_TITLE_FORMAT;
    const normalized = renderDatePattern(date, normalizedPattern).trim();

    if (normalized) {
        return normalized;
    }

    return renderDatePattern(date, DEFAULT_ZEN_MODE_TITLE_FORMAT).trim();
}

export function startOfLocalDayMs(dateId: string): number {
    const { year, month, day } = parseDateId(dateId);
    return new Date(year, month, day, 0, 0, 0, 0).getTime();
}

export function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

export function quarterName(month: number): string {
    return `Q${Math.floor(month / 3) + 1}`;
}

export function isoWeekNumber(date: CalendarDate): number {
    const utcDate = Date.UTC(date.year, date.month, date.day);
    const currentDate = new Date(utcDate);
    const day = currentDate.getUTCDay() || DAYS_IN_WEEK;

    currentDate.setUTCDate(currentDate.getUTCDate() + ISO_WEEKDAY_SHIFT - day);

    const firstThursday = new Date(Date.UTC(currentDate.getUTCFullYear(), 0, 4));
    const firstThursdayDay = firstThursday.getUTCDay() || DAYS_IN_WEEK;

    firstThursday.setUTCDate(
        firstThursday.getUTCDate() + ISO_WEEKDAY_SHIFT - firstThursdayDay,
    );

    return Math.floor((currentDate.getTime() - firstThursday.getTime()) / MS_IN_DAY / DAYS_IN_WEEK) + 1;
}

export function weekOffset(date: Date, weekStart: WeekStart): number {
    if (weekStart === "sunday") {
        return date.getDay();
    }

    return (date.getDay() + 6) % 7;
}

function createWeekdayFormatter(
    options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
    try {
        return new Intl.DateTimeFormat(getLocales(), options);
    } catch (error) {
        console.warn(WEEKDAY_FORMAT_FALLBACK_WARNING, error);
        return new Intl.DateTimeFormat(undefined, options);
    }
}

function referenceWeekDate(dayOffset: number): Date {
    return new Date(
        REFERENCE_WEEK_YEAR,
        REFERENCE_WEEK_MONTH,
        REFERENCE_WEEK_MONDAY_DAY + dayOffset,
    );
}

export function weekdayLongName(weekStart: WeekStart): string {
    const sundayOffset = DAYS_IN_WEEK - 1;
    const dayOffset = weekStart === "sunday" ? sundayOffset : 0;

    return createWeekdayFormatter(WEEKDAY_LONG_FORMAT_OPTIONS).format(
        referenceWeekDate(dayOffset),
    );
}

export function weekdayLabels(weekStart: WeekStart): string[] {
    const formatter = createWeekdayFormatter(WEEKDAY_SHORT_FORMAT_OPTIONS);
    const mondayFirst = Array.from({ length: DAYS_IN_WEEK }, (_, dayOffset) =>
        formatter.format(referenceWeekDate(dayOffset)),
    );

    if (weekStart === "sunday") {
        return [mondayFirst[DAYS_IN_WEEK - 1], ...mondayFirst.slice(0, -1)];
    }

    return mondayFirst;
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
