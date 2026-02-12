import { useEffect, useState, Fragment } from "react"
import { getParticipationStatus, joinCampaign, getLeaderboard, getMyCoupons, getMyEnrollments, getMyRewards } from "../api/participation"
import { getPublicEvents, PublicEvent } from "../api/client"
import { getUsernameFromUrl } from "../utils/useUsername"
import {
    Trophy, Loader2, FileText, Award, Gift,
    TrendingUp, ArrowUpRight, CheckCircle2, Ticket, List as ListIcon, LayoutGrid, Zap, BarChart3, Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TournamentCard } from "@/components/premium/TournamentCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClientLayout } from "@/components/layout/ClientLayout"

import { useParams } from "react-router-dom"

export default function UserDashboard() {
    const { eventId: paramEventId, username: paramUsername } = useParams()
    const [isJoined, setIsJoined] = useState(false)
    const [username, setUsername] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState(false)
    const [eventId, setEventId] = useState<number | null>(null)
    const [slug, setSlug] = useState<string | null>(null)
    const [publicEvents, setPublicEvents] = useState<PublicEvent[]>([])
    const [activeTab, setActiveTab] = useState("leaderboard")
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    const [myEnrollments, setMyEnrollments] = useState<any[]>([])
    const [myCoupons, setMyCoupons] = useState<any[]>([])
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
    const [loadingEnrollments, setLoadingEnrollments] = useState(false)
    const [loadingCoupons, setLoadingCoupons] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [expandedEventId, setExpandedEventId] = useState<number | null>(null)
    const [expandedLeaderboard, setExpandedLeaderboard] = useState<any[]>([])
    const [expandedCouponId, setExpandedCouponId] = useState<number | null>(null)
    const [myRewards, setMyRewards] = useState<any[]>([])
    const [loadingRewards, setLoadingRewards] = useState(false)

    const { toast } = useToast()

    useEffect(() => {
        let u = paramUsername || getUsernameFromUrl()
        if (paramUsername) u = paramUsername

        setUsername(u)

        const params = new URLSearchParams(window.location.search)

        // Event ID logic
        let rawEid = paramEventId || params.get("event_id")
        let parsedEid: number | null = null
        let sl: string | null = params.get("slug") || params.get("key")

        if (rawEid) {
            if (!isNaN(Number(rawEid))) {
                parsedEid = parseInt(rawEid)
            } else {
                sl = rawEid
            }
        }

        setEventId(parsedEid)
        setSlug(sl)

        const fetchData = async () => {
            if (!u) {
                setLoading(false)
                return
            }

            try {
                const status = await getParticipationStatus(u, parsedEid || undefined, sl || undefined)
                setIsJoined(status.joined)

                setLoadingCoupons(true)
                const coupons = await getMyCoupons(u, sl || undefined, parsedEid || undefined)
                setMyCoupons(coupons)

                setLoadingEnrollments(true)
                try {
                    const enrolls = await getMyEnrollments(u)
                    setMyEnrollments(enrolls)
                } catch (e) {
                    console.error("Enrollments error", e)
                } finally {
                    setLoadingEnrollments(false)
                }

                setLoadingRewards(true)
                try {
                    const rewards = await getMyRewards(u)
                    setMyRewards(rewards)
                } catch (e) {
                    console.error("Rewards error", e)
                } finally {
                    setLoadingRewards(false)
                }
            } catch (err) {
                console.error("User data error", err)
            } finally {
                setLoading(false)
                setLoadingCoupons(false)
            }
        }

        fetchData()
    }, [paramEventId, paramUsername])

    useEffect(() => {
        if (!username || !eventId) return

        const reloadCoupons = async () => {
            setLoadingCoupons(true)
            try {
                const coupons = await getMyCoupons(username, undefined, eventId)
                setMyCoupons(coupons)
            } catch (e) {
                console.error("Coupons reload error", e)
            } finally {
                setLoadingCoupons(false)
            }
        }
        reloadCoupons()
    }, [eventId, username])

    useEffect(() => {
        const loadEvents = async () => {
            try {
                const events = await getPublicEvents()
                if (Array.isArray(events)) {
                    const sortedEvents = [...events].sort((a, b) => {
                        if (a.status === 'active' && b.status !== 'active') return -1;
                        if (a.status !== 'active' && b.status === 'active') return 1;
                        return b.id - a.id;
                    });
                    setPublicEvents(sortedEvents)

                    if (!eventId && !slug && !paramEventId) {
                        const latestActive = events.find(e => e.status === 'active') || events[0]
                        if (latestActive) {
                            setEventId(latestActive.id)
                        }
                    }
                }
            } catch (e: any) {
                console.error("Failed events fetch", e)
                setFetchError(e.message || "Turnuvalar yüklenirken hata oluştu")
            }
        }
        loadEvents()
    }, [])

    const handleSwitchEvent = (id: number) => {
        let url = `/event/${id}`
        if (username) url += `?username=${username}`
        window.location.href = url
    }

    const handleJoin = async (specificEventId?: number) => {
        if (!username) return

        const targetId = specificEventId || eventId
        if (!targetId) return

        setJoining(true)
        try {
            await joinCampaign(username, targetId, undefined)
            toast({
                title: "Katılım Başarılı! 🎉",
                description: "Turnuvaya başarıyla katıldınız.",
            })
            window.location.reload()
        } catch (e: any) {
            const errorMsg = e.response?.data?.detail || "Katılım işlemi başarısız oldu."
            toast({ variant: "destructive", title: "Hata", description: errorMsg })
        } finally {
            setJoining(false)
        }
    }

    const toggleLeaderboard = async (eventId: number) => {
        if (expandedEventId === eventId) {
            setExpandedEventId(null)
            return
        }

        setLoadingLeaderboard(true)
        try {
            const lb = await getLeaderboard(undefined, eventId, 50, username || undefined)
            setExpandedLeaderboard(lb)
            setExpandedEventId(eventId)
        } catch (e) {
            toast({ variant: "destructive", title: "Hata", description: "Sıralama yüklenemedi." })
        } finally {
            setLoadingLeaderboard(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                <p className="text-neutral-500 animate-pulse font-bold tracking-widest uppercase text-xs">Yükleniyor...</p>
            </div>
        )
    }

    return (
        <ClientLayout username={username}>
            <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-12">
                {/* User Info Bar - Refined (Badges Removed) */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 bg-black/20 rounded-3xl p-8 border border-white/5 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center gap-10">
                        {/* User Profile */}
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-black font-black text-lg shadow-lg">
                                <Users className="h-6 w-6" />
                            </div>
                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{username || "Misafir"}</h2>
                        </div>

                        {/* Simplified Stats */}
                        <div className="flex items-center gap-10">
                            <div className="flex items-center gap-4">
                                <span className="text-primary font-black text-4xl italic tracking-tighter leading-none">{myEnrollments.length}</span>
                                <span className="text-[10px] text-white font-black uppercase tracking-widest leading-tight">KAYITLI<br />TURNUVA</span>
                            </div>
                            <div className="w-px h-10 bg-white/10"></div>
                            <div className="flex items-center gap-4">
                                <span className="text-primary font-black text-4xl italic tracking-tighter leading-none">{publicEvents.filter(e => e.status === 'active').length}</span>
                                <span className="text-[10px] text-white font-black uppercase tracking-widest leading-tight">AKTİF<br />TURNUVA</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-10">
                    <div className="flex items-center gap-4 justify-center">
                        <div className="h-px bg-gradient-to-r from-transparent to-primary/30 flex-1"></div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-widest px-8">KAYITLI TURNUVALARIM ({myEnrollments.length})</h3>
                        <div className="h-px bg-gradient-to-l from-transparent to-primary/30 flex-1"></div>
                    </div>

                    {/* Content */}
                    <div className="space-y-6">
                        {publicEvents.map((event) => (
                            <TournamentCard
                                key={event.id}
                                id={event.id}
                                name={event.name}
                                description={event.description || ""}
                                image_url={event.image_url ?? null}
                                status={event.status}
                                startDate={event.start_date}
                                endDate={event.end_date}
                                participantCount={event.participant_count}
                                isJoined={myEnrollments.some(e => e.event_id === event.id)}
                                userPoints={myEnrollments.find(e => e.event_id === event.id)?.score || 0}
                                userRank={myEnrollments.find(e => e.event_id === event.id)?.rank || 0}
                                onJoin={(id) => handleJoin(id)}
                                onDetails={(id) => handleSwitchEvent(id)}
                            />
                        ))}
                    </div>
                </div>

                {/* Keeping the detailed tabs hidden but available if needed */}
                <div className="hidden">
                    <Tabs defaultValue="leaderboard" className="w-full" value={activeTab} onValueChange={setActiveTab}>
                        <TabsContent value="leaderboard">
                            {/* Content preserved in full in the original file */}
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </ClientLayout>
    )
}
