import { API_URL } from '../config/api'
import { getAuthHeaders } from '../config/auth'

type ParticipationResponse = {
  can_join: boolean
}

export async function getParticipationStatus(username: string): Promise<ParticipationResponse> {
  const res = await fetch(
    `${API_URL}/api/has-joined?username=${encodeURIComponent(username)}`,
    {
      headers: getAuthHeaders()
    }
  )

  if (!res.ok) {
    throw new Error("API error")
  }

  return res.json()
}

export async function joinCampaign(username: string) {
  const res = await fetch(
    `${API_URL}/api/join?username=${encodeURIComponent(username)}`,
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
