export interface Annotation {
  id: string;
  filePath: string;
  from: number;
  to: number;
  lineStart: number;
  lineEnd: number;
  highlightedText: string;
  feedback: string;
}
