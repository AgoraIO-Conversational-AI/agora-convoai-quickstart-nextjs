import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function decodeStreamMessage(stream: Uint8Array) {
  const decoder = new TextDecoder();
  return decoder.decode(stream);
}

/**
 * Renders simple markdown to HTML for streaming text
 * Handles:
 * - **bold** -> <strong>bold</strong>
 * - Headers: ## and ### -> styled headings
 * - Numbered lists (1. item, 2. item, etc.)
 * - Bullet lists (- item)
 * - Indented sub-items
 */
export function renderMarkdownToHtml(text: string): string {
  if (!text) return '';

  let processed = text;

  // First, handle bold text: **text** -> <strong>text</strong>
  // Use a regex that handles partial markdown gracefully
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Handle inline numbered lists (when items appear on same line)
  // Match pattern: "1. Item 2. Item 3. Item" and split them
  processed = processed.replace(/(\d+)\.\s+([^0-9]+?)(?=\s+\d+\.|$)/g, (match, num, content) => {
    // Trim the content and check if it should be on new line
    const trimmedContent = content.trim();
    return `${num}. ${trimmedContent}\n`;
  });

  // Process line by line to handle different list formats
  const lines = processed.split(/\n/);
  const formattedLines = lines.map(line => {
    const trimmedLine = line.trim();

    // Check for headers (### and ##)
    const headerMatch = trimmedLine.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const hashes = headerMatch[1];
      const content = headerMatch[2];

      if (hashes === '###') {
        return `<div class="heading-sub">${content}</div>`;
      } else if (hashes === '##') {
        return `<div class="heading">${content}</div>`;
      }
    }

    // Check for numbered list items (1. item, 2. item, etc.)
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      const number = numberedMatch[1];
      const content = numberedMatch[2];
      return `<span class="list-item-numbered"><span class="list-number">${number}.</span> ${content}</span>`;
    }

    // Check for bullet list items (- item)
    const bulletMatch = trimmedLine.match(/^-\s+(.+)/);
    if (bulletMatch) {
      const content = bulletMatch[1];
      // Check indentation level from original line
      const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
      const isIndented = leadingSpaces >= 2;

      if (isIndented) {
        return `<span class="list-item-sub">◦ ${content}</span>`;
      }
      return `<span class="list-item">• ${content}</span>`;
    }

    // Return line as-is if no list pattern matched
    return line;
  });

  // Join with <br/> tags
  processed = formattedLines.join('<br/>');

  return processed;
}
