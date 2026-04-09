export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

export function getLineNumber(text: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

export function formatLineRange(lineStart: number, lineEnd: number): string {
  return lineStart === lineEnd
    ? `Line ${lineStart}`
    : `Lines ${lineStart}-${lineEnd}`;
}

export function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
