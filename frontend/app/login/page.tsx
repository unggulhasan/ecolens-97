import { AuthSplitCard } from "@/components/auth-split-card"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 p-6">
      <AuthSplitCard redirectTo="/dashboard" />
    </div>
  )
}
