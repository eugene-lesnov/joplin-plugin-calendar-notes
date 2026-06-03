# Calendar Notes

A Joplin plugin that adds a calendar panel for daily notes.

## Features

- Calendar panel toggled from the toolbar or **Tools → Toggle Calendar**.
- Days with existing notes are highlighted.
- Click a day to select it; a section below the calendar lists that day's notes and provides a `+ New note` button.
- Simple presets for date format and new note titles.
- Automatic notebook structure for new calendar notes using a notebook path and an optional nested structure.
- Optional template note with placeholders (`{{title}}`, `{{date}}`, `{{time}}`, `{{YYYY}}`, `{{MM}}`, `{{dd}}`, `{{date:dd.MM.YYYY}}`, …).
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
| Calendar notes notebook | Notebook path for new notes, e.g. `Calendar Notes`; missing notebooks are created automatically |
| Nested notebook structure | Optional path inside the calendar notes notebook, e.g. `{{year}}/{{month}}` |
| New note template | Joplin note used as a body template, e.g. `Templates/Calendar note` |

## How notes are matched

Notes are matched only inside the configured calendar notes notebook and its nested notebooks. A note belongs to a day when its title starts with the selected date format, so renamed notes like `25.01.2026 meeting` remain visible for that day. New notes are created in the configured calendar notes notebook. If a nested structure is set, missing nested notebooks are created automatically.

## License

MIT
