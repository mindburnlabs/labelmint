/**
 * Convert a string to a URL-friendly slug
 * Replaces spaces and special characters with hyphens, converts to lowercase
 * Removes or replaces non-alphanumeric characters
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')        // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Generate a unique slug by appending a suffix if needed
 */
export function generateUniqueSlug(baseText: string, existingSlugs: string[]): string {
  let slug = slugify(baseText);
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    const suffix = counter.toString();
    slug = `${slugify(baseText)}-${suffix}`;
    counter++;
  }

  return slug;
}

/**
 * Validate if a string is a valid slug format
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}