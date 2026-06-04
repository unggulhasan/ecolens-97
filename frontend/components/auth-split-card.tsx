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
    <Card className="authCard">
      <div className="authCardGrid">
        <AuthWelcomePanel />
        <Separator
          orientation="vertical"
          className="authSeparator authSeparatorVertical"
        />
        <Separator className="authSeparator authSeparatorHorizontal" />
        <div className="authSliderContainer">
          <div
            className={cn(
              "authSliderTrack",
              mode === "signup" ? "slideToSignup" : "slideToLogin"
            )}
          >
            <div className="authSliderSlide">
              <LoginFormPanel redirectTo={redirectTo} />
            </div>
            <div className="authSliderSlide">
              <SignupFormPanel />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
