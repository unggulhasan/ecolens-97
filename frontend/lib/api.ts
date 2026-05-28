export type HelloResponse = {
  message: string
}

export async function fetchHello(idToken: string): Promise<HelloResponse> {
  const baseUrl = process.env.API_BASE_URL
  if (!baseUrl) {
    throw new Error("API_BASE_URL is not configured")
  }

  const response = await fetch(`${baseUrl}/hello`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Hello API returned ${response.status}`)
  }

  return response.json() as Promise<HelloResponse>
}
