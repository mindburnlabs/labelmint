'use client'

import * as React from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
  ReferenceLine,
  Brush,
  ErrorBoundary
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { cn } from '@/lib/utils'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

// Enhanced color palette for charts
const CHART_COLORS = {
  primary: ['#0ea5e9', '#06b6d4', '#0891b2', '#0e7490', '#155e75'],
  secondary: ['#8b5cf6', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9'],
  success: ['#10b981', '#34d399', '#10b981', '#059669', '#047857'],
  warning: ['#f59e0b', '#fbbf24', '#f59e0b', '#d97706', '#b45309'],
  error: ['#ef4444', '#f87171', '#ef4444', '#dc2626', '#b91c1c'],
  info: ['#3b82f6', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
  gradient: {
    blue: { start: '#0ea5e9', end: '#0891b2' },
    purple: { start: '#8b5cf6', end: '#7c3aed' },
    green: { start: '#10b981', end: '#059669' },
    orange: { start: '#f59e0b', end: '#d97706' }
  }
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, formatter }: TooltipProps<any, any>) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {entry.name}:
              </span>
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatter ? formatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </motion.div>
    )
  }
  return null
}

// Animated metric card
interface AnimatedMetricCardProps {
  title: string
  value: number | string
  change?: number
  changeType?: 'increase' | 'decrease'
  icon?: React.ReactNode
  description?: string
  trend?: Array<{ time: string; value: number }>
}

export function AnimatedMetricCard({
  title,
  value,
  change,
  changeType = 'increase',
  icon,
  description,
  trend
}: AnimatedMetricCardProps) {
  const [displayValue, setDisplayValue] = React.useState(0)
  const numericValue = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.-]/g, ''))

  React.useEffect(() => {
    const duration = 1000
    const steps = 60
    const increment = numericValue / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= numericValue) {
        current = numericValue
        clearInterval(timer)
      }
      setDisplayValue(current)
    }, duration / steps)

    return () => clearInterval(timer)
  }, [numericValue])

  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {icon}
          {change !== undefined && (
            <Badge
              variant={changeType === 'increase' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {changeType === 'increase' ? '↑' : '↓'} {Math.abs(change)}%
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {typeof value === 'string' ? value : displayValue.toLocaleString()}
        </div>

        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {description}
          </p>
        )}

        {trend && trend.length > 1 && (
          <div className="mt-3 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS.primary[0]}
                  fill={`url(#gradient-${title})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Interactive line chart with real-time updates
interface InteractiveLineChartProps {
  data: any[]
  lines: Array<{
    dataKey: string
    color?: string
    strokeWidth?: number
    name: string
  }>
  title?: string
  description?: string
  height?: number
  showGrid?: boolean
  showBrush?: boolean
  showLegend?: boolean
  onPointClick?: (data: any) => void
}

export function InteractiveLineChart({
  data,
  lines,
  title,
  description,
  height = 300,
  showGrid = true,
  showBrush = false,
  showLegend = true,
  onPointClick
}: InteractiveLineChartProps) {
  const [selectedRange, setSelectedRange] = React.useState<[number, number] | null>(null)

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            )}

            <XAxis
              dataKey="time"
              className="text-xs text-gray-500"
              tick={{ fill: 'currentColor' }}
            />

            <YAxis
              className="text-xs text-gray-500"
              tick={{ fill: 'currentColor' }}
            />

            <Tooltip content={<CustomTooltip />} />

            {showLegend && <Legend />}

            {lines.map((line, index) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color || CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                strokeWidth={line.strokeWidth || 2}
                dot={{ r: 4, cursor: 'pointer' }}
                activeDot={{ r: 6, onClick: (e: any) => onPointClick?.(e.payload) }}
                name={line.name}
              />
            ))}

            {showBrush && <Brush dataKey="time" height={30} />}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Interactive area chart with gradient fill
interface InteractiveAreaChartProps {
  data: any[]
  areas: Array<{
    dataKey: string
    color?: string
    fillOpacity?: number
    name: string
  }>
  title?: string
  description?: string
  height?: number
  stacked?: boolean
}

export function InteractiveAreaChart({
  data,
  areas,
  title,
  description,
  height = 300,
  stacked = false
}: InteractiveAreaChartProps) {
  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              {areas.map((area, index) => (
                <linearGradient key={area.dataKey} id={`area-gradient-${area.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={area.color || CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                    stopOpacity={area.fillOpacity || 0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={area.color || CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="time" className="text-xs text-gray-500" />
            <YAxis className="text-xs text-gray-500" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {areas.map((area, index) => (
              <Area
                key={area.dataKey}
                type="monotone"
                dataKey={area.dataKey}
                stroke={area.color || CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                fillOpacity={1}
                fill={`url(#area-gradient-${area.dataKey})`}
                stackId={stacked ? 'stack' : undefined}
                name={area.name}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Interactive bar chart
interface InteractiveBarChartProps {
  data: any[]
  bars: Array<{
    dataKey: string
    color?: string
    name: string
  }>
  title?: string
  description?: string
  height?: number
  layout?: 'horizontal' | 'vertical'
  stacked?: boolean
}

export function InteractiveBarChart({
  data,
  bars,
  title,
  description,
  height = 300,
  layout = 'vertical',
  stacked = false
}: InteractiveBarChartProps) {
  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout={layout}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            {layout === 'vertical' ? (
              <>
                <XAxis dataKey="name" className="text-xs text-gray-500" />
                <YAxis className="text-xs text-gray-500" />
              </>
            ) : (
              <>
                <XAxis type="number" className="text-xs text-gray-500" />
                <YAxis dataKey="name" type="category" className="text-xs text-gray-500" />
              </>
            )}

            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {bars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                fill={bar.color || CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                stackId={stacked ? 'stack' : undefined}
                name={bar.name}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Interactive pie chart
interface InteractivePieChartProps {
  data: Array<{
    name: string
    value: number
    color?: string
  }>
  title?: string
  description?: string
  height?: number
  showLabels?: boolean
  showLegend?: boolean
  innerRadius?: number
  outerRadius?: number
}

export function InteractivePieChart({
  data,
  title,
  description,
  height = 300,
  showLabels = true,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80
}: InteractivePieChartProps) {
  const [activeIndex, setActiveIndex] = React.useState(0)

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (!showLabels) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={outerRadius}
              innerRadius={innerRadius}
              fill="#8884d8"
              dataKey="value"
              onMouseEnter={onPieEnter}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                  style={{
                    filter: activeIndex === index ? 'brightness(1.1)' : 'brightness(1)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Real-time chart component
interface RealTimeChartProps {
  dataKey: string
  title: string
  maxDataPoints?: number
  updateInterval?: number
  height?: number
}

export function RealTimeChart({
  dataKey,
  title,
  maxDataPoints = 50,
  updateInterval = 1000,
  height = 200
}: RealTimeChartProps) {
  const [data, setData] = React.useState<Array<{ time: string; value: number }>>([])

  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const newDataPoint = {
        time: format(now, 'HH:mm:ss'),
        value: Math.random() * 100
      }

      setData(prevData => {
        const newData = [...prevData, newDataPoint]
        return newData.slice(-maxDataPoints)
      })
    }, updateInterval)

    return () => clearInterval(interval)
  }, [dataKey, maxDataPoints, updateInterval])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </CardTitle>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.primary[0]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <XAxis dataKey="time" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}