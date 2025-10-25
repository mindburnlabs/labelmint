'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Key,
  Users,
  Eye,
  AlertTriangle,
  CheckCircle,
  Lock,
  Unlock,
  Activity,
  Clock,
  Globe,
  Smartphone,
  Mail,
  UserCheck,
  UserX,
  RefreshCw,
  Download,
  Settings,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { Progress } from './progress'
import { Input } from './input'
import { Label } from './label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// Security types
interface SecurityEvent {
  id: string
  type: 'login' | 'logout' | 'failed_login' | 'password_change' | 'mfa_enabled' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId: string
  userName: string
  description: string
  ipAddress: string
  userAgent: string
  timestamp: Date
  resolved: boolean
}

interface UserSession {
  id: string
  userId: string
  userName: string
  email: string
  loginTime: Date
  lastActivity: Date
  ipAddress: string
  userAgent: string
  isActive: boolean
  deviceType: 'desktop' | 'mobile' | 'tablet'
  location: string
}

interface SecurityMetric {
  category: string
  score: number
  issues: string[]
  recommendations: string[]
}

export function SecurityDashboard() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([])
  const [securityScore, setSecurityScore] = useState(85)
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null)
  const [showMfaSetup, setShowMfaSetup] = useState(false)

  // Simulate security data
  useEffect(() => {
    // Generate mock security events
    const mockEvents: SecurityEvent[] = [
      {
        id: '1',
        type: 'login',
        severity: 'low',
        userId: 'user1',
        userName: 'John Doe',
        description: 'Successful login from new device',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        resolved: false
      },
      {
        id: '2',
        type: 'failed_login',
        severity: 'medium',
        userId: 'user2',
        userName: 'Jane Smith',
        description: 'Multiple failed login attempts',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        resolved: false
      },
      {
        id: '3',
        type: 'suspicious_activity',
        severity: 'high',
        userId: 'user3',
        userName: 'Bob Wilson',
        description: 'Unusual access pattern detected',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1)',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        resolved: false
      }
    ]

    setSecurityEvents(mockEvents)

    // Generate mock active sessions
    const mockSessions: UserSession[] = [
      {
        id: 'sess1',
        userId: 'user1',
        userName: 'John Doe',
        email: 'john@example.com',
        loginTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 5 * 60 * 1000),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        isActive: true,
        deviceType: 'desktop',
        location: 'New York, USA'
      },
      {
        id: 'sess2',
        userId: 'user2',
        userName: 'Jane Smith',
        email: 'jane@example.com',
        loginTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 15 * 60 * 1000),
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1)',
        isActive: true,
        deviceType: 'mobile',
        location: 'London, UK'
      }
    ]

    setActiveSessions(mockSessions)
  }, [])

  const securityMetrics: SecurityMetric[] = [
    {
      category: 'Authentication',
      score: 90,
      issues: ['Some users without MFA enabled'],
      recommendations: ['Enable MFA for all users', 'Implement password policies']
    },
    {
      category: 'Session Management',
      score: 85,
      issues: ['Long-lived sessions detected'],
      recommendations: ['Reduce session timeout', 'Implement session monitoring']
    },
    {
      category: 'Access Control',
      score: 95,
      issues: [],
      recommendations: ['Regular access audits']
    },
    {
      category: 'Data Protection',
      score: 88,
      issues: ['Some data not encrypted at rest'],
      recommendations: ['Implement full encryption', 'Regular security audits']
    }
  ]

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-500 bg-blue-500/10'
      case 'medium': return 'text-yellow-500 bg-yellow-500/10'
      case 'high': return 'text-orange-500 bg-orange-500/10'
      case 'critical': return 'text-red-500 bg-red-500/10'
      default: return 'text-gray-500 bg-gray-500/10'
    }
  }

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'login': return <UserCheck className="h-4 w-4" />
      case 'logout': return <UserX className="h-4 w-4" />
      case 'failed_login': return <ShieldX className="h-4 w-4" />
      case 'password_change': return <Key className="h-4 w-4" />
      case 'mfa_enabled': return <ShieldCheck className="h-4 w-4" />
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'desktop': return <Globe className="h-4 w-4" />
      case 'mobile': return <Smartphone className="h-4 w-4" />
      case 'tablet': return <Globe className="h-4 w-4" />
      default: return <Globe className="h-4 w-4" />
    }
  }

  const handleTerminateSession = (sessionId: string) => {
    setActiveSessions(prev => prev.map(session =>
      session.id === sessionId ? { ...session, isActive: false } : session
    ))
  }

  const handleResolveEvent = (eventId: string) => {
    setSecurityEvents(prev => prev.map(event =>
      event.id === eventId ? { ...event, resolved: true } : event
    ))
  }

  const criticalEvents = securityEvents.filter(e => e.severity === 'critical' && !e.resolved).length
  const highEvents = securityEvents.filter(e => e.severity === 'high' && !e.resolved).length
  const activeUsers = activeSessions.filter(s => s.isActive).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Security Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor security events and manage access control
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-3 w-3 mr-1" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-3 w-3 mr-1" />
            Settings
          </Button>
        </div>
      </div>

      {/* Security Score Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Score
            <Badge className={cn(
              securityScore >= 90 ? 'bg-green-500/10 text-green-500' :
              securityScore >= 70 ? 'bg-yellow-500/10 text-yellow-500' :
              'bg-red-500/10 text-red-500'
            )}>
              {securityScore}/100
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {securityMetrics.map((metric) => (
              <div key={metric.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{metric.category}</span>
                  <span className="text-sm text-gray-500">{metric.score}%</span>
                </div>
                <Progress value={metric.score} className="h-2" />
                {metric.issues.length > 0 && (
                  <div className="text-xs text-orange-500">
                    {metric.issues.length} issue{metric.issues.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Critical Events</p>
                <p className="text-2xl font-bold text-red-500">{criticalEvents}</p>
              </div>
              <ShieldX className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">High Priority</p>
                <p className="text-2xl font-bold text-orange-500">{highEvents}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-blue-500">{activeUsers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed Logins</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {securityEvents.filter(e => e.type === 'failed_login').length}
                </p>
              </div>
              <Lock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Events and Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Security Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
            <CardDescription>Latest security-related activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {securityEvents.slice(0, 5).map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex items-start justify-between p-3 rounded-lg border",
                    event.resolved && "opacity-50",
                    getSeverityColor(event.severity)
                  )}
                >
                  <div className="flex items-start gap-3">
                    {getEventTypeIcon(event.type)}
                    <div>
                      <p className="font-medium text-sm">{event.description}</p>
                      <p className="text-xs opacity-75 mt-1">
                        {event.userName} • {format(event.timestamp, 'HH:mm:ss')}
                      </p>
                      <p className="text-xs opacity-60">
                        IP: {event.ipAddress}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {event.severity}
                    </Badge>
                    {!event.resolved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolveEvent(event.id)}
                        className="h-6 w-6 p-0"
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Currently active user sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeSessions.filter(s => s.isActive).slice(0, 5).map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex items-start gap-3">
                    {getDeviceIcon(session.deviceType)}
                    <div>
                      <p className="font-medium text-sm">{session.userName}</p>
                      <p className="text-xs text-gray-500">{session.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {session.location} • {format(session.lastActivity, 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTerminateSession(session.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Unlock className="h-3 w-3 mr-1" />
                    Terminate
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Security Recommendations</CardTitle>
          <CardDescription>Actions to improve your security posture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {securityMetrics.map((metric) => (
              <div key={metric.category} className="space-y-2">
                <h4 className="font-medium text-sm">{metric.category}</h4>
                {metric.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-400">{rec}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}