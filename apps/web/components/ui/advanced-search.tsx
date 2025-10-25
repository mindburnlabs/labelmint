'use client'

import * as React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Calendar,
  Tag,
  User,
  FileText,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  Save,
  Settings,
  HelpCircle,
  Command
} from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { Badge } from './badge'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { cn } from '@/lib/utils'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

// Filter types
interface FilterOption {
  id: string
  label: string
  type: 'text' | 'select' | 'date' | 'number' | 'boolean' | 'multiselect'
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  defaultValue?: any
}

interface SavedSearch {
  id: string
  name: string
  query: string
  filters: Record<string, any>
  createdAt: Date
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: Record<string, any>) => void
  onClear?: () => void
  placeholder?: string
  filterOptions: FilterOption[]
  savedSearches?: SavedSearch[]
  showSaveSearch?: boolean
  showExport?: boolean
  className?: string
  shortcuts?: Record<string, () => void>
}

export function AdvancedSearch({
  onSearch,
  onClear,
  placeholder = "Search...",
  filterOptions,
  savedSearches = [],
  showSaveSearch = true,
  showExport = true,
  className,
  shortcuts = {}
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [showSavedSearches, setShowSavedSearches] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Generate search suggestions based on recent searches and popular terms
  const generateSuggestions = useCallback((input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const popularTerms = ['active projects', 'completed tasks', 'high priority', 'this week', 'last month']

    const allSuggestions = [
      ...recentSearches.filter((term: string) => term.toLowerCase().includes(input.toLowerCase())),
      ...popularTerms.filter(term => term.toLowerCase().includes(input.toLowerCase()))
    ].slice(0, 8)

    setSuggestions(allSuggestions)
    setShowSuggestions(true)
    setHighlightedSuggestion(0)
  }, [])

  // Handle search input change
  const handleQueryChange = (value: string) => {
    setQuery(value)
    generateSuggestions(value)
  }

  // Handle search submission
  const handleSearch = useCallback((searchQuery?: string) => {
    const finalQuery = searchQuery || query
    onSearch(finalQuery, filters)

    // Save to recent searches
    if (finalQuery.trim()) {
      const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]')
      const updatedSearches = [finalQuery, ...recentSearches.filter((s: string) => s !== finalQuery)].slice(0, 10)
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches))
    }

    setShowSuggestions(false)
  }, [query, filters, onSearch])

  // Handle filter change
  const handleFilterChange = (filterId: string, value: any) => {
    const newFilters = { ...filters, [filterId]: value }
    setFilters(newFilters)
    handleSearch(query, newFilters)
  }

  // Clear all filters and search
  const handleClear = () => {
    setQuery('')
    setFilters({})
    setShowSuggestions(false)
    onClear?.()
  }

  // Apply saved search
  const applySavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query)
    setFilters(savedSearch.filters)
    onSearch(savedSearch.query, savedSearch.filters)
    setShowSavedSearches(false)
  }

  // Save current search
  const saveCurrentSearch = () => {
    if (!query.trim()) return

    const name = prompt('Enter a name for this search:')
    if (!name) return

    const newSavedSearch: SavedSearch = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      query,
      filters,
      createdAt: new Date()
    }

    // In a real app, this would be saved to a backend
    const existing = JSON.parse(localStorage.getItem('savedSearches') || '[]')
    localStorage.setItem('savedSearches', JSON.stringify([...existing, newSavedSearch]))

    alert('Search saved successfully!')
  }

  // Export search results
  const exportResults = (format: 'csv' | 'excel' | 'pdf') => {
    // In a real app, this would trigger an API call
    console.log(`Exporting results as ${format}`)
    alert(`Exporting results as ${format.toUpperCase()}`)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // Clear search on Escape
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        handleClear()
        searchInputRef.current?.blur()
      }

      // Show shortcuts on Cmd/Ctrl + /
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setShowShortcuts(!showShortcuts)
      }

      // Navigate suggestions
      if (showSuggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setHighlightedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setHighlightedSuggestion(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter' && suggestions[highlightedSuggestion]) {
          e.preventDefault()
          handleSearch(suggestions[highlightedSuggestion])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSuggestions, suggestions, highlightedSuggestion, showShortcuts])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasActiveFilters = Object.keys(filters).length > 0
  const activeFilterCount = Object.values(filters).filter(value =>
    value !== '' && value !== null && value !== undefined &&
    (Array.isArray(value) ? value.length > 0 : true)
  ).length

  return (
    <div className={cn("relative", className)}>
      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearch()
              }
            }}
            placeholder={placeholder}
            className="pl-10 pr-20 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
          />

          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {/* Filter button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-7 w-7 p-0",
                hasActiveFilters && "text-blue-600"
              )}
            >
              <Filter className="h-3 w-3" />
              {activeFilterCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* Clear button */}
            {(query || hasActiveFilters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 w-7 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}

            {/* Search button */}
            <Button
              size="sm"
              onClick={() => handleSearch()}
              className="h-7 px-2"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Search suggestions */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion}
                  className={cn(
                    "px-3 py-2 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-700",
                    index === highlightedSuggestion && "bg-gray-50 dark:bg-gray-700"
                  )}
                  onClick={() => handleSearch(suggestion)}
                >
                  <Search className="inline-block w-3 h-3 mr-2 text-gray-400" />
                  {suggestion}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Advanced filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  Advanced Filters
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterOptions.map((filter) => (
                    <div key={filter.id} className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {filter.label}
                      </label>

                      {filter.type === 'text' && (
                        <Input
                          value={filters[filter.id] || ''}
                          onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                          placeholder={filter.placeholder}
                        />
                      )}

                      {filter.type === 'select' && (
                        <Select
                          value={filters[filter.id] || ''}
                          onValueChange={(value) => handleFilterChange(filter.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={filter.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {filter.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {filter.type === 'date' && (
                        <Input
                          type="date"
                          value={filters[filter.id] || ''}
                          onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                        />
                      )}

                      {filter.type === 'number' && (
                        <Input
                          type="number"
                          value={filters[filter.id] || ''}
                          onChange={(e) => handleFilterChange(filter.id, parseFloat(e.target.value))}
                          placeholder={filter.placeholder}
                        />
                      )}

                      {filter.type === 'boolean' && (
                        <Select
                          value={filters[filter.id]?.toString() || ''}
                          onValueChange={(value) => handleFilterChange(filter.id, value === 'true')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          {/* Saved searches */}
          {showSaveSearch && (
            <DropdownMenu open={showSavedSearches} onOpenChange={setShowSavedSearches}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Save className="h-3 w-3 mr-1" />
                  Saved
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Saved Searches</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedSearches.length > 0 ? (
                  savedSearches.map((savedSearch) => (
                    <DropdownMenuItem
                      key={savedSearch.id}
                      onClick={() => applySavedSearch(savedSearch)}
                    >
                      <div>
                        <div className="font-medium">{savedSearch.name}</div>
                        <div className="text-xs text-gray-500">
                          {format(savedSearch.createdAt, 'MMM d, yyyy')}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No saved searches</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={saveCurrentSearch}>
                  <Save className="h-3 w-3 mr-2" />
                  Save current search
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export */}
          {showExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportResults('csv')}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportResults('excel')}>
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportResults('pdf')}>
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={() => handleSearch()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Keyboard shortcuts hint */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowShortcuts(!showShortcuts)}
        >
          <Command className="h-3 w-3 mr-1" />
          Shortcuts
        </Button>
      </div>

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowShortcuts(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Focus search</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">⌘K</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Clear search</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">ESC</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Show shortcuts</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">⌘/</kbd>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}