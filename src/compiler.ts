import { Annotation } from './types';
import { formatLineRange } from './utils';

export function compileAnnotations(
  annotations: Annotation[],
  fileName: string,
): string {
  const sorted = [...annotations].sort((a, b) => a.from - b.from);
  const count = sorted.length;

  const preamble =
    `I have ${count} annotation${count === 1 ? '' : 's'} with feedback on the document "${fileName}". ` +
    `Each annotation highlights a specific passage and describes what I'd like changed. ` +
    `Please revise the document according to this feedback.`;

  const parts: string[] = [preamble, `File: ${fileName}`];

  for (const ann of sorted) {
    const lineRange = formatLineRange(ann.lineStart, ann.lineEnd);

    parts.push('---');
    parts.push(`[${lineRange}] "${ann.highlightedText}"\nFeedback: ${ann.feedback}`);
  }

  return parts.join('\n\n');
}

export function compileSingleAnnotation(
  annotation: Annotation,
  fileName: string,
): string {
  return compileAnnotations([annotation], fileName);
}
