export function getUsernameFromUrl(): string | null {
  try {
    // URL'deki query parametrelerini al
    const search = window.location.search
    // Eğer URL encode edilmişse decode et
    const decodedSearch = decodeURIComponent(search)
    const params = new URLSearchParams(decodedSearch)
    
    // Önce playerUsername kontrol et (extrabet formatı)
    const playerUsername = params.get("playerUsername")
    if (playerUsername) {
      return playerUsername
    }
    
    // Fallback: username parametresi
  return params.get("username")
  } catch (error) {
    console.error("URL parsing error:", error)
    // Fallback: direkt search string'den al
    const playerUsernameMatch = window.location.search.match(/[?&]playerUsername=([^&]*)/)
    if (playerUsernameMatch) {
      return playerUsernameMatch[1]
    }
    const usernameMatch = window.location.search.match(/[?&]username=([^&]*)/)
    return usernameMatch ? usernameMatch[1] : null
  }
}
