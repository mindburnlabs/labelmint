import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency values
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// Format TON cryptocurrency values
export function formatTon(amount: number): string {
  return `${amount.toFixed(4)} TON`
}

// Format USDT values
export function formatUsdt(amount: number): string {
  return `$${amount.toFixed(2)} USDT`
}

// Format date with relative time
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInMs = now.getTime() - dateObj.getTime()
  const diffInHours = diffInMs / (1000 * 60 * 60)

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    return diffInMinutes <= 1 ? 'just now' : `${diffInMinutes} minutes ago`
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`
  } else if (diffInHours < 48) {
    return 'yesterday'
  } else {
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
}

// Generate initials from a name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Generate random ID
export function generateId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Calculate completion percentage
export function calculatePercentage(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.min(Math.round((completed / total) * 100), 100)
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy text: ', error)
    return false
  }
}

// Download file from URL
export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Check if device is mobile
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 768
}

// Get system theme preference
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Smooth scroll to element
export function scrollToElement(elementId: string, offset = 0): void {
  const element = document.getElementById(elementId)
  if (element) {
    const top = element.offsetTop - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }
}

// Generate color from string (for avatars, etc.)
export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 60%)`
}

// Format large numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// Check if element is in viewport
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

// Parse and validate URL
export function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_) {
    return false
  }
}

// Local storage helpers
export const storage = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
  remove: (key: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
      localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  },
  clear: (): boolean => {
    if (typeof window === 'undefined') return false
    try {
      localStorage.clear()
      return true
    } catch {
      return false
    }
  },
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Error handling
export class LabelMintError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'LabelMintError'
  }
}

// Retry function with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
      }
    }
  }

  throw lastError!
}

// Status color mapping for LabelMint
export const statusColors = {
  // Project Statuses
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  PAUSED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',

  // Task Statuses
  PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  SUBMITTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',

  // Payment Statuses
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',

  // Worker Statuses
  ONLINE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  OFFLINE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  BUSY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
} as const

// Task types mapping
export const taskTypes = {
  IMAGE_CLASSIFICATION: 'Image Classification',
  TEXT_CLASSIFICATION: 'Text Classification',
  BOUNDING_BOXES: 'Bounding Boxes',
  SEGMENTATION: 'Segmentation',
  TRANSCRIPTION: 'Transcription',
  TRANSLATION: 'Translation',
  SENTIMENT_ANALYSIS: 'Sentiment Analysis',
  ENTITY_RECOGNITION: 'Entity Recognition',
  SUMMARIZATION: 'Summarization',
  RLHF: 'RLHF (Reinforcement Learning)',
} as const

// Priority levels
export const priorityLevels = {
  LOW: { value: 1, color: 'bg-gray-100 text-gray-800', label: 'Low' },
  MEDIUM: { value: 2, color: 'bg-blue-100 text-blue-800', label: 'Medium' },
  HIGH: { value: 3, color: 'bg-yellow-100 text-yellow-800', label: 'High' },
  URGENT: { value: 4, color: 'bg-red-100 text-red-800', label: 'Urgent' },
} as const