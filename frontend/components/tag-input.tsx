"use client"

import * as React from "react"
import { TagPill } from "@/components/tag-pill"
import { SuggestionsList } from "@/components/suggestions-list"

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  inputValue?: string
  onInputChange?: (value: string) => void
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  disabled = false,
  className = "",
  id,
  inputValue: controlledInputValue,
  onInputChange
}: TagInputProps) {
  const [internalInputValue, setInternalInputValue] = React.useState("")
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isControlled = controlledInputValue !== undefined
  const inputValue = isControlled ? controlledInputValue : internalInputValue

  const setInputValue = (val: string) => {
    if (onInputChange) {
      onInputChange(val)
    }
    if (!isControlled) {
      setInternalInputValue(val)
    }
  }

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
          <TagPill
            key={`${tag}-${idx}`}
            tag={tag}
            onRemove={() => handleRemoveTag(idx)}
            disabled={disabled}
          />
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
      {showSuggestions && (
        <SuggestionsList
          suggestions={filteredSuggestions}
          activeIndex={activeSuggestionIndex}
          onSelect={selectSuggestion}
        />
      )}
    </div>
  )
}
