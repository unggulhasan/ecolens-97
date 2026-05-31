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
