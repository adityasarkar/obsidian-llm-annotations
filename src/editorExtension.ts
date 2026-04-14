import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { MarkdownView, setIcon } from 'obsidian';
import type LLMAnnotationsPlugin from './main';
import { Annotation } from './types';

export const setAnnotationsEffect = StateEffect.define<{
  annotations: Annotation[];
  color: string;
}>();

export function createEditorExtension(plugin: LLMAnnotationsPlugin) {
  // 1. StateField for highlight decorations
  const decorationField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decos, tr) {
      for (const e of tr.effects) {
        if (e.is(setAnnotationsEffect)) {
          const { annotations, color } = e.value;
          const builder = new RangeSetBuilder<Decoration>();
          const sorted = [...annotations].sort((a, b) => a.from - b.from);
          for (const ann of sorted) {
            if (ann.from < ann.to && ann.to <= tr.state.doc.length) {
              builder.add(
                ann.from,
                ann.to,
                Decoration.mark({
                  class: 'llm-annotation-highlight',
                  attributes: {
                    style: `background-color: ${color}`,
                    'data-annotation-id': ann.id,
                  },
                })
              );
            }
          }
          return builder.finish();
        }
      }
      if (tr.docChanged) {
        return decos.map(tr.changes);
      }
      return decos;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  // 2. Floating tooltip for text selection
  const tooltipPlugin = ViewPlugin.fromClass(
    class {
      tooltip: HTMLElement;

      constructor(private view: EditorView) {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'llm-annotation-tooltip is-hidden';

        const btn = document.createElement('button');
        btn.className = 'llm-annotation-tooltip-btn';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'llm-annotation-tooltip-icon';
        setIcon(iconSpan, 'pencil');
        btn.appendChild(iconSpan);
        btn.appendText(' Annotate');

        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          plugin.annotateCurrentSelection();
        });

        this.tooltip.appendChild(btn);
        document.body.appendChild(this.tooltip);
      }

      update(update: ViewUpdate) {
        if (!this.view.hasFocus) {
          this.tooltip.classList.add('is-hidden');
          return;
        }

        const sel = update.state.selection.main;
        if (sel.empty) {
          this.tooltip.classList.add('is-hidden');
          return;
        }

        const head = sel.head;
        let coords;
        try {
          coords = this.view.coordsAtPos(head);
        } catch {
          this.tooltip.classList.add('is-hidden');
          return;
        }
        if (!coords) {
          this.tooltip.classList.add('is-hidden');
          return;
        }

        this.tooltip.classList.remove('is-hidden');
        const tooltipHeight = this.tooltip.offsetHeight || 30;
        let top = coords.top - tooltipHeight - 6;
        if (top < 0) {
          top = coords.bottom + 6;
        }
        this.tooltip.setCssStyles({
          left: `${coords.left}px`,
          top: `${top}px`,
        });
      }

      destroy() {
        this.tooltip.remove();
      }
    }
  );

  // 3. Update listener — sync store positions on doc changes
  const updateListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;

    let filePath: string | null = null;
    plugin.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const cm = (leaf.view.editor as unknown as { cm: EditorView }).cm;
        if (cm === update.view) {
          filePath = leaf.view.file?.path || null;
        }
      }
    });

    if (!filePath) return;

    const annotations = plugin.store.getAnnotations(filePath);
    if (annotations.length === 0) return;

    const docText = update.state.doc.toString();
    plugin.store.updatePositions(filePath, (pos, assoc) =>
      update.changes.mapPos(pos, assoc)
    , docText);
  });

  // 4. Hover plugin — link editor highlights to sidebar cards
  const hoverPlugin = ViewPlugin.fromClass(
    class {
      lastHoveredId: string | null = null;
      constructor(private view: EditorView) {}
      update(_update: ViewUpdate) {}
    },
    {
      eventHandlers: {
        mousemove(event: MouseEvent, view: EditorView) {
          const pos = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (pos === null) {
            if (this.lastHoveredId !== null) {
              this.lastHoveredId = null;
              plugin.notifyHoveredAnnotation(null);
            }
            return;
          }

          const file = plugin.app.workspace.getActiveFile();
          if (!file) return;

          const annotations = plugin.store.getAnnotations(file.path);
          let foundId: string | null = null;
          for (const ann of annotations) {
            if (pos >= ann.from && pos <= ann.to) {
              foundId = ann.id;
              break;
            }
          }

          if (foundId !== this.lastHoveredId) {
            this.lastHoveredId = foundId;
            plugin.notifyHoveredAnnotation(foundId);
          }
        },
        mouseleave(_event: MouseEvent, _view: EditorView) {
          if (this.lastHoveredId !== null) {
            this.lastHoveredId = null;
            plugin.notifyHoveredAnnotation(null);
          }
        },
      },
    }
  );

  return [decorationField, tooltipPlugin, updateListener, hoverPlugin];
}
