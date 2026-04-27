# Calendar Notes

Calendar Notes is a Joplin plugin that adds a small calendar panel for opening or creating day-based notes.

Use it as a lightweight daily journal, work log, meeting diary, or any workflow where one note should represent one calendar day.

## Features

- Open a calendar from the note toolbar or the **Tools** menu.
- Click any day to open the note for that date.
- Automatically create the note if it does not exist yet.
- Highlight calendar days that already have matching notes.
- Navigate between months and jump back to today.
- Configure the note title format.
- Choose whether the week starts on Monday or Sunday.
- Store new calendar notes in a dedicated notebook path.
- Use an existing Joplin note as a template for newly created calendar notes.
- Supports English and Russian UI text.

## Requirements

- Joplin **3.5** or newer.

## Installation

### From Joplin

When the plugin is available in the Joplin plugin registry:

1. Open **Tools → Options → Plugins**.
2. Search for **Calendar Notes**.
3. Install the plugin and restart Joplin if prompted.

### Manual installation

1. Download the plugin `.jpl` file from the release artifacts.
2. Open **Tools → Options → Plugins**.
3. Choose **Install from file**.
4. Select the downloaded `.jpl` file.
5. Restart Joplin if prompted.

## Usage

1. Click the calendar button in the note toolbar, or use **Tools → Toggle Calendar**.
2. The calendar panel opens with the current month.
3. Click a day:
   - if a matching note already exists, it is opened;
   - otherwise, a new note is created and opened.
4. Use **Previous**, **Next**, and **Today** to navigate the calendar.
5. Use **Refresh** if you want to update calendar markers manually.

## How notes are matched

Calendar Notes identifies existing notes by their title.

For each visible day, the plugin builds the expected title using the configured note title format. If a note with exactly that title exists anywhere in Joplin, the day is marked as having a note.

By default, notes are named using this format:

```text
{{YYYY-MM-dd}}
```

For example, the note for January 5, 2026 is created as:

```text
2026-01-05
```

> Existing calendar notes are searched globally by title in all notebooks. New notes are created in the configured notebook path, or in the currently selected notebook if no path is configured.

## Settings

Open **Tools → Options → Calendar Notes** to configure the plugin.

### Note title format

Controls how calendar note titles are generated.

Date expressions must be wrapped in `{{...}}`. Text outside the braces is kept as-is.

Examples:

```text
{{YYYY-MM-dd}}
Daily note {{dd.MM.YYYY}}
Journal / {{YYYY}}-{{MM}}-{{dd}}
```

Supported date tokens:

| Token | Meaning | Example |
| --- | --- | --- |
| `YYYY`, `yyyy` | Four-digit year | `2026` |
| `YY` | Two-digit year | `26` |
| `MM`, `mm` | Two-digit month | `01` |
| `M`, `m` | Month without leading zero | `1` |
| `DD`, `dd` | Two-digit day | `05` |
| `D`, `d` | Day without leading zero | `5` |

### Week starts on

Controls the first day of the week in the calendar panel.

Available values:

- Monday
- Sunday

### Calendar notes notebook path

Controls where new calendar notes are created.

Example:

```text
Calendar Notes/2026
```

If the path does not exist, the plugin creates the missing notebooks automatically.

If this setting is empty, new notes are created in the currently selected notebook. If no notebook is selected, Joplin's first available notebook is used as a fallback.

Notebook paths may use `/` or `\` as separators.

### New calendar note template path

Allows using an existing Joplin note as the body template for newly created calendar notes.

Example:

```text
Templates/Calendar note
```

If this setting is empty, new calendar notes are created with an empty body.

The value is a Joplin note path. The last path segment is treated as the template note title, and the previous segments are treated as notebook names.

## Template placeholders

Template note bodies support placeholders that are replaced when a calendar note is created.

Example template:

```markdown
# {{title}}

Date: {{date}}

## Plan

- 

## Notes


## Summary

```

Supported placeholders:

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `{{title}}`, `{{noteTitle}}` | Generated note title | `2026-01-05` |
| `{{date}}`, `{{isoDate}}` | ISO date | `2026-01-05` |
| `{{YYYY}}`, `{{yyyy}}` | Four-digit year | `2026` |
| `{{YY}}` | Two-digit year | `26` |
| `{{MM}}`, `{{mm}}` | Two-digit month | `01` |
| `{{M}}`, `{{m}}` | Month without leading zero | `1` |
| `{{DD}}`, `{{dd}}` | Two-digit day | `05` |
| `{{D}}`, `{{d}}` | Day without leading zero | `5` |
| `{{date:dd.MM.YYYY}}` | Custom date expression | `05.01.2026` |

The `date:` placeholder accepts the same date tokens as the note title format.

The build process creates the plugin package in the generated publish output used by the Joplin plugin tooling.

## License

MIT
