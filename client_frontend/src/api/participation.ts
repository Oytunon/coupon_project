import { API_URL } from '../config/api'
import { getAuthHeaders } from '../config/auth'
import { apiClient } from './client'

type ParticipationResponse = {
  can_join: boolean
  joined: boolean
  score?: number
  rank?: number
}

export async function getParticipationStatus(username: string, eventId?: number, slug?: string): Promise<ParticipationResponse> {
  let url = `/api/has-joined?username=${encodeURIComponent(username)}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  const res = await apiClient.get<ParticipationResponse>(url)
  return res.data
}

export async function joinCampaign(username: string, eventId?: number, slug?: string) {
  let url = `/api/join?username=${encodeURIComponent(username)}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  // Use apiClient (Axios) to ensure errors (400, 403) contain the response body
  const res = await apiClient.post(url)
  return res.data
}

export async function getLeaderboard(slug?: string, eventId?: number, limit: number = 50) {
  let url = `/api/leaderboard?limit=${limit}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  const res = await apiClient.get(url)
  return res.data
}

export async function getMyCoupons(username: string, slug?: string, eventId?: number) {
  let url = `/api/my-coupons?username=${encodeURIComponent(username)}`
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`
  } else if (eventId) {
    url += `&event_id=${eventId}`
  }

  const res = await apiClient.get(url)
  return res.data
}
