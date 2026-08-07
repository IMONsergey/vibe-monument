import { getPreviewSelection, selectionContext } from '../preview/selection';

export function compileTurnText(userText: string): string {
  const text = userText.trim();
  const selection = getPreviewSelection();
  if (!selection) return text;
  return `${text}\n\n${selectionContext(selection)}`;
}
