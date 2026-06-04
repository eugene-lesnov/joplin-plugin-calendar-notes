# Calendar Notes

A Joplin plugin that adds a calendar panel for daily notes.

## Features

- Calendar panel toggled from the toolbar or **Tools → Toggle Calendar**.
- Days with existing notes or tasks are highlighted.
- Click a day to select it; sections below the calendar list that day's tasks and notes.
- Create Joplin todo tasks for a selected day, complete them from the calendar panel, configure simple recurring tasks, see task reminders, and keep overdue tasks visible in one place.
- Simple presets for date format and new note titles.
- Separate notebooks and nested structures for calendar notes and tasks.
- Optional note and task templates with placeholders (`{{title}}`, `{{date}}`, `{{time}}`, `{{YYYY}}`, `{{MM}}`, `{{dd}}`, `{{date:dd.MM.YYYY}}`, …).
- Week starts on Monday or Sunday.
- English and Russian UI.

## Requirements

Joplin **3.5** or newer.

## Installation

**From Joplin:** Tools → Options → Plugins → search for *Calendar Notes*.

**Manual:** Tools → Options → Plugins → *Install from file* → select the `.jpl` file.

## Settings

| Setting | Purpose |
| --- | --- |
| Date format | How the date is written in calendar note titles, e.g. `25.01.2026`, `2026-01-25`, `01/25/2026` |
| New note title | Title preset for notes created by the plugin: date and time, or date with automatic numbering |
| Week starts on | Monday or Sunday |
| Notes: notebook | Notebook path for new calendar notes, e.g. `Calendar notes`; missing notebooks are created automatically |
| Notes: nested notebooks | Optional path inside the notes notebook, e.g. `{{year}}/{{month}}` |
| Notes: new note template | Joplin note used as a body template for new notes, e.g. `Templates/Calendar note` |
| Tasks: notebook | Notebook path for new todo tasks, e.g. `Tasks`; missing notebooks are created automatically |
| Tasks: nested notebooks | Optional path inside the tasks notebook, e.g. `{{year}}/{{month}}` |
| Tasks: new task template | Joplin note used as a body template for new todo tasks, e.g. `Templates/Calendar task` |

## How notes are matched

Notes are matched only inside the configured notes notebook and its nested notebooks. Joplin todo tasks are matched only inside the configured tasks notebook and its nested notebooks. An item belongs to a day when its title starts with the selected date format, so renamed items like `25.01.2026 meeting` remain visible for that day. New notes and tasks are created in their own configured notebooks. If a nested structure is set, missing nested notebooks are created automatically.

## Recurring tasks

Recurring tasks are ordinary Joplin todo notes with plugin metadata stored in synced Joplin user data. Use the `↻` button in the calendar panel to choose daily, weekly, monthly, or yearly repetition for a task. When a repeated task is completed, the next one is created. If the task has a reminder, the next task keeps the same reminder offset from the task date, so reminders set before or after the task day stay intentional.

## License

MIT
