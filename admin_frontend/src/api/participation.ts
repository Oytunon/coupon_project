import { API_URL } from '../config/api'
import { getAuthHeaders } from '../config/auth'

type ParticipationResponse = {
  can_join: boolean
  score?: number
  rank?: number
}

export async function getParticipationStatus(username: string, eventId?: number, slug?: string): Promise<ParticipationResponse> {
  let url = `${API_URL}/api/has-joined?username=${encodeURIComponent(username)}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  const res = await fetch(
    url,
    {
      headers: getAuthHeaders()
    }
  )

  if (!res.ok) {
    throw new Error("API error")
  }

  return res.json()
}

export async function joinCampaign(username: string, eventId?: number, slug?: string) {
  let url = `${API_URL}/api/join?username=${encodeURIComponent(username)}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  const res = await fetch(
    url,
    {
      method: "POST",
      headers: getAuthHeaders()
    }
  )

  if (!res.ok) {
    throw new Error("Join failed")
  }

  return res.json()
}

export async function getLeaderboard(slug?: string, eventId?: number, limit: number = 50) {
  let url = `${API_URL}/api/leaderboard?limit=${limit}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error("Leaderboard fetch failed")
  return res.json()
}

export async function getMyCoupons(username: string, slug?: string, eventId?: number) {
  let url = `${API_URL}/api/my-coupons?username=${encodeURIComponent(username)}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error("My Coupons fetch failed")
  return res.json()
}
