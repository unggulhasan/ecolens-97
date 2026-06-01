const DEFAULT_AUTH_URL = "http://localhost:3000"

export function getAuthBaseUrl() {
  return (
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? DEFAULT_AUTH_URL
  )
}

export function getCognitoRegionFromIssuer(issuer: string) {
  const match = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)
  if (!match) {
    throw new Error("Could not parse AWS region from AUTH_COGNITO_ISSUER")
  }

  return match[1]
}

export function getCognitoSignUpAuthorizationUrl() {
  const domain = process.env.AUTH_COGNITO_DOMAIN
  const issuer = process.env.AUTH_COGNITO_ISSUER

  if (!domain || !issuer) {
    throw new Error(
      "AUTH_COGNITO_DOMAIN and AUTH_COGNITO_ISSUER must be configured"
    )
  }

  const region = getCognitoRegionFromIssuer(issuer)
  return `https://${domain}.auth.${region}.amazoncognito.com/signup`
}

export function getCognitoLogoutUrl(logoutUri = `${getAuthBaseUrl()}/login`) {
  const domain = process.env.AUTH_COGNITO_DOMAIN
  const clientId = process.env.AUTH_COGNITO_ID
  const issuer = process.env.AUTH_COGNITO_ISSUER

  if (!domain || !clientId || !issuer) {
    throw new Error(
      "AUTH_COGNITO_DOMAIN, AUTH_COGNITO_ID, and AUTH_COGNITO_ISSUER must be configured"
    )
  }

  const region = getCognitoRegionFromIssuer(issuer)
  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  })

  return `https://${domain}.auth.${region}.amazoncognito.com/logout?${params.toString()}`
}
