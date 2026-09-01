const REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes text before it goes into an HTML e-mail body.
 *
 * File names and failure reasons come from user input and from ffmpeg's stderr,
 * so neither can be trusted to be markup-safe.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => REPLACEMENTS[char] ?? char);
}
