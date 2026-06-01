"use client"

import { AuthWelcomePanel } from "@/components/auth-welcome-panel"
import { LoginFormPanel } from "@/components/login-form-panel"
import { SignupFormPanel } from "@/components/signup-form-panel"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type AuthSplitCardProps = {
  mode: "login" | "signup"
  redirectTo?: string
}

export function AuthSplitCard({ mode, redirectTo }: AuthSplitCardProps) {
  return (
    <Card className="auth-card">
      <div className="auth-card-grid">
        <AuthWelcomePanel />
        <Separator
          orientation="vertical"
          className="auth-separator auth-separator-vertical"
        />
        <Separator className="auth-separator auth-separator-horizontal" />
        <div className="auth-slider-container">
          <div
            className={cn(
              "auth-slider-track",
              mode === "signup" ? "slide-to-signup" : "slide-to-login"
            )}
          >
            <div className="auth-slider-slide">
              <LoginFormPanel redirectTo={redirectTo} />
            </div>
            <div className="auth-slider-slide">
              <SignupFormPanel />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
