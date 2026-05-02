# Calendar Notes

A Joplin plugin that adds a calendar panel for daily notes.

## Modes

- **Zen** — one note per day. Click a day -> open or create the day's note.
- **Flow** — multiple notes per day. Click a day -> select it; a section below the calendar lists that day's notes (click to open) and provides a `+ New note` button.

Switch modes in **Tools → Options → Calendar Notes**.

## Features

- Calendar panel toggled from the toolbar or **Tools → Toggle Calendar**.
- Days with existing notes are highlighted.
- Configurable note title formats (Zen and Flow).
- Configurable target notebook path for new calendar notes.
- Optional template note with placeholders (`{{title}}`, `{{date}}`, `{{time}}`, `{{YYYY}}`, `{{MM}}`, `{{dd}}`, `{{date:dd.MM.YYYY}}`, …).
- Week starts on Monday or Sunday.
- English and Russian UI.

## Requirements

Joplin **3.5** or newer.

## Installation

**From Joplin:** Tools → Options → Plugins → search for *Calendar Notes*.

**Manual:** Tools → Options → Plugins → *Install from file* → select the `.jpl` file.

## Settings

| Setting | Purpose                                                                                       |
| --- |-----------------------------------------------------------------------------------------------|
| Mode | Zen (one note/day) or Flow (multiple notes/day)                                               |
| Zen mode title format | Title for the day's note, e.g. `{{YYYY-MM-dd}}`                                               |
| Flow mode title format | Title for each Flow note; must contain `{{zenModeTitle}}`, e.g. `{{zenModeTitle}} - {{time}}` |
| Week starts on | Monday or Sunday                                                                              |
| Calendar notes notebook path | Existing notebook path where new notes are created, e.g. `Calendar Notes/2026`; leave empty to use the selected notebook |
| New calendar note template path | Joplin note used as a body template, e.g. `Templates/Calendar note`                           |

Each setting includes inline help in Joplin with the full list of supported tokens.

## How notes are matched

Notes are matched globally by title using the configured format. New notes are created in the configured notebook path if it exists, or in the selected notebook if the path is empty.

## License

MIT
