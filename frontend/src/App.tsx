import { useEffect, useState } from "react"
import { getParticipationStatus, joinCampaign } from "./api/participation"
import { JoinButton } from "./components/JoinButton"
import { getUsernameFromUrl } from "./utils/useUsername"

function App() {
  const [canJoin, setCanJoin] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getUsernameFromUrl()
    setUsername(u)

    if (!u) {
      setLoading(false)
      return
    }

    getParticipationStatus(u)
      .then((res) => setCanJoin(res.can_join))
      .finally(() => setLoading(false))
  }, [])

  const handleJoin = async () => {
    if (!username) return

    try {
      await joinCampaign(username)
      setCanJoin(false) // butonu gizle
    } catch (e) {
      alert("Katılım başarısız")
    }
  }

  if (loading) return <div>Yükleniyor...</div>

  if (!username) return <div>Kullanıcı bulunamadı</div>

  return (
    <div style={{ padding: 20 }}>
      <h3>Coupon Campaign</h3>
      <p>Hoşgeldin {username}</p>

      <JoinButton canJoin={canJoin} onJoin={handleJoin} />
    </div>
  )
}

export default App
