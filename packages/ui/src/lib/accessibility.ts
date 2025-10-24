import axe from 'axe-core';

export interface A11yTestResult {
  passes: axe.Result[];
  violations: axe.Result[];
  incomplete: axe.Result[];
  inapplicable: axe.Result[];
}

export interface A11yTestOptions {
  context?: axe.ElementContext;
  options?: axe.RunOptions;
  tags?: string[];
}

/**
 * Run accessibility tests on a given element
 */
export async function runA11yTest(
  element: HTMLElement | Document,
  options: A11yTestOptions = {}
): Promise<A11yTestResult> {
  const { context = element, options: runOptions = {}, tags = ['wcag2a', 'wcag2aa'] } = options;

  const results = await axe.run(context, {
    ...runOptions,
    tags,
  });

  return {
    passes: results.passes,
    violations: results.violations,
    incomplete: results.incomplete,
    inapplicable: results.inapplicable,
  };
}

/**
 * Check if an element has proper ARIA attributes
 */
export function checkAriaAttributes(element: HTMLElement): {
  hasLabel: boolean;
  hasRole: boolean;
  hasDescription: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let hasLabel = false;
  let hasRole = false;
  let hasDescription = false;

  // Check for label
  if (
    element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') ||
    element.tagName === 'LABEL' ||
    element.getAttribute('id') && document.querySelector(`label[for="${element.getAttribute('id')}"]`)
  ) {
    hasLabel = true;
  } else if (
    element.tagName === 'BUTTON' ||
    element.tagName === 'INPUT' && element.type !== 'hidden' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT'
  ) {
    errors.push('Interactive element missing accessible label');
  }

  // Check for role
  if (element.getAttribute('role')) {
    hasRole = true;
  }

  // Check for description
  if (
    element.getAttribute('aria-describedby') ||
    element.getAttribute('title')
  ) {
    hasDescription = true;
  }

  return {
    hasLabel,
    hasRole,
    hasDescription,
    errors,
  };
}

/**
 * Check keyboard navigation for an element
 */
export function checkKeyboardNavigation(element: HTMLElement): {
  isFocusable: boolean;
  isTabbable: boolean;
  hasKeyboardHandler: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let isFocusable = false;
  let isTabbable = false;
  let hasKeyboardHandler = false;

  // Check if element is focusable
  const focusableElements = [
    'button',
    'input',
    'select',
    'textarea',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];

  const isFocusableElement = focusableElements.some(selector =>
    element.matches(selector) || element.closest(selector)
  );

  if (isFocusableElement) {
    isFocusable = true;
    const tabIndex = element.getAttribute('tabindex');
    isTabbable = tabIndex !== '-1';
  }

  // Check for keyboard event handlers
  const hasKeyEvents = [
    'onkeydown',
    'onkeyup',
    'onkeypress',
  ].some(event => element.hasAttribute(event));

  if (hasKeyEvents) {
    hasKeyboardHandler = true;
  }

  // Interactive elements should be keyboard accessible
  if (
    element.getAttribute('role') === 'button' ||
    element.getAttribute('onclick') ||
    element.tagName === 'BUTTON'
  ) {
    if (!isTabbable) {
      errors.push('Interactive element is not keyboard accessible');
    }
    if (!hasKeyboardHandler && element.tagName !== 'BUTTON') {
      errors.push('Interactive element missing keyboard event handlers');
    }
  }

  return {
    isFocusable,
    isTabbable,
    hasKeyboardHandler,
    errors,
  };
}

/**
 * Check color contrast for an element
 */
export function checkColorContrast(element: HTMLElement): {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let ratio = 0;
  let passesAA = false;
  let passesAAA = false;

  try {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // Skip transparent backgrounds
    if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
      errors.push('Element has transparent background');
      return { ratio: 0, passesAA: false, passesAAA: false, errors };
    }

    // Convert RGB to hex
    const rgbToHex = (rgb: string): string => {
      const match = rgb.match(/\d+/g);
      if (!match) return '#000000';
      const hex = match.slice(0, 3).map(x => {
        const h = parseInt(x).toString(16);
        return h.length === 1 ? '0' + h : h;
      });
      return '#' + hex.join('');
    };

    const getLuminance = (hex: string): number => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const colorHex = rgbToHex(color);
    const bgHex = rgbToHex(backgroundColor);

    const l1 = getLuminance(colorHex);
    const l2 = getLuminance(bgHex);
    ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
    // WCAG AAA requires 7:1 for normal text, 4.5:1 for large text
    const fontSize = parseFloat(styles.fontSize);
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && parseInt(styles.fontWeight) >= 700);

    if (isLargeText) {
      passesAA = ratio >= 3;
      passesAAA = ratio >= 4.5;
    } else {
      passesAA = ratio >= 4.5;
      passesAAA = ratio >= 7;
    }

    if (!passesAA) {
      errors.push(`Color contrast ratio ${ratio.toFixed(2)}:1 does not meet WCAG AA standards`);
    }
  } catch (error) {
    errors.push('Could not calculate color contrast');
  }

  return {
    ratio,
    passesAA,
    passesAAA,
    errors,
  };
}

/**
 * Generate accessibility report for a component
 */
export async function generateA11yReport(
  element: HTMLElement,
  componentName: string = 'Component'
): Promise<{
  component: string;
  timestamp: string;
  axeResults: A11yTestResult;
  customChecks: {
    aria: ReturnType<typeof checkAriaAttributes>;
    keyboard: ReturnType<typeof checkKeyboardNavigation>;
    contrast: ReturnType<typeof checkColorContrast>;
  };
  summary: {
    totalErrors: number;
    totalWarnings: number;
    score: number; // 0-100
  };
}> {
  const axeResults = await runA11yTest(element);
  const ariaCheck = checkAriaAttributes(element);
  const keyboardCheck = checkKeyboardNavigation(element);
  const contrastCheck = checkColorContrast(element);

  const totalErrors = axeResults.violations.length +
    ariaCheck.errors.length +
    keyboardCheck.errors.length +
    contrastCheck.errors.length;

  const totalWarnings = axeResults.incomplete.length;

  // Calculate accessibility score (100 = perfect, 0 = critical issues)
  let score = 100;
  if (totalErrors > 0) score -= totalErrors * 20;
  if (totalWarnings > 0) score -= totalWarnings * 5;
  score = Math.max(0, score);

  return {
    component: componentName,
    timestamp: new Date().toISOString(),
    axeResults,
    customChecks: {
      aria: ariaCheck,
      keyboard: keyboardCheck,
      contrast: contrastCheck,
    },
    summary: {
      totalErrors,
      totalWarnings,
      score,
    },
  };
}

/**
 * Utility to add skip links for keyboard navigation
 */
export function addSkipLink(id: string, label: string): HTMLAnchorElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${id}`;
  skipLink.textContent = label;
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: var(--primary, #0066cc);
    color: white;
    padding: 8px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 100;
    transition: top 0.3s;
  `;

  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });

  document.body.insertBefore(skipLink, document.body.firstChild);

  return skipLink;
}

/**
 * Utility to manage focus trap for modals and dialogs
 */
export class FocusTrap {
  private container: HTMLElement;
  private previousActiveElement: Element | null;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.previousActiveElement = document.activeElement;
    this.keydownHandler = this.handleKeydown.bind(this);

    // Set initial focus
    this.setInitialFocus();

    // Add event listener
    document.addEventListener('keydown', this.keydownHandler);
  }

  private setInitialFocus() {
    const focusableElements = this.container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    const focusableElements = this.container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.keydownHandler);

    // Restore focus to previous element
    if (this.previousActiveElement && this.previousActiveElement instanceof HTMLElement) {
      this.previousActiveElement.focus();
    }
  }
}