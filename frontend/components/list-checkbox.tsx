"use client"

import * as React from "react"

type ListCheckboxProps = {
  checked: boolean
  onClick?: () => void
  onChange?: () => void
  className?: string
}

export function ListCheckbox({ checked, onClick, onChange, className }: ListCheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click trigger
    if (onClick) {
      onClick()
    } else if (onChange) {
      onChange()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`relative flex h-5 w-5 items-center justify-center rounded border-2 transition-colors bg-white ${
        checked ? "border-primary" : "border-border hover:border-primary"
      } ${className || ""}`}
    >
      {checked && (
        <div className="absolute inset-0 rounded bg-primary/15" />
      )}
      {checked && (
        <svg
          className="relative z-10 h-3 w-3 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </div>
  )
}
