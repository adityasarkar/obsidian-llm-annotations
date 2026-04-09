import { Plugin, MarkdownView, Notice, Menu, Editor } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { AnnotationStore } from './annotationStore';
import { AnnotationSidebarView, VIEW_TYPE } from './sidebarView';
import { createEditorExtension, setAnnotationsEffect } from './editorExtension';
import { compileAnnotations } from './compiler';
import { generateId } from './utils';
import { Annotation } from './types';

export default class LLMAnnotationsPlugin extends Plugin {
  store = new AnnotationStore();
  highlightColor = '#ffeb3b';

  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new AnnotationSidebarView(leaf, this));

    this.registerEditorExtension(createEditorExtension(this));

    // Commands
    this.addCommand({
      id: 'annotate-selection',
      name: 'Annotate selection',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'm' }],
      editorCallback: (editor: Editor, ctx) => {
        const markdownView = ctx instanceof MarkdownView ? ctx : null;
        if (markdownView) this.annotateSelection(editor, markdownView);
      },
    });

    this.addCommand({
      id: 'toggle-sidebar',
      name: 'Toggle sidebar',
      callback: () => this.toggleSidebar(),
    });

    this.addCommand({
      id: 'copy-all',
      name: 'Copy all annotations',
      callback: () => this.copyAll(),
    });

    this.addCommand({
      id: 'clear-all',
      name: 'Clear all annotations',
      callback: () => this.clearAll(),
    });

    // Ribbon icon
    this.addRibbonIcon('message-square', 'LLM Annotations', () => {
      this.toggleSidebar();
    });

    // Context menu
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, info) => {
        if (editor.getSelection()) {
          menu.addItem((item) => {
            item
              .setTitle('Annotate Selection')
              .setIcon('pencil')
              .onClick(() => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) this.annotateSelection(editor, view);
              });
          });
        }
      })
    );

    // Re-render sidebar + decorations on file switch
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.refreshSidebar();
        this.refreshDecorations();
      })
    );

    // Store changes → refresh UI
    this.register(
      this.store.onChanged(() => {
        this.refreshSidebar();
        this.refreshDecorations();
      })
    );
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  // --- Annotation actions ---

  async annotateSelection(editor: Editor, markdownView: MarkdownView) {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Select text first');
      return;
    }

    const file = markdownView.file;
    if (!file) return;

    const cursorFrom = editor.getCursor('from');
    const cursorTo = editor.getCursor('to');
    const from = editor.posToOffset(cursorFrom);
    const to = editor.posToOffset(cursorTo);

    const annotation: Annotation = {
      id: generateId(),
      filePath: file.path,
      from,
      to,
      lineStart: cursorFrom.line + 1,
      lineEnd: cursorTo.line + 1,
      highlightedText: selection,
      feedback: '',
    };

    this.store.addAnnotation(annotation);
    await this.activateSidebar();

    // Blur the CM6 editor so it doesn't fight for focus
    const cmEditor = (markdownView.editor as any).cm as EditorView | undefined;
    if (cmEditor) {
      cmEditor.contentDOM.blur();
    }

    // Activate the sidebar leaf and focus the new annotation's textarea
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (leaf) {
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
      (leaf.view as AnnotationSidebarView).focusAnnotation(annotation.id);
    }
  }

  annotateCurrentSelection() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    this.annotateSelection(view.editor, view);
  }

  copyAll() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;

    const annotations = this.store.getAnnotations(file.path);
    if (annotations.length === 0) {
      new Notice('No annotations to copy');
      return;
    }

    const compiled = compileAnnotations(annotations, file.name);
    navigator.clipboard.writeText(compiled);
    new Notice('Copied all annotations!');
  }

  clearAll() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    this.store.clearAnnotations(file.path);
  }

  // --- Sidebar ---

  async toggleSidebar() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    } else {
      await this.activateSidebar();
    }
  }

  async activateSidebar() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  // --- UI refresh ---

  refreshSidebar() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      (leaf.view as AnnotationSidebarView).render();
    }
  }

  refreshDecorations() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;

    const annotations = this.store.getAnnotations(file.path);
    const color = this.getHighlightColorRgba();

    this.app.workspace.iterateAllLeaves((leaf) => {
      if (
        leaf.view instanceof MarkdownView &&
        leaf.view.file?.path === file.path
      ) {
        const cmEditor = (leaf.view.editor as any).cm as EditorView | undefined;
        if (cmEditor) {
          cmEditor.dispatch({
            effects: setAnnotationsEffect.of({ annotations, color }),
          });
        }
      }
    });
  }

  getHighlightColorRgba(): string {
    const hex = this.highlightColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.35)`;
  }

  setHighlightColor(color: string) {
    this.highlightColor = color;
    this.refreshDecorations();
  }

  notifyHoveredAnnotation(annotationId: string | null) {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      (leaf.view as AnnotationSidebarView).highlightCard(annotationId);
    }
  }
}
