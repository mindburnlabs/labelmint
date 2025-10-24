// Animation utilities and keyframes for LabelMint components

export const animations = {
  // Fade animations
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: '0.3s',
    easing: 'ease-out',
  },
  
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
    duration: '0.2s',
    easing: 'ease-in',
  },

  // Slide animations
  slideInFromTop: {
    from: { transform: 'translateY(-100%)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
    duration: '0.4s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  slideInFromBottom: {
    from: { transform: 'translateY(100%)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
    duration: '0.4s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  slideInFromLeft: {
    from: { transform: 'translateX(-100%)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
    duration: '0.4s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  slideInFromRight: {
    from: { transform: 'translateX(100%)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
    duration: '0.4s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Scale animations
  scaleIn: {
    from: { transform: 'scale(0.8)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
    duration: '0.3s',
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  scaleOut: {
    from: { transform: 'scale(1)', opacity: 1 },
    to: { transform: 'scale(0.8)', opacity: 0 },
    duration: '0.2s',
    easing: 'ease-in',
  },

  // Bounce animations
  bounce: {
    from: { transform: 'translateY(0)' },
    '25%': { transform: 'translateY(-10px)' },
    '50%': { transform: 'translateY(0)' },
    '75%': { transform: 'translateY(-5px)' },
    to: { transform: 'translateY(0)' },
    duration: '0.6s',
    easing: 'ease-out',
  },

  // Pulse animations
  pulse: {
    from: { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' },
    to: { transform: 'scale(1)' },
    duration: '1s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  },

  // Shake animations
  shake: {
    from: { transform: 'translateX(0)' },
    '10%': { transform: 'translateX(-10px)' },
    '20%': { transform: 'translateX(10px)' },
    '30%': { transform: 'translateX(-10px)' },
    '40%': { transform: 'translateX(10px)' },
    '50%': { transform: 'translateX(-5px)' },
    '60%': { transform: 'translateX(5px)' },
    '70%': { transform: 'translateX(-5px)' },
    '80%': { transform: 'translateX(5px)' },
    '90%': { transform: 'translateX(-2px)' },
    to: { transform: 'translateX(0)' },
    duration: '0.5s',
    easing: 'ease-in-out',
  },

  // Spin animations
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
    duration: '1s',
    easing: 'linear',
    iterationCount: 'infinite',
  },

  // Wiggle animations
  wiggle: {
    from: { transform: 'rotate(0deg)' },
    '25%': { transform: 'rotate(5deg)' },
    '75%': { transform: 'rotate(-5deg)' },
    to: { transform: 'rotate(0deg)' },
    duration: '0.5s',
    easing: 'ease-in-out',
  },

  // Glow animations
  glow: {
    from: { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
    '50%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
    to: { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
    duration: '2s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  },

  // Typing animations
  typing: {
    from: { width: '0' },
    to: { width: '100%' },
    duration: '2s',
    easing: 'steps(40, end)',
  },

  // Blink animations
  blink: {
    from: { opacity: 1 },
    '50%': { opacity: 0 },
    to: { opacity: 1 },
    duration: '1s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  },
};

// CSS keyframes generator
export function generateKeyframes(name: string, animation: any): string {
  const keyframes = Object.entries(animation)
    .filter(([key]) => !['duration', 'easing', 'iterationCount'].includes(key))
    .map(([key, value]) => {
      if (key === 'from') return `0% { ${cssPropertiesToString(value)} }`;
      if (key === 'to') return `100% { ${cssPropertiesToString(value)} }`;
      return `${key} { ${cssPropertiesToString(value)} }`;
    })
    .join('\n');

  return `
    @keyframes ${name} {
      ${keyframes}
    }
  `;
}

// Convert object to CSS properties string
function cssPropertiesToString(properties: any): string {
  return Object.entries(properties)
    .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
    .join(' ');
}

// Convert camelCase to kebab-case
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// Animation classes generator
export function generateAnimationClasses(): string {
  const classes: string[] = [];

  Object.entries(animations).forEach(([name, animation]) => {
    const keyframes = generateKeyframes(name, animation);
    classes.push(keyframes);

    // Generate animation class
    const duration = animation.duration || '0.3s';
    const easing = animation.easing || 'ease';
    const iterationCount = animation.iterationCount || '1';

    classes.push(`
      .animate-${name} {
        animation: ${name} ${duration} ${easing} ${iterationCount};
      }
    `);
  });

  return classes.join('\n');
}

// React hook for animations
export function useAnimation(
  animationName: keyof typeof animations,
  trigger: boolean = true,
  delay: number = 0
) {
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (trigger) {
      const timer = setTimeout(() => {
        setIsAnimating(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [trigger, delay]);

  return {
    className: `animate-${animationName}`,
    isAnimating,
  };
}

// Stagger animation for lists
export function useStaggerAnimation(
  items: any[],
  delay: number = 100
) {
  const [visibleItems, setVisibleItems] = React.useState<number[]>([]);

  React.useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    items.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleItems(prev => [...prev, index]);
      }, index * delay);
      
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [items, delay]);

  return visibleItems;
}

// Intersection Observer for scroll animations
export function useScrollAnimation(
  threshold: number = 0.1,
  rootMargin: string = '0px'
) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, rootMargin]);

  return { ref, isVisible };
}

// Predefined animation presets
export const animationPresets = {
  // Page transitions
  pageEnter: {
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-20px)' },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Modal animations
  modalEnter: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },

  // Button interactions
  buttonHover: {
    scale: 1.05,
    transition: { duration: 0.2, ease: 'easeOut' },
  },

  buttonTap: {
    scale: 0.95,
    transition: { duration: 0.1, ease: 'easeOut' },
  },

  // Card animations
  cardHover: {
    y: -4,
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Loading animations
  loadingPulse: {
    scale: [1, 1.1, 1],
    opacity: [1, 0.7, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },

  // Success animations
  successBounce: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },

  // Error animations
  errorShake: {
    x: [0, -10, 10, -10, 10, -5, 5, 0],
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

export default animations;
