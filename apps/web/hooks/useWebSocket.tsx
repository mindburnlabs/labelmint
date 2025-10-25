'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'

interface WebSocketContextType {
  socket: Socket | null
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  notifications: Notification[]
  liveStats: LiveStats | null
  recentActivity: Activity[]
  sendNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  clearNotifications: () => void
  markNotificationRead: (id: string) => void
}

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  actionText?: string
}

interface LiveStats {
  activeProjects: number
  totalTasks: number
  completedTasks: number
  activeUsers: number
  systemLoad: number
  avgAccuracy: number
  earningsPerHour: number
  queueSize: number
}

interface Activity {
  id: string
  type: 'task_completed' | 'project_created' | 'user_joined' | 'payment_received' | 'error_occurred'
  userId: string
  userName: string
  description: string
  timestamp: Date
  metadata?: Record<string, any>
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'

    const socketInstance = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })

    socketInstance.on('connect', () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setConnectionStatus('connected')
      toast.success('Connected to live updates')
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      setIsConnected(false)
      setConnectionStatus('disconnected')
      toast.error('Connection lost - attempting to reconnect...')
    })

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setConnectionStatus('error')
      toast.error('Failed to connect to live updates')
    })

    // Live stats updates
    socketInstance.on('live_stats_update', (stats: LiveStats) => {
      setLiveStats(stats)
    })

    // Notification events
    socketInstance.on('notification', (notification: Notification) => {
      const enrichedNotification = {
        ...notification,
        timestamp: new Date(notification.timestamp),
        read: false
      }

      setNotifications(prev => [enrichedNotification, ...prev].slice(0, 50)) // Keep last 50

      // Show toast for important notifications
      if (notification.type === 'error' || notification.type === 'warning') {
        toast.error(notification.title, { description: notification.message })
      } else if (notification.type === 'success') {
        toast.success(notification.title, { description: notification.message })
      } else {
        toast.info(notification.title, { description: notification.message })
      }
    })

    // Activity feed updates
    socketInstance.on('activity_update', (activity: Activity) => {
      const enrichedActivity = {
        ...activity,
        timestamp: new Date(activity.timestamp)
      }

      setRecentActivity(prev => [enrichedActivity, ...prev].slice(0, 100)) // Keep last 100
    })

    // System alerts
    socketInstance.on('system_alert', (alert) => {
      toast.error(`System Alert: ${alert.title}`, {
        description: alert.message,
        action: {
          label: 'View Details',
          onClick: () => console.log('View alert details:', alert)
        }
      })
    })

    // Performance metrics
    socketInstance.on('performance_metrics', (metrics) => {
      // Could update a performance monitor dashboard
      console.log('Performance metrics:', metrics)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  const sendNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false
    }

    socket?.emit('send_notification', newNotification)
  }

  const clearNotifications = () => {
    setNotifications([])
    socket?.emit('clear_notifications')
  }

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
    socket?.emit('mark_notification_read', { id })
  }

  const value: WebSocketContextType = {
    socket,
    isConnected,
    connectionStatus,
    notifications,
    liveStats,
    recentActivity,
    sendNotification,
    clearNotifications,
    markNotificationRead
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

// Hook for dashboard-specific real-time updates
export function useDashboardUpdates() {
  const { liveStats, isConnected, notifications, recentActivity } = useWebSocket()

  return {
    isConnected,
    dashboardStats: liveStats,
    notifications: notifications.filter(n => !n.read),
    recentActivity,
    unreadCount: notifications.filter(n => !n.read).length
  }
}