import { DEFAULT_DAY_IDENTIFIER_FORMAT } from "./constants";
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

export function getTodayDateId(): string {
    const today = new Date();

    return formatDateId(today.getFullYear(), today.getMonth(), today.getDate());
}

export function parseDateId(dateId: string): CalendarDate {
    const [year, month, day] = dateId.split("-").map(Number);

    return {
        year,
        month: month - 1,
        day,
    };
}

type DateField = "year" | "month" | "day";

type CompiledDatePattern = {
    regex: RegExp;
    fields: DateField[];
};

const DATE_TOKEN_REGEX_FRAGMENTS: Array<[string, string, DateField]> = [
    ["YYYY", "(\\d{4})", "year"],
    ["yyyy", "(\\d{4})", "year"],
    ["YY", "(\\d{2})", "year"],
    ["MM", "(\\d{2})", "month"],
    ["mm", "(\\d{2})", "month"],
    ["M", "(\\d{1,2})", "month"],
    ["m", "(\\d{1,2})", "month"],
    ["DD", "(\\d{2})", "day"],
    ["dd", "(\\d{2})", "day"],
    ["D", "(\\d{1,2})", "day"],
    ["d", "(\\d{1,2})", "day"],
];

const compiledDatePatternCache = new Map<string, CompiledDatePattern | null>();

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileDateExpression(expression: string): {
    source: string;
    fields: DateField[];
} {
    let source = "";
    const fields: DateField[] = [];
    let index = 0;

    while (index < expression.length) {
        const matchedToken = DATE_TOKEN_REGEX_FRAGMENTS.find(([token]) =>
            expression.startsWith(token, index),
        );

        if (matchedToken) {
            const [token, fragment, field] = matchedToken;
            source += fragment;
            fields.push(field);
            index += token.length;
            continue;
        }

        source += escapeRegExp(expression[index]);
        index += 1;
    }

    return { source, fields };
}

function compileDatePattern(pattern: string): CompiledDatePattern | null {
    const source = pattern.trim() || DEFAULT_DAY_IDENTIFIER_FORMAT;
    const fields: DateField[] = [];
    const expressionPattern = new RegExp(
        DATE_FORMAT_EXPRESSION_PATTERN.source,
        "g",
    );
    let regexSource = "^";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = expressionPattern.exec(source)) !== null) {
        regexSource += escapeRegExp(source.slice(lastIndex, match.index));

        const compiled = compileDateExpression(match[1].trim());
        regexSource += compiled.source;
        fields.push(...compiled.fields);
        lastIndex = match.index + match[0].length;
    }

    regexSource += escapeRegExp(source.slice(lastIndex));

    if (
        !fields.includes("year")
        || !fields.includes("month")
        || !fields.includes("day")
    ) {
        return null;
    }

    return { regex: new RegExp(regexSource), fields };
}

function getCompiledDatePattern(pattern: string): CompiledDatePattern | null {
    const cached = compiledDatePatternCache.get(pattern);

    if (cached !== undefined) {
        return cached;
    }

    const compiled = compileDatePattern(pattern);
    compiledDatePatternCache.set(pattern, compiled);

    return compiled;
}

export function parseDateFromTitle(
    title: string,
    pattern: string,
): CalendarDate | null {
    const compiled = getCompiledDatePattern(pattern);

    if (!compiled) {
        return null;
    }

    const match = compiled.regex.exec(title);

    if (!match) {
        return null;
    }

    let year = 0;
    let month = 0;
    let day = 0;

    for (let groupIndex = 0; groupIndex < compiled.fields.length; groupIndex++) {
        const value = Number(match[groupIndex + 1]);
        const field = compiled.fields[groupIndex];

        if (field === "year") {
            year = value;
        } else if (field === "month") {
            month = value;
        } else {
            day = value;
        }
    }

    if (year < 100) {
        year += 2000;
    }

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month - 1)) {
        return null;
    }

    return { year, month: month - 1, day };
}

export function momentFormatToPattern(format: string): string {
    const normalized = format.trim();

    if (!normalized) {
        return DEFAULT_DAY_IDENTIFIER_FORMAT;
    }

    return `{{${normalized}}}`;
}

export function getDateTokenValues(date: CalendarDate): Array<[string, string]> {
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

function formatExpression(
    tokenValues: Array<[string, string]>,
    expression: string,
): string {
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

export function formatDateExpression(
    date: CalendarDate,
    expression: string,
): string {
    return formatExpression(getDateTokenValues(date), expression);
}

export function getTimeTokenValues(date: Date): Array<[string, string]> {
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = date.getMinutes();
    const meridiem = hours24 < 12 ? "AM" : "PM";

    return [
        ["HH", pad2(hours24)],
        ["H", String(hours24)],
        ["hh", pad2(hours12)],
        ["h", String(hours12)],
        ["mm", pad2(minutes)],
        ["m", String(minutes)],
        ["A", meridiem],
        ["a", meridiem.toLowerCase()],
    ];
}

export function formatTimeExpression(
    date: Date,
    expression: string,
): string {
    const tokenValues = getTimeTokenValues(date);
    let result = "";
    let segment = "";
    let index = 0;

    while (index < expression.length) {
        if (expression[index] === "[") {
            const closingIndex = expression.indexOf("]", index + 1);

            if (closingIndex < 0) {
                segment += expression[index];
                index += 1;
                continue;
            }

            result += formatExpression(tokenValues, segment);
            result += expression.slice(index + 1, closingIndex);
            segment = "";
            index = closingIndex + 1;
            continue;
        }

        segment += expression[index];
        index += 1;
    }

    return result + formatExpression(tokenValues, segment);
}

function renderDatePattern(date: CalendarDate, pattern: string): string {
    return pattern.replace(
        DATE_FORMAT_EXPRESSION_PATTERN,
        (_match, expression: string) =>
            formatDateExpression(date, expression.trim()),
    );
}

function renderTimePattern(date: Date, pattern: string): string {
    return pattern.replace(
        DATE_FORMAT_EXPRESSION_PATTERN,
        (_match, expression: string) =>
            formatTimeExpression(date, expression.trim()),
    );
}

export function formatDateByPattern(
    date: CalendarDate,
    pattern: string,
): string {
    const source = pattern.trim();
    const normalizedPattern = source || DEFAULT_DAY_IDENTIFIER_FORMAT;
    const normalized = renderDatePattern(date, normalizedPattern).trim();

    if (normalized) {
        return normalized;
    }

    return renderDatePattern(date, DEFAULT_DAY_IDENTIFIER_FORMAT).trim();
}

export function formatTimeByPattern(date: Date, pattern: string): string {
    return renderTimePattern(date, pattern).trim();
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
