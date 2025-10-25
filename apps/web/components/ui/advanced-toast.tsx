'use client'

import * as React from 'react'
import * as toast from 'sonner'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './button'
import { Badge } from './badge'
import { cn } from '@/lib/utils'

interface AdvancedToastProps {
  id: string
  title?: string
  description?: string
  type?: 'success' | 'error' | 'warning' | 'info' | 'loading'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
  icon?: React.ReactNode
  progress?: number
  onDismiss?: () => void
}

const icons = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
  loading: <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
}

export function AdvancedToast({
  id,
  title,
  description,
  type = 'info',
  duration = 4000,
  action,
  dismissible = true,
  icon,
  progress,
  onDismiss
}: AdvancedToastProps) {
  const [isVisible, setIsVisible] = React.useState(true)
  const [progressWidth, setProgressWidth] = React.useState(100)

  React.useEffect(() => {
    if (duration > 0 && !progress) {
      const startTime = Date.now()
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, duration - elapsed)
        const percentage = (remaining / duration) * 100
        setProgressWidth(percentage)

        if (remaining === 0) {
          clearInterval(interval)
          handleDismiss()
        }
      }, 50)

      return () => clearInterval(interval)
    } else if (progress !== undefined) {
      setProgressWidth(progress)
    }
  }, [duration, progress])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => onDismiss?.(), 300)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className={cn(
            'group relative flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm',
            'bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-700',
            'hover:shadow-xl transition-all duration-200',
            'max-w-md w-full'
          )}
        >
          {/* Progress bar */}
          {(duration > 0 || progress !== undefined) && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-t-xl overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                initial={{ width: '100%' }}
                animate={{ width: `${progressWidth}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>
          )}

          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {icon || icons[type]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {title}
              </h4>
            )}
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {description}
              </p>
            )}

            {/* Action button */}
            {action && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={action.onClick}
                  className="text-xs"
                >
                  {action.label}
                </Button>
              </div>
            )}
          </div>

          {/* Dismiss button */}
          {dismissible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          {/* Type indicator */}
          <div className={cn(
            'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
            {
              'bg-green-500': type === 'success',
              'bg-red-500': type === 'error',
              'bg-yellow-500': type === 'warning',
              'bg-blue-500': type === 'info' || type === 'loading'
            }
          )} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Connection status toast
export function ConnectionStatusToast({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AdvancedToast
        id="connection-status"
        type={isConnected ? 'success' : 'warning'}
        title={isConnected ? 'Connected' : 'Connection Lost'}
        description={isConnected ? 'Real-time updates active' : 'Attempting to reconnect...'}
        icon={isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-yellow-500" />}
        duration={isConnected ? 3000 : 0}
        dismissible={false}
      />
    </div>
  )
}

// Live activity toast
export function LiveActivityToast({ activity }: { activity: any }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task_completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'project_created': return <AlertCircle className="h-4 w-4 text-blue-500" />
      case 'user_joined': return <Info className="h-4 w-4 text-purple-500" />
      case 'payment_received': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error_occurred': return <AlertTriangle className="h-4 w-4 text-red-500" />
      default: return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed bottom-20 right-4 z-40 max-w-xs"
    >
      <AdvancedToast
        id={activity.id}
        type="info"
        title="Live Activity"
        description={`${activity.userName} ${activity.description}`}
        icon={getActivityIcon(activity.type)}
        duration={5000}
      />
    </motion.div>
  )
}

// Batch operations toast
export function BatchOperationToast({
  operation,
  total,
  completed,
  errors
}: {
  operation: string
  total: number
  completed: number
  errors: number
}) {
  const progress = (completed / total) * 100
  const isComplete = completed === total
  const hasErrors = errors > 0

  return (
    <AdvancedToast
      id="batch-operation"
      type={isComplete ? (hasErrors ? 'warning' : 'success') : 'loading'}
      title={isComplete ? 'Operation Complete' : 'Processing...'}
      description={`${operation}: ${completed}/${total} completed${hasErrors ? `, ${errors} errors` : ''}`}
      progress={isComplete ? undefined : progress}
      duration={isComplete ? 5000 : 0}
      dismissible={isComplete}
    />
  )
}

// Custom toast wrapper with advanced features
export const advancedToast = {
  success: (title: string, description?: string, options?: Partial<AdvancedToastProps>) => {
    return toast.success(title, { description, ...options })
  },
  error: (title: string, description?: string, options?: Partial<AdvancedToastProps>) => {
    return toast.error(title, { description, ...options })
  },
  warning: (title: string, description?: string, options?: Partial<AdvancedToastProps>) => {
    return toast.warning(title, { description, ...options })
  },
  info: (title: string, description?: string, options?: Partial<AdvancedToastProps>) => {
    return toast.info(title, { description, ...options })
  },
  loading: (title: string, description?: string, options?: Partial<AdvancedToastProps>) => {
    return toast.loading(title, { description, ...options })
  },
  custom: (component: React.ReactNode, options?: any) => {
    return toast.custom(component, options)
  }
}