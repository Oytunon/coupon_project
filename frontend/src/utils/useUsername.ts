export function getUsernameFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get("username")
}
