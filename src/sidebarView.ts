import { ItemView, WorkspaceLeaf, MarkdownView } from 'obsidian';
import type LLMAnnotationsPlugin from './main';
import { compileSingleAnnotation } from './compiler';
import { Annotation } from './types';
import { truncateText, formatLineRange, getLineNumber } from './utils';

export const VIEW_TYPE = 'llm-annotations-sidebar';

export class AnnotationSidebarView extends ItemView {
  private plugin: LLMAnnotationsPlugin;
  private listEl!: HTMLElement;
  private copyAllBtn!: HTMLButtonElement;
  private clearAllBtn!: HTMLButtonElement;
  pendingFocusId: string | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LLMAnnotationsPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'LLM Annotations';
  }

  getIcon(): string {
    return 'message-square';
  }

  onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('llm-annotations-sidebar');

    // Header
    const header = container.createDiv({ cls: 'llm-annotations-header' });
    header.createEl('h4', { text: 'LLM Annotations' });

    // Controls row
    const controls = header.createDiv({ cls: 'llm-annotations-controls' });

    this.copyAllBtn = controls.createEl('button', {
      text: 'Copy all',
      cls: 'llm-annotations-btn',
    });
    this.copyAllBtn.addEventListener('click', () => {
      this.plugin.copyAll();
    });

    this.clearAllBtn = controls.createEl('button', {
      text: 'Clear all',
      cls: 'llm-annotations-btn llm-annotations-btn-danger',
    });
    this.clearAllBtn.addEventListener('click', () => {
      this.plugin.clearAll();
    });

    // Color picker
    const colorWrap = controls.createDiv({ cls: 'llm-annotations-color-wrap' });
    colorWrap.createSpan({ text: 'Color: ', cls: 'llm-annotations-color-label' });
    const colorInput = colorWrap.createEl('input');
    colorInput.type = 'color';
    colorInput.value = this.plugin.highlightColor;
    colorInput.className = 'llm-annotations-color-picker';
    colorInput.addEventListener('input', (e) => {
      this.plugin.setHighlightColor((e.target as HTMLInputElement).value);
    });

    // Annotation list
    this.listEl = container.createDiv({ cls: 'llm-annotations-list' });

    this.render();
    return Promise.resolve();
  }

  render() {
    if (!this.listEl) return;
    this.listEl.empty();

    const file = this.app.workspace.getActiveFile();
    const annotations = file
      ? this.plugin.store.getAnnotations(file.path)
      : [];

    // Update button states
    if (this.copyAllBtn) this.copyAllBtn.disabled = annotations.length === 0;
    if (this.clearAllBtn) this.clearAllBtn.disabled = annotations.length === 0;

    if (!file) {
      this.listEl.createDiv({
        cls: 'llm-annotations-empty',
        text: 'No active file.',
      });
      return;
    }

    if (annotations.length === 0) {
      this.listEl.createDiv({
        cls: 'llm-annotations-empty',
        text: 'Select text and run the "Annotate selection" command to add an annotation. Assign a hotkey in Settings → Hotkeys.',
      });
      return;
    }

    // Backfill line numbers for annotations created before this field existed
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      const docText = view.editor.getValue();
      for (const ann of annotations) {
        if (!ann.lineStart) {
          ann.lineStart = getLineNumber(docText, ann.from);
          ann.lineEnd = getLineNumber(docText, ann.to);
        }
      }
    }

    const sorted = [...annotations].sort((a, b) => a.from - b.from);
    for (const ann of sorted) {
      this.renderCard(ann, file.path);
    }

    // Apply pending focus after DOM is built
    if (this.pendingFocusId) {
      this.startFocusRetries();
    }
  }

  focusAnnotation(id: string) {
    this.pendingFocusId = id;
    this.startFocusRetries();
  }

  private startFocusRetries() {
    if (this.focusTimer !== null) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    this.tryFocusPending(10);
  }

  private tryFocusPending(attemptsLeft: number) {
    if (!this.pendingFocusId) return;

    const textarea = this.containerEl.querySelector<HTMLTextAreaElement>(
      `[data-annotation-id="${this.pendingFocusId}"] textarea`
    );

    if (textarea) {
      textarea.focus();
      if (document.activeElement === textarea) {
        // Focus succeeded — keep pendingFocusId as a guard against
        // re-renders that would destroy this textarea. Clear after settling.
        this.focusTimer = setTimeout(() => {
          this.pendingFocusId = null;
          this.focusTimer = null;
        }, 500);
        return;
      }
    }

    if (attemptsLeft > 0) {
      this.focusTimer = setTimeout(() => {
        this.tryFocusPending(attemptsLeft - 1);
      }, 50);
    } else {
      this.focusTimer = null;
      this.pendingFocusId = null;
    }
  }

  private renderCard(ann: Annotation, filePath: string) {
    const card = this.listEl.createDiv({
      cls: 'llm-annotations-card',
      attr: { 'data-annotation-id': ann.id },
    });

    // Line badge
    card.createDiv({
      cls: 'llm-annotations-line-badge',
      text: formatLineRange(ann.lineStart, ann.lineEnd),
    });

    // Excerpt — show before/after if text has changed
    const hasChanged = ann.currentText !== undefined && ann.currentText !== ann.highlightedText;

    if (hasChanged) {
      const badgeRow = card.querySelector('.llm-annotations-line-badge') as HTMLElement;
      if (badgeRow) {
        badgeRow.createSpan({ cls: 'llm-annotations-changed-badge', text: 'Changed' });
      }

      const diffEl = card.createDiv({ cls: 'llm-annotations-diff' });
      diffEl.createDiv({ cls: 'llm-annotations-diff-label llm-annotations-diff-label-before', text: 'Before' });
      const beforeExcerpt = diffEl.createDiv({ cls: 'llm-annotations-excerpt llm-annotations-excerpt-before' });
      this.createExpandableQuote(beforeExcerpt, ann.highlightedText);

      diffEl.createDiv({ cls: 'llm-annotations-diff-label llm-annotations-diff-label-after', text: 'After' });
      const afterExcerpt = diffEl.createDiv({ cls: 'llm-annotations-excerpt llm-annotations-excerpt-after' });
      this.createExpandableQuote(afterExcerpt, ann.currentText!);
    } else {
      const excerptEl = card.createDiv({ cls: 'llm-annotations-excerpt' });
      this.createExpandableQuote(excerptEl, ann.highlightedText);
    }

    // Feedback textarea
    const textarea = card.createEl('textarea', {
      cls: 'llm-annotations-feedback',
      placeholder: 'Add your feedback...',
    });
    textarea.value = ann.feedback;
    textarea.addEventListener('input', () => {
      this.plugin.store.updateFeedback(filePath, ann.id, textarea.value);
      textarea.setCssStyles({ height: 'auto' });
      textarea.setCssStyles({ height: textarea.scrollHeight + 'px' });
    });
    // Auto-size on render
    requestAnimationFrame(() => {
      if (textarea.value) {
        textarea.setCssStyles({ height: 'auto' });
        textarea.setCssStyles({ height: textarea.scrollHeight + 'px' });
      }
    });

    // Button row
    const btnRow = card.createDiv({ cls: 'llm-annotations-card-buttons' });

    const copyBtn = btnRow.createEl('button', {
      text: 'Copy',
      cls: 'llm-annotations-btn-sm',
    });
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copySingle(ann, copyBtn);
    });

    const deleteBtn = btnRow.createEl('button', {
      text: 'Delete',
      cls: 'llm-annotations-btn-sm llm-annotations-btn-danger',
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.plugin.store.removeAnnotation(filePath, ann.id);
    });

    // Click card to scroll to annotation
    card.addEventListener('click', (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
      this.scrollToAnnotation(ann);
    });
  }

  private createExpandableQuote(container: HTMLElement, fullText: string) {
    const maxLen = 150;
    const isTruncatable = fullText.length > maxLen;
    const bq = container.createEl('blockquote', {
      text: isTruncatable ? truncateText(fullText, maxLen) : fullText,
    });
    if (isTruncatable) {
      let expanded = false;
      const toggle = container.createEl('span', {
        cls: 'llm-annotations-expand-toggle',
        text: 'Show more',
      });
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        expanded = !expanded;
        bq.textContent = expanded ? fullText : truncateText(fullText, maxLen);
        toggle.textContent = expanded ? 'Show less' : 'Show more';
      });
    }
  }

  highlightCard(annotationId: string | null) {
    // Remove previous highlight
    const prev = this.listEl?.querySelector('.llm-annotations-card-hover');
    prev?.removeClass('llm-annotations-card-hover');

    if (annotationId) {
      const card = this.listEl?.querySelector(
        `[data-annotation-id="${annotationId}"]`
      );
      if (card) {
        card.addClass('llm-annotations-card-hover');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  private scrollToAnnotation(ann: Annotation) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const editor = view.editor;
    const from = editor.offsetToPos(ann.from);
    const to = editor.offsetToPos(ann.to);
    editor.setSelection(from, to);
    editor.scrollIntoView({ from, to }, true);
  }

  private copySingle(ann: Annotation, btn: HTMLButtonElement) {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const compiled = compileSingleAnnotation(ann, file.name);
    void navigator.clipboard.writeText(compiled);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = original;
    }, 1500);
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }
}
