# Obsidian LLM Annotations Plugin

> **Keep this file up to date.** Whenever you add a feature, change a command, modify the architecture, or make any change that would make this file inaccurate, update the relevant sections of this CLAUDE.md before finishing the task.

## What It Does

An Obsidian plugin for iterating on writing with an LLM. Users highlight passages in a markdown file, attach feedback annotations, then copy a compiled LLM-optimized summary to clipboard for pasting into Claude Code or similar.

## Core Workflow

1. Select text in editor → floating "Annotate" tooltip appears (or run the "Annotate selection" command, which users bind to a hotkey in Settings → Hotkeys — no default hotkey is shipped, per Obsidian plugin guidelines)
2. Sidebar opens with a new annotation card; user types feedback in the textarea
3. Repeat for multiple passages
4. "Copy all" compiles annotations into structured format with file name, line numbers, quoted text, and feedback
5. "Clear all" removes all annotations

## Key Design Decisions

- **Ephemeral annotations**: Not persisted to disk. In-memory only, lost on plugin reload/app restart.
- **Single-file scope**: Annotations are keyed by file path. Sidebar shows annotations for the active file.
- **CM6 decorations**: Highlights use a `StateField<DecorationSet>` with mark decorations. Positions update via `mapPos()` on doc changes.
- **Hover linkage**: Hovering a highlight in the editor visually emphasizes the corresponding sidebar card, and vice versa.
- **Before/After diffs**: When the document text under an annotation changes (e.g., after Claude Code edits), the sidebar card shows a "Changed" badge with before/after excerpts. The `currentText` field on each annotation is updated in `updatePositions()` by slicing the new doc text at the mapped offsets.

## Architecture

```
src/
  main.ts              # Plugin class — commands, context menu, ribbon icon, UI refresh
  types.ts             # Annotation interface (id, filePath, from, to, lineStart, lineEnd, highlightedText, currentText?, feedback)
  annotationStore.ts   # In-memory Map<filePath, Annotation[]> with listener pattern
  sidebarView.ts       # ItemView — annotation cards, Copy all, Clear all, color picker
  editorExtension.ts   # CM6 StateField (decorations), ViewPlugin (tooltip + hover), update listener (position sync)
  compiler.ts          # Compiles annotations into LLM-formatted text
  utils.ts             # generateId, getLineNumber, formatLineRange, truncateText
styles.css             # All plugin styles (highlights, sidebar, tooltip)
```

## Commands

No default hotkeys are shipped (per Obsidian plugin guidelines). Users assign hotkeys via Settings → Hotkeys.

| Command ID | Action |
|---|---|
| `annotate-selection` | Annotate selected text |
| `toggle-sidebar` | Toggle sidebar panel |
| `copy-all` | Copy all annotations to clipboard |
| `clear-all` | Clear all annotations |

## Build & Deploy

- `npm run dev` — dev build (with sourcemaps)
- `npm run build` — production build (typecheck + minified)
- `/copy-to-vault` — builds and copies `main.js`, `manifest.json`, `styles.css` to the Obsidian vault at `~/Library/Mobile Documents/com~apple~CloudDocs/non-dev/lean_store/.obsidian/plugins/llm-annotations/`
- Output: `main.js` (esbuild CJS bundle)

## Compiled Output Format

```
I have N annotations with feedback on the document "file.md"...

File: file.md

---

[Lines X-Y] "highlighted text"
Feedback: user feedback

---

[Lines X-Y] "another passage"
Feedback: more feedback
```
