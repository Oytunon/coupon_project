type ParticipationResponse = {
  username: string
  can_join: boolean
}

export async function getParticipationStatus(username: string): Promise<ParticipationResponse> {
  const res = await fetch(
    `http://127.0.0.1:8000/api/has-joined?username=${username}`
  )

  if (!res.ok) {
    throw new Error("API error")
  }

  return res.json()
}

export async function joinCampaign(username: string) {
  const res = await fetch("http://127.0.0.1:8000/api/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username }),
  })

  if (!res.ok) {
    throw new Error("Join failed")
  }

  return res.json()
}
