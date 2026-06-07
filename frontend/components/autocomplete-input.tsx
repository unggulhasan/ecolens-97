"use client"

import * as React from "react"
import { Input } from "./ui/input"

interface AutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  suggestions: string[]
  onSelectSuggestion?: (value: string) => void
  containerClassName?: string
}

export function AutocompleteInput({
  suggestions,
  value,
  onChange,
  onSelectSuggestion,
  className = "",
  containerClassName = "",
  ...props
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const inputValue = typeof value === "string" ? value : ""

  const filteredSuggestions = React.useMemo(() => {
    if (!inputValue.trim()) return []
    const val = inputValue.toLowerCase()
    return suggestions.filter(
      (s) => s.toLowerCase().includes(val) && s.toLowerCase() !== val
    )
  }, [inputValue, suggestions])

  // Handle click outside to close the suggestions dropdown
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredSuggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveSuggestionIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveSuggestionIndex((prev) => (prev > -1 ? prev - 1 : prev))
    } else if (e.key === "Enter") {
      if (showSuggestions && activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
        e.preventDefault()
        selectSuggestion(filteredSuggestions[activeSuggestionIndex])
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (suggestion: string) => {
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion)
    } else if (onChange) {
      const mockEvent = {
        target: { value: suggestion }
      } as React.ChangeEvent<HTMLInputElement>
      onChange(mockEvent)
    }
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }

  return (
    <div ref={containerRef} className={`relative w-full ${containerClassName}`}>
      <Input
        value={value}
        onChange={(e) => {
          if (onChange) onChange(e)
          setShowSuggestions(true)
          setActiveSuggestionIndex(-1)
        }}
        onFocus={() => {
          setShowSuggestions(true)
          setActiveSuggestionIndex(-1)
        }}
        onKeyDown={handleKeyDown}
        className={className}
        {...props}
      />

      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm shadow-md focus:outline-none bg-white dark:bg-slate-950">
          {filteredSuggestions.map((suggestion, idx) => {
            const isActive = idx === activeSuggestionIndex
            return (
              <li
                key={suggestion}
                onClick={() => selectSuggestion(suggestion)}
                className={`relative cursor-pointer select-none px-4 py-2 text-foreground ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {suggestion}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
