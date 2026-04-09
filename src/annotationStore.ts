import { Annotation } from './types';
import { getLineNumber } from './utils';

type Listener = () => void;

export class AnnotationStore {
  private annotations: Map<string, Annotation[]> = new Map();
  private listeners: Set<Listener> = new Set();

  addAnnotation(annotation: Annotation): void {
    const list = this.annotations.get(annotation.filePath) || [];
    list.push(annotation);
    this.annotations.set(annotation.filePath, list);
    this.notify();
  }

  removeAnnotation(filePath: string, id: string): void {
    const list = this.annotations.get(filePath);
    if (!list) return;
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      if (list.length === 0) this.annotations.delete(filePath);
      this.notify();
    }
  }

  getAnnotations(filePath: string): Annotation[] {
    return this.annotations.get(filePath) || [];
  }

  updateFeedback(filePath: string, id: string, feedback: string): void {
    const list = this.annotations.get(filePath);
    if (!list) return;
    const ann = list.find(a => a.id === id);
    if (ann) {
      ann.feedback = feedback;
    }
  }

  clearAnnotations(filePath: string): void {
    this.annotations.delete(filePath);
    this.notify();
  }

  updatePositions(filePath: string, mapPos: (pos: number, assoc?: number) => number, docText?: string): boolean {
    const list = this.annotations.get(filePath);
    if (!list || list.length === 0) return false;

    const toRemove: string[] = [];
    for (const ann of list) {
      ann.from = mapPos(ann.from, 1);
      ann.to = mapPos(ann.to, -1);
      if (ann.from >= ann.to) {
        toRemove.push(ann.id);
      } else if (docText !== undefined) {
        ann.lineStart = getLineNumber(docText, ann.from);
        ann.lineEnd = getLineNumber(docText, ann.to);
      }
    }

    if (toRemove.length > 0) {
      const filtered = list.filter(a => !toRemove.includes(a.id));
      if (filtered.length === 0) {
        this.annotations.delete(filePath);
      } else {
        this.annotations.set(filePath, filtered);
      }
      this.notify();
      return true;
    }
    return false;
  }

  onChanged(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
