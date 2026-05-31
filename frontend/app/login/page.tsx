import { AuthSplitCard } from "@/components/auth-split-card"

export default function LoginPage() {
  return (
    <div className="auth-page">
      <AuthSplitCard redirectTo="/dashboard" />
    </div>
  )
}
