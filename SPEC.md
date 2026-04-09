# Obsidian LLM Annotations Plugin — Specification

## Overview

An Obsidian plugin that lets you highlight passages in a markdown file and attach feedback annotations intended for an LLM (like Claude Code). You build up multiple annotations, then copy a compiled summary to your clipboard in an LLM-optimized format. Designed for the workflow of iterating on writing/speech/messages with an LLM.

---

## Core Concepts

- **Annotation**: A pairing of a highlighted text range in the editor + a user-written feedback string.
- **Annotations are ephemeral**: They are not persisted to disk. They live only in memory for the current session. The user creates them, copies the compiled output, then clears them.
- **Single-file scope**: Annotations are always scoped to the currently active file.

---

## User Workflow

1. User is editing a markdown file.
2. User selects some text, sees a small tooltip near the selection with an "Annotate" button.
3. User clicks the button (or uses hotkey `Cmd+Shift+M`). The sidebar opens (if not already open) and a new annotation entry appears in the sidebar with the highlighted text shown and a text area focused for the user to type their feedback.
4. The selected text in the editor is now highlighted with a mark decoration.
5. User repeats steps 2-4 for as many annotations as they want.
6. User clicks the "Copy All" button in the sidebar. The plugin compiles all annotations into an LLM-optimized format and copies it to the clipboard.
7. User pastes into Claude Code or another LLM interface.
8. User clicks "Clear All" in the sidebar to remove all annotations and highlights.

---

## UI Components

### 1. Selection Tooltip

- When the user selects text in the editor, a small floating tooltip appears near the selection.
- The tooltip contains a single button: **"Annotate"** (with a small icon, e.g. a pencil or speech bubble).
- Clicking the button creates a new annotation for the selected range and opens/focuses the sidebar.
- The tooltip disappears when the selection is cleared or the user clicks elsewhere.

### 2. Sidebar Panel (Custom View)

The sidebar is a right-side leaf view toggled via:
- A **ribbon icon** in the left ribbon bar.
- A **command palette** command: "LLM Annotations: Toggle sidebar".

#### Sidebar Contents

**Header area:**
- Plugin title/icon.
- **"Copy All"** button — compiles all annotations into LLM-optimized format and copies to clipboard. Shows a brief "Copied!" confirmation. Disabled when there are no annotations.
- **"Clear All"** button — removes all annotations and highlights after a confirmation. Disabled when there are no annotations.
- **Highlight color picker** — a small color input that lets the user change the highlight color used for all annotation marks. Default: a semi-transparent yellow (e.g. `rgba(255, 235, 59, 0.35)`).

**Annotation list:**
- Annotations are listed in **document order** (by position of the highlighted text, top-to-bottom).
- Each annotation card shows:
  - **Highlighted text excerpt** — the annotated passage, truncated with ellipsis if very long (e.g. > 150 chars), shown in a styled quote block or muted text.
  - **Feedback text area** — an editable text area containing the user's feedback. The user can edit this at any time.
  - **Copy button** — copies the compiled output for just this single annotation to the clipboard (same format as the full compilation, but only this one entry).
  - **Delete button** — removes this annotation and its editor highlight.
- Clicking on an annotation card scrolls the editor to the highlighted passage.
- When the user **hovers over a highlighted region** in the editor, the corresponding annotation card in the sidebar should be visually emphasized (e.g. a border highlight or background flash) so the user can see which sidebar entry it maps to.

### 3. Editor Highlights

- Highlighted annotations in the editor use **CodeMirror 6 mark decorations** via a `StateField`.
- All highlights use the same color, controlled by the sidebar color picker.
- Highlights should be visually distinct but not obscure the text (semi-transparent background).

---

## Commands & Hotkeys

| Command | Default Hotkey | Description |
|---|---|---|
| `llm-annotations:annotate-selection` | `Cmd+Shift+M` | Create an annotation from the current text selection. Opens sidebar if closed. |
| `llm-annotations:toggle-sidebar` | (none) | Toggle the annotation sidebar panel. |
| `llm-annotations:copy-all` | (none) | Compile and copy all annotations to clipboard. |
| `llm-annotations:clear-all` | (none) | Clear all annotations for the current file. |

## Right-Click Context Menu

- When text is selected in the editor, the right-click context menu includes an **"Annotate Selection"** option.
- This behaves identically to the hotkey / tooltip button.

---

## Compiled Output Format

When the user copies (single or all), the output is formatted for LLM consumption:

### Copy All

```
File: <filename.md>

---

[Lines X-Y] "the exact highlighted text here"
Feedback: The user's annotation/feedback text here.

---

[Lines X-Y] "another highlighted passage"
Feedback: Another annotation here.
```

- `Lines X-Y` refers to the line numbers in the file where the highlighted text appears.
- The highlighted text is quoted exactly as it appears in the document.
- Annotations are ordered by document position (top-to-bottom).
- Each annotation is separated by `---`.

### Copy Individual

Same format but only the single annotation entry (still includes the `File:` header).

---

## Technical Architecture

### Plugin Class (`main.ts`)

- Extends `Plugin`.
- On load:
  - Register the sidebar view.
  - Register commands (annotate, toggle sidebar, copy all, clear all).
  - Register the editor context menu item.
  - Register the CodeMirror 6 editor extension (StateField for decorations + tooltip via ViewPlugin).
- Maintains an in-memory `Map<string, Annotation[]>` keyed by file path for managing annotations per file.

### Annotation Data Model

```typescript
interface Annotation {
  id: string;             // unique identifier (e.g. UUID)
  filePath: string;       // path of the file
  from: number;           // start offset in the document (character position)
  to: number;             // end offset in the document (character position)
  highlightedText: string; // the exact selected text at creation time
  feedback: string;       // the user's annotation text (editable)
}
```

- `from` and `to` are document character offsets, used for CodeMirror decorations.
- `highlightedText` is captured at annotation creation time and used in the compiled output. If the underlying text changes (edits), the highlight positions should update via CodeMirror transaction mapping, but the displayed `highlightedText` in the sidebar remains as originally captured.

### CodeMirror 6 Integration

**StateField for decorations:**
- A `StateField<DecorationSet>` that reads the current file's annotations and builds mark decorations for each.
- The field subscribes to a custom `StateEffect` that signals when annotations change (added, removed, color changed).
- On document changes, annotation offsets (`from`/`to`) are updated via `transaction.changes.mapPos()` to keep highlights in sync with edits.

**Tooltip for selection:**
- A `ViewPlugin` or `StateField` that shows a tooltip widget near the current selection when text is selected.
- The tooltip contains an "Annotate" button that dispatches the annotation creation.

**Highlight color:**
- The mark decoration applies a CSS class with a dynamic background-color.
- When the user changes the color, all decorations are rebuilt with the new color.

### Sidebar View

- Extends `ItemView`.
- View type: `llm-annotations-sidebar`.
- Renders the list of annotations for the active file.
- Listens for active file changes and re-renders.
- Provides the Copy All, Clear All, and color picker controls.
- Each annotation card has: excerpt display, editable textarea, copy button, delete button.
- Clicking a card scrolls the editor to that annotation's position.
- Communicates with the main plugin to add/remove/edit annotations and trigger StateEffect dispatches to update editor decorations.

### Hover Linkage (Editor ↔ Sidebar)

- When hovering over a highlighted range in the editor, the plugin identifies which annotation it belongs to and signals the sidebar to highlight that card (e.g. via a CSS class or scroll-into-view).
- Implementation: A `ViewPlugin` with an `eventHandlers` for `mousemove` that checks if the cursor is within an annotation range, then notifies the sidebar via a shared event emitter or direct reference.

---

## Settings

This plugin does not need a dedicated settings tab. All configuration (highlight color) is managed directly in the sidebar.

---

## File Structure

```
obsidian-llm-annotations/
  manifest.json
  package.json
  tsconfig.json
  esbuild.config.mjs
  styles.css
  src/
    main.ts              # Plugin entry point
    types.ts             # Annotation interface and shared types
    annotationStore.ts   # In-memory annotation store (Map-based)
    sidebarView.ts       # ItemView for the sidebar panel
    editorExtension.ts   # CM6 StateField, effects, decorations, tooltip
    compiler.ts          # Compiles annotations into LLM-optimized text
    utils.ts             # Helpers (ID generation, line number calculation, etc.)
  styles.css             # Highlight styles, sidebar styles, tooltip styles
```

---

## Edge Cases & Considerations

- **Overlapping selections**: If the user tries to annotate text that overlaps with an existing annotation, allow it. Multiple annotations can overlap; each gets its own entry in the sidebar.
- **Empty selection**: If no text is selected when the annotate command fires, do nothing (or show a brief notice: "Select text first").
- **File switching**: When switching to a different file, the sidebar updates to show annotations for the new active file. Annotations for other files remain in memory.
- **File closing**: Annotations persist in memory even if the file tab is closed, as long as Obsidian is running. They are gone on plugin reload / app restart (ephemeral by design).
- **Large selections**: The sidebar shows a truncated excerpt (first ~150 characters with "...") but the full text is used in the compiled output.
- **Document edits**: Annotation positions are remapped on every transaction via `mapPos`. If an edit deletes the entire annotated range, the annotation should be automatically removed.
- **No annotations state**: The sidebar shows a helpful empty state message like "Select text and press Cmd+Shift+M to add an annotation."

---

## Dependencies

- `obsidian` — Obsidian API.
- `@codemirror/state` — StateField, StateEffect, Transaction.
- `@codemirror/view` — EditorView, Decoration, ViewPlugin, WidgetType, Tooltip.
- Standard Obsidian plugin build tooling (esbuild, TypeScript).
