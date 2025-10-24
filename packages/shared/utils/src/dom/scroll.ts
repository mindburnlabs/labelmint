/**
 * DOM scroll utilities
 */

/**
 * Scroll element into view
 */
export function scrollIntoView(
  element: HTMLElement,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'center' }
): void {
  element.scrollIntoView(options);
}

/**
 * Scroll to top of page
 */
export function scrollToTop(smooth: boolean = true): void {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * Scroll to bottom of page
 */
export function scrollToBottom(smooth: boolean = true): void {
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    left: 0,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * Scroll to specific position
 */
export function scrollTo(
  x: number,
  y: number,
  smooth: boolean = true
): void {
  window.scrollTo({
    top: y,
    left: x,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * Get current scroll position
 */
export function getScrollPosition(): { x: number; y: number } {
  return {
    x: window.pageXOffset || document.documentElement.scrollLeft,
    y: window.pageYOffset || document.documentElement.scrollTop,
  };
}

/**
 * Get scroll percentage of page
 */
export function getScrollPercentage(): number {
  const { y } = getScrollPosition();
  const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
  return documentHeight === 0 ? 0 : (y / documentHeight) * 100;
}

/**
 * Check if element is scrolled into view
 */
export function isScrolledIntoView(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const elemTop = rect.top;
  const elemBottom = rect.bottom;

  const isVisible = elemTop < window.innerHeight && elemBottom >= 0;
  return isVisible;
}