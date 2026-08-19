export function isPromptRewriteShortcut(
  key: string,
  control = false,
  meta = false,
): boolean {
  return (control || meta) && key.toLowerCase() === 'r';
}
