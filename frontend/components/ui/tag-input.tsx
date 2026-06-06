"use client"

import * as React from "react"

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  disabled = false,
  className = "",
  id
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filteredSuggestions = React.useMemo(() => {
    if (!suggestions || !inputValue.trim()) return []
    const val = inputValue.toLowerCase()
    return suggestions.filter(
      (s) => s.toLowerCase().includes(val) && !tags.includes(s.toLowerCase())
    )
  }, [inputValue, suggestions, tags])

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

  const handleAddTag = (tagText: string) => {
    const trimmed = tagText.trim().toLowerCase()
    if (!trimmed) return

    // Avoid duplicates
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInputValue("")
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }

  const handleRemoveTag = (indexToRemove: number) => {
    if (disabled) return
    onChange(tags.filter((_, idx) => idx !== indexToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === "ArrowDown" && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestions(true)
      setActiveSuggestionIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === "ArrowUp" && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestions(true)
      setActiveSuggestionIndex((prev) => (prev > -1 ? prev - 1 : prev))
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      if (showSuggestions && activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
        handleAddTag(filteredSuggestions[activeSuggestionIndex])
      } else {
        handleAddTag(inputValue)
      }
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      e.preventDefault()
      handleRemoveTag(tags.length - 1)
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    
    // Split by comma, semicolon, or newlines
    const splitTags = pastedText
      .split(/[,;\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)

    if (splitTags.length > 0) {
      const uniqueNewTags = splitTags.filter(t => !tags.includes(t))
      if (uniqueNewTags.length > 0) {
        onChange([...tags, ...uniqueNewTags])
      }
    }
    setInputValue("")
    setShowSuggestions(false)
  }

  const handleContainerClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }

  const selectSuggestion = (suggestion: string) => {
    handleAddTag(suggestion)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={handleContainerClick}
        className={`flex min-h-10 w-full flex-wrap items-center gap-2 rounded-full border border-input px-5 py-1.5 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-text"
        } ${className.includes("bg-") ? "" : "bg-background"} ${className}`}
      >
        {/* Tag Pills */}
        {tags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold text-secondary-foreground border border-border"
          >
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveTag(idx)
                }}
                className="text-muted-foreground hover:text-foreground shrink-0 focus:outline-none"
                aria-label={`Remove tag ${tag}`}
              >
                <svg
                  className="size-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </span>
        ))}

        {/* Input element */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
            setActiveSuggestionIndex(-1)
          }}
          onFocus={() => {
            setShowSuggestions(true)
            setActiveSuggestionIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={tags.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent outline-none border-0 p-0 text-sm focus:ring-0 focus:outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {/* Dropdown Suggestions */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm shadow-md focus:outline-none bg-white dark:bg-slate-950">
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
