'use client'

import * as React from 'react'
import { motion, AnimatePresence, MotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

// Enhanced motion button with micro-interactions
interface MotionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children: React.ReactNode
  isLoading?: boolean
  success?: boolean
  rippleEffect?: boolean
}

export function MotionButton({
  className,
  variant = 'default',
  size = 'default',
  isLoading = false,
  success = false,
  rippleEffect = true,
  children,
  disabled,
  ...props
}: MotionButtonProps) {
  const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([])

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!rippleEffect) return

    const button = event.currentTarget
    const rect = button.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const newRipple = { x, y, id: Date.now() }
    setRipples(prev => [...prev, newRipple])

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id))
    }, 600)
  }

  const getVariantClasses = () => {
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background"

    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-input hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "underline-offset-4 hover:underline text-primary"
    }

    const sizes = {
      default: "h-10 py-2 px-4",
      sm: "h-9 px-3 text-sm",
      lg: "h-11 px-8 text-lg",
      icon: "h-10 w-10"
    }

    return cn(baseClasses, variants[variant], sizes[size])
  }

  return (
    <motion.button
      className={cn(getVariantClasses(), className, "relative overflow-hidden")}
      disabled={disabled || isLoading}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      onClick={createRipple}
      {...props}
    >
      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map(ripple => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute bg-white/30 rounded-full pointer-events-none"
            style={{
              left: ripple.x - 10,
              top: ripple.y - 10,
              width: 20,
              height: 20
            }}
          />
        ))}
      </AnimatePresence>

      {/* Loading state */}
      {isLoading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}

      {/* Success state */}
      {success && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-green-500 rounded-md"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}

      <span className={cn(isLoading || success ? "opacity-0" : "opacity-100")}>
        {children}
      </span>
    </motion.button>
  )
}

// Animated card with hover effects
interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'none'
  delay?: number
}

export function MotionCard({
  children,
  hoverEffect = 'lift',
  delay = 0,
  className,
  ...props
}: MotionCardProps) {
  const getHoverAnimation = () => {
    switch (hoverEffect) {
      case 'lift':
        return {
          hover: { y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" },
          tap: { y: -2 }
        }
      case 'scale':
        return {
          hover: { scale: 1.02 },
          tap: { scale: 1.01 }
        }
      case 'glow':
        return {
          hover: { boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" },
          tap: { boxShadow: "0 0 10px rgba(59, 130, 246, 0.2)" }
        }
      default:
        return {}
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={getHoverAnimation().hover}
      whileTap={getHoverAnimation().tap}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Animated number counter
interface AnimatedNumberProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  className
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = React.useState(0)

  React.useEffect(() => {
    const startTime = Date.now()
    const endTime = startTime + duration

    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = Math.floor(value * easeOutQuart)

      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  )
}

// Staggered animation for lists
interface StaggeredAnimationProps {
  children: React.ReactNode[]
  className?: string
  staggerDelay?: number
  initialDelay?: number
}

export function StaggeredAnimation({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0
}: StaggeredAnimationProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: initialDelay + index * staggerDelay,
            ease: "easeOut"
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}

// Floating animation
interface FloatingAnimationProps {
  children: React.ReactNode
  duration?: number
  intensity?: number
  className?: string
}

export function FloatingAnimation({
  children,
  duration = 3,
  intensity = 10,
  className
}: FloatingAnimationProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [-intensity, intensity, -intensity]
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  )
}

// Pulse animation
interface PulseAnimationProps {
  children: React.ReactNode
  intensity?: number
  duration?: number
  className?: string
}

export function PulseAnimation({
  children,
  intensity = 1.05,
  duration = 2,
  className
}: PulseAnimationProps) {
  return (
    <motion.div
      className={className}
      animate={{
        scale: [1, intensity, 1]
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  )
}

// Shimmer loading effect
interface ShimmerProps {
  className?: string
  width?: string | number
  height?: string | number
  borderRadius?: string
}

export function Shimmer({
  className,
  width = '100%',
  height = '1rem',
  borderRadius = '0.25rem'
}: ShimmerProps) {
  return (
    <motion.div
      className={cn("bg-gray-200 dark:bg-gray-700 overflow-hidden", className)}
      style={{ width, height, borderRadius }}
    >
      <motion.div
        className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{
          x: ['-100%', '200%']
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </motion.div>
  )
}

// Typewriter effect
interface TypewriterProps {
  text: string
  speed?: number
  className?: string
  onComplete?: () => void
}

export function Typewriter({
  text,
  speed = 50,
  className,
  onComplete
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = React.useState('')
  const [currentIndex, setCurrentIndex] = React.useState(0)

  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)

      return () => clearTimeout(timeout)
    } else {
      onComplete?.()
    }
  }, [currentIndex, text, speed, onComplete])

  return (
    <span className={className}>
      {displayedText}
      {currentIndex < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-0.5 h-4 bg-current ml-1"
        />
      )}
    </span>
  )
}

// Magnetic button effect
interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  strength?: number
}

export function MagneticButton({
  children,
  strength = 0.3,
  className,
  ...props
}: MagneticButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = (e.clientX - centerX) * strength
    const deltaY = (e.clientY - centerY) * strength

    setMousePosition({ x: deltaX, y: deltaY })
  }

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 })
  }

  return (
    <motion.button
      ref={ref}
      className={cn("relative", className)}
      animate={{
        x: mousePosition.x,
        y: mousePosition.y
      }}
      transition={{
        type: "spring",
        damping: 25,
        stiffness: 400
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </motion.button>
  )
}