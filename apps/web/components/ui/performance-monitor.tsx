'use client'

import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Cpu,
  HardDrive,
  Wifi,
  Database,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Settings,
  RefreshCw,
  Download,
  AlertCircle,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { Progress } from './progress'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// Performance metrics types
interface PerformanceMetrics {
  timestamp: Date
  cpu: number
  memory: number
  network: number
  disk: number
  responseTime: number
  errorRate: number
  throughput: number
  activeUsers: number
  queueSize: number
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  overall: number
  services: {
    api: number
    database: number
    cache: number
    queue: number
    storage: number
  }
  lastChecked: Date
}

interface ErrorAlert {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  service: string
  timestamp: Date
  resolved: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [errorAlerts, setErrorAlerts] = useState<ErrorAlert[]>([])
  const [isLive, setIsLive] = useState(true)
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h')
  const [selectedMetric, setSelectedMetric] = useState<string>('cpu')

  // Simulate real-time metrics
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      const newMetric: PerformanceMetrics = {
        timestamp: new Date(),
        cpu: Math.random() * 100,
        memory: 60 + Math.random() * 30,
        network: 20 + Math.random() * 60,
        disk: 40 + Math.random() * 40,
        responseTime: 50 + Math.random() * 200,
        errorRate: Math.random() * 5,
        throughput: 100 + Math.random() * 500,
        activeUsers: 50 + Math.floor(Math.random() * 200),
        queueSize: Math.floor(Math.random() * 100)
      }

      setMetrics(prev => [...prev.slice(-50), newMetric])
    }, 2000)

    return () => clearInterval(interval)
  }, [isLive])

  // Simulate system health updates
  useEffect(() => {
    const interval = setInterval(() => {
      const health: SystemHealth = {
        status: Math.random() > 0.8 ? 'warning' : Math.random() > 0.95 ? 'critical' : 'healthy',
        overall: 70 + Math.random() * 30,
        services: {
          api: 80 + Math.random() * 20,
          database: 75 + Math.random() * 25,
          cache: 85 + Math.random() * 15,
          queue: 70 + Math.random() * 30,
          storage: 90 + Math.random() * 10
        },
        lastChecked: new Date()
      }
      setSystemHealth(health)

      // Generate random error alerts
      if (Math.random() > 0.9) {
        const newAlert: ErrorAlert = {
          id: Math.random().toString(36).substr(2, 9),
          type: Math.random() > 0.7 ? 'error' : Math.random() > 0.5 ? 'warning' : 'info',
          message: [
            'High memory usage detected',
            'API response time exceeding threshold',
            'Database connection pool exhausted',
            'Cache miss rate increased',
            'Queue processing delay detected'
          ][Math.floor(Math.random() * 5)],
          service: ['API', 'Database', 'Cache', 'Queue', 'Storage'][Math.floor(Math.random() * 5)],
          timestamp: new Date(),
          resolved: false,
          severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any
        }
        setErrorAlerts(prev => [newAlert, ...prev].slice(0, 20))
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500 bg-green-500/10'
      case 'warning': return 'text-yellow-500 bg-yellow-500/10'
      case 'critical': return 'text-red-500 bg-red-500/10'
      default: return 'text-gray-500 bg-gray-500/10'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-500 bg-blue-500/10'
      case 'medium': return 'text-yellow-500 bg-yellow-500/10'
      case 'high': return 'text-orange-500 bg-orange-500/10'
      case 'critical': return 'text-red-500 bg-red-500/10'
      default: return 'text-gray-500 bg-gray-500/10'
    }
  }

  const handleExportMetrics = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      'Timestamp,CPU,Memory,Network,Disk,Response Time,Error Rate,Throughput,Active Users,Queue Size\n' +
      metrics.map(m =>
        `${format(m.timestamp, 'yyyy-MM-dd HH:mm:ss')},${m.cpu.toFixed(2)},${m.memory.toFixed(2)},${m.network.toFixed(2)},${m.disk.toFixed(2)},${m.responseTime.toFixed(2)},${m.errorRate.toFixed(2)},${m.throughput.toFixed(2)},${m.activeUsers},${m.queueSize}`
      ).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `performance-metrics-${format(new Date(), 'yyyy-MM-dd')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const dismissAlert = (alertId: string) => {
    setErrorAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ))
  }

  const currentMetric = metrics[metrics.length - 1]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Performance Monitor
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time system performance and health monitoring
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['1h', '6h', '24h', '7d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="h-7 px-3 text-xs"
              >
                {range}
              </Button>
            ))}
          </div>

          {/* Live toggle */}
          <Button
            variant={isLive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className="flex items-center gap-2"
          >
            <div className={cn('w-2 h-2 rounded-full', isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400')} />
            {isLive ? 'Live' : 'Paused'}
          </Button>

          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExportMetrics}>
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={() => setMetrics([])}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
              <Badge className={cn(getStatusColor(systemHealth.status))}>
                {systemHealth.status.toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription>
              Last checked: {format(systemHealth.lastChecked, 'MMM d, yyyy HH:mm:ss')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(systemHealth.services).map(([service, score]) => (
                <div key={service} className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {score.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 uppercase">
                    {service}
                  </div>
                  <Progress
                    value={score}
                    className="mt-2 h-1"
                    indicatorClassName={
                      score > 80 ? 'bg-green-500' : score > 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {currentMetric && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</p>
                  <p className="text-2xl font-bold">{currentMetric.cpu.toFixed(1)}%</p>
                </div>
                <Cpu className="h-8 w-8 text-blue-500" />
              </div>
              <Progress value={currentMetric.cpu} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Memory</p>
                  <p className="text-2xl font-bold">{currentMetric.memory.toFixed(1)}%</p>
                </div>
                <HardDrive className="h-8 w-8 text-green-500" />
              </div>
              <Progress value={currentMetric.memory} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Response Time</p>
                  <p className="text-2xl font-bold">{currentMetric.responseTime.toFixed(0)}ms</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                  <p className="text-2xl font-bold">{currentMetric.activeUsers}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value as Date), 'HH:mm:ss')}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="CPU"
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Memory"
                />
                <Line
                  type="monotone"
                  dataKey="disk"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Disk"
                />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Network and Throughput Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Network & Throughput</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics}>
                <defs>
                  <linearGradient id="networkGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value as Date), 'HH:mm:ss')}
                />
                <Area
                  type="monotone"
                  dataKey="network"
                  stroke="#8b5cf6"
                  fill="url(#networkGradient)"
                  strokeWidth={2}
                  name="Network"
                />
                <Area
                  type="monotone"
                  dataKey="throughput"
                  stroke="#06b6d4"
                  fill="url(#throughputGradient)"
                  strokeWidth={2}
                  name="Throughput"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Error Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Alerts
            {errorAlerts.filter(a => !a.resolved).length > 0 && (
              <Badge variant="destructive">
                {errorAlerts.filter(a => !a.resolved).length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <AnimatePresence>
              {errorAlerts
                .filter(alert => !alert.resolved)
                .slice(0, 5)
                .map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={cn(
                      "flex items-start justify-between p-3 rounded-lg border",
                      getSeverityColor(alert.severity)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {alert.type === 'error' && <AlertCircle className="h-5 w-5 mt-0.5" />}
                      {alert.type === 'warning' && <AlertTriangle className="h-5 w-5 mt-0.5" />}
                      {alert.type === 'info' && <Info className="h-5 w-5 mt-0.5" />}

                      <div>
                        <p className="font-medium text-sm">{alert.message}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {alert.service} • {format(alert.timestamp, 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </motion.div>
                ))}
            </AnimatePresence>

            {errorAlerts.filter(a => !a.resolved).length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No active alerts</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}