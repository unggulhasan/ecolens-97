import { redirect } from "next/navigation"
import { signOut } from "@/auth"
import { getAuthBaseUrl, getCognitoLogoutUrl } from "@/lib/cognito"

export async function GET() {
  await signOut({ redirect: false })
  redirect(getCognitoLogoutUrl(`${getAuthBaseUrl()}/login`))
}
