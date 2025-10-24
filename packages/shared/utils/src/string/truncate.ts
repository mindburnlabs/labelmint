/**
 * String truncation utilities
 */

export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncateLength = maxLength - suffix.length;
  return text.slice(0, truncateLength) + suffix;
}

/**
 * Truncate text at word boundaries
 */
export function truncateTextWords(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace === -1) {
    return text.slice(0, maxLength - suffix.length) + suffix;
  }

  return truncated.slice(0, lastSpace) + suffix;
}

/**
 * Truncate text from the middle (e.g., "start...end")
 */
export function truncateMiddle(
  text: string,
  maxLength: number,
  separator: string = '...'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const separatorLength = separator.length;
  const charsToShow = maxLength - separatorLength;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return text.slice(0, frontChars) + separator + text.slice(-backChars);
}

/**
 * Truncate text from the start (e.g., "...end")
 */
export function truncateStart(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  return suffix + text.slice(-(maxLength - suffix.length));
}

/**
 * Truncate and add ellipsis while preserving whole words
 */
export function truncateSmart(
  text: string,
  maxLength: number,
  options: {
    suffix?: string;
    wordBreak?: boolean;
    preserveWords?: boolean;
  } = {}
): string {
  const { suffix = '...', wordBreak = false, preserveWords = true } = options;

  if (text.length <= maxLength) {
    return text;
  }

  if (!preserveWords) {
    return truncateText(text, maxLength, suffix);
  }

  const words = text.split(' ');
  let result = '';

  for (const word of words) {
    const potentialResult = result ? `${result} ${word}` : word;
    if (potentialResult.length + suffix.length <= maxLength) {
      result = potentialResult;
    } else {
      break;
    }
  }

  return result || truncateText(text, maxLength, suffix);
}