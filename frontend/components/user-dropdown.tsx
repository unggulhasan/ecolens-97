"use client"

import { useState, useRef, useEffect } from "react"
import { signOutWithCognito } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"

type UserDropdownProps = {
  user: {
    name?: string | null
    email?: string | null
  }
}

export function UserDropdown({ user }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const displayName = user.name || user.email?.split("@")[0] || "User"
  const firstChar = displayName.charAt(0).toUpperCase()

  return (
    <div className="user-dropdown-container" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="user-dropdown-trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="user-dropdown-avatar">{firstChar}</div>
        <span>{displayName}</span>
        <svg
          className={`user-dropdown-arrow ${isOpen ? "open" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="user-dropdown-menu">
          <div className="user-dropdown-header">
            {user.email && <p className="user-dropdown-email">{user.email}</p>}
          </div>
          <div className="user-dropdown-divider" />
          <form action={signOutWithCognito} className="user-dropdown-action">
            <Button type="submit" variant="ghost" className="user-dropdown-logout-btn">
              Log out
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
