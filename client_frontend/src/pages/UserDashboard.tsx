import { useEffect, useState, Fragment } from "react"
import { getParticipationStatus, joinCampaign, getLeaderboard, getMyCoupons, getMyEnrollments, getMyRewards } from "../api/participation"
import { getPublicEvents, PublicEvent } from "../api/client"
import { getUsernameFromUrl } from "../utils/useUsername"
import {
    ArrowLeft, Trophy, Loader2, FileText, Award, Gift,
    TrendingUp, ArrowUpRight, CheckCircle2, Ticket, List as ListIcon, LayoutGrid, Zap, BarChart3, Users, DollarSign, Medal, Calendar, Activity
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TournamentCard } from "@/components/premium/TournamentCard"
import { UpcomingTournamentCard } from "@/components/premium/UpcomingTournamentCard"
import { UpcomingEventsSlider } from "@/components/premium/UpcomingEventsSlider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClientLayout } from "@/components/layout/ClientLayout"

import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { TournamentDetails } from "@/components/premium/TournamentDetails"
import { parseEventDate, parseUtcDate } from "@/utils/dateUtils"

export default function UserDashboard() {
    const [searchParams, setSearchParams] = useSearchParams()
    const paramEventId = searchParams.get('eventId') || useParams().eventId
    const paramUsername = searchParams.get('username') || useParams().username
    const navigate = useNavigate()
    const { toast } = useToast()

    // State Definitions
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [publicEvents, setPublicEvents] = useState<PublicEvent[]>([])
    const [myEnrollments, setMyEnrollments] = useState<any[]>([])
    const [myCoupons, setMyCoupons] = useState<any[]>([])
    const [myRewards, setMyRewards] = useState<any[]>([])

    const [activeTab, setActiveTab] = useState("tournaments")
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    // Filters & Expanded Items
    const [activeCategory, setActiveCategory] = useState("all")
    const [eventId, setEventId] = useState<number | null>(null)
    const [slug, setSlug] = useState<string | null>(null)
    const [expandedEventId, setExpandedEventId] = useState<number | null>(null)
    const [expandedLeaderboard, setExpandedLeaderboard] = useState<any[]>([])
    const [expandedCouponId, setExpandedCouponId] = useState<number | null>(null)

    // Loading States for subsets
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
    const [loadingEnrollments, setLoadingEnrollments] = useState(false)
    const [loadingCoupons, setLoadingCoupons] = useState(false)
    const [loadingRewards, setLoadingRewards] = useState(false)

    const [username, setUsername] = useState<string | null>(paramUsername || null)

    // Handle Username
    useEffect(() => {
        if (!username) {
            const u = getUsernameFromUrl()
            if (u) setUsername(u)
        }
    }, [username])

    // Fetch Data
    const fetchData = async () => {
        setLoading(true)
        try {
            const [events, enrollments, coupons, rewards] = await Promise.all([
                getPublicEvents(),
                username ? getMyEnrollments(username) : Promise.resolve([]),
                username ? getMyCoupons(username) : Promise.resolve([]),
                username ? getMyRewards(username) : Promise.resolve([])
            ])
            setPublicEvents(Array.isArray(events) ? events : [])
            setMyEnrollments(Array.isArray(enrollments) ? enrollments : [])
            setMyCoupons(Array.isArray(coupons) ? coupons : [])
            setMyRewards(Array.isArray(rewards) ? rewards : [])
        } catch (err) {
            console.error(err)
            setFetchError("Veriler yüklenirken bir hata oluştu.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [username])

    // Actions
    const handleJoin = async (id: number) => {
        if (!username) {
            toast({ title: "Hata", description: "Katılmak için giriş yapmalısınız.", variant: "destructive" })
            return
        }

        const event = publicEvents.find(e => e.id === id)
        if (event && new Date() > parseEventDate(event.end_date)) {
            toast({ title: "Hata", description: "Bu turnuvanın süresi dolmuştur.", variant: "destructive" })
            return
        }

        try {
            await joinCampaign(username, id)
            toast({ title: "Başarılı", description: "Turnuvaya başarıyla katıldınız!" })
            fetchData()
        } catch (e: any) {
            const msg = e?.response?.data?.detail || e?.response?.data?.message || "Katılım başarısız oldu."
            toast({ title: "Hata", description: msg, variant: "destructive" })
        }
    }

    const handleSwitchEvent = (id: number) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev)
            newParams.set('eventId', id.toString())
            if (username) newParams.set('username', username)
            return newParams
        })
    }

    const toggleLeaderboard = async (id: number) => {
        if (expandedEventId === id) {
            setExpandedEventId(null)
            return
        }
        setExpandedEventId(id)
        setLoadingLeaderboard(true)
        try {
            const data = await getLeaderboard(undefined, id, 10)
            setExpandedLeaderboard(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingLeaderboard(false)
        }
    }

    if (loading) {
        return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-amber-500 w-12 h-12" /></div>
    }

    // Detail View Logic
    const targetEventId = paramEventId ? Number(paramEventId) : null

    // Filter Logic - Event dates are stored as TR (UTC+3), parse with +03:00 to avoid 3h shift
    const upcomingEventsList = publicEvents.filter(e => {
        const now = new Date()
        const start = parseEventDate(e.start_date)
        const isUpcoming = e.status === 'active' && (now < start)
        const isJoined = myEnrollments.some(enr => enr.event_id === e.id)
        return isUpcoming && !isJoined
    })

    const filteredEvents = publicEvents.filter(e => {
        const now = new Date()
        const start = parseEventDate(e.start_date)
        const end = parseEventDate(e.end_date)
        const isStarted = now >= start
        const isExpired = now > end
        const isJoined = myEnrollments.some(enr => enr.event_id === e.id)

        if (activeCategory === 'all') return e.status === 'active' && isStarted && !isExpired && !isJoined
        if (activeCategory === 'active') return e.status === 'active' && isStarted && !isExpired
        if (activeCategory === 'upcoming') return e.status === 'active' && !isStarted && !isExpired
        if (activeCategory === 'enrollments') return isJoined
        return false
    })

    const pastEvents = publicEvents.filter(e => {
        const now = new Date()
        const isPast = e.status === 'ended' || e.status === 'paused' || (e.status === 'active' && now > parseEventDate(e.end_date))
        if (!isPast) return false
        // Hide if display_until is set and expired
        if (e.display_until && now > parseEventDate(e.display_until)) return false
        return true
    })

    if (targetEventId) {
        const selectedEvent = publicEvents.find(e => e.id === targetEventId)
        const enrollment = myEnrollments.find(e => e.event_id === targetEventId)

        if (selectedEvent) {
            return (
                <TournamentDetails
                    event={selectedEvent}
                    userPoints={enrollment?.score || 0}
                    userRank={enrollment?.rank || 0}
                    isJoined={!!enrollment}
                    onBack={() => {
                        setSearchParams(prev => {
                            const newParams = new URLSearchParams(prev)
                            newParams.delete('eventId')
                            return newParams
                        })
                    }}
                    username={username || ''}
                    onJoin={() => handleJoin(selectedEvent.id)}
                    joinedAt={enrollment?.joined_at}
                />
            )
        }
    }



    // Helper to calculate total prize
    const calculateTotalPrize = (rules: any) => {
        if (!rules) return 0;

        let validRules = rules;
        if (typeof rules === 'string') {
            try {
                validRules = JSON.parse(rules);
            } catch (e) {
                return 0;
            }
        }

        if (!validRules.rewards || !Array.isArray(validRules.rewards)) {
            return 0;
        }

        const total = validRules.rewards.reduce((acc: number, reward: any) => {
            return acc + (Number(reward.amount) || 0);
        }, 0);

        return total;
    }

    return (
        <ClientLayout username={username} activeCategory={activeCategory} onCategoryChange={(c) => setActiveCategory(c)}>
            <main className="max-w-[1200px] mx-auto px-2 md:px-6 py-8 space-y-12">

                {/* User Info Bar - Responsive */}
                <div className="space-y-6">
                    {/* Mobile Compact User Stats (User Provided HTML) */}
                    <div className="md:hidden px-2 pt-2">
                        <div className="bg-black border border-[#D9B648]/20 rounded-lg p-2 mb-0">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] rounded-full flex items-center justify-center border border-black">
                                        <Users className="w-3.5 h-3.5 text-black" />
                                    </div>
                                    <span className="text-sm font-black text-[#D9B648] uppercase tracking-wide">{username || "MİSAFİR"}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-black bg-gradient-to-r from-[#D9B648] to-[#F7EBA5] bg-clip-text text-transparent tabular-nums">{myEnrollments.filter(e => e.status === 'active').length}</span>
                                        <span className="text-[8px] text-[#F7EBA5] font-medium uppercase">kayıtlı</span>
                                    </div>
                                    <div className="h-4 w-px bg-gradient-to-b from-transparent via-gray-700 to-transparent"></div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-black bg-gradient-to-r from-[#F7EBA5] to-[#FF8C00] bg-clip-text text-transparent tabular-nums">{publicEvents.filter(e => e.status === 'active' && new Date() >= parseEventDate(e.start_date) && new Date() <= parseEventDate(e.end_date)).length}</span>
                                        <span className="text-[8px] text-[#F7EBA5] font-medium uppercase">aktif</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Big User Stats */}
                    <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-12 bg-black/20 rounded-3xl p-8 border border-white/5 shadow-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-10">
                            {/* User Profile */}
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-black font-black text-lg shadow-lg">
                                    <Users className="h-6 w-6" />
                                </div>
                                <h2 className="text-2xl font-black text-[#F7EBA5] italic tracking-tighter uppercase">{username || "Misafir"}</h2>
                            </div>

                            {/* Simplified Stats */}
                            <div className="flex items-center gap-10">
                                <div className="flex items-center gap-4">
                                    <span className="text-primary font-black text-4xl italic tracking-tighter leading-none">{myEnrollments.filter(e => e.status === 'active').length}</span>
                                    <span className="text-[10px] text-[#F7EBA5] font-black uppercase tracking-widest leading-tight">KAYITLI<br />TURNUVA</span>
                                </div>
                                <div className="w-px h-10 bg-white/10"></div>
                                <div className="flex items-center gap-4">
                                    <span className="text-primary font-black text-4xl italic tracking-tighter leading-none">{publicEvents.filter(e => e.status === 'active' && new Date() >= parseEventDate(e.start_date) && new Date() <= parseEventDate(e.end_date)).length}</span>
                                    <span className="text-[10px] text-[#F7EBA5] font-black uppercase tracking-widest leading-tight">AKTİF<br />TURNUVA</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



                {/* Show Main Tournament List only if NOT 'finished' or 'report' */}
                {!['finished', 'report', 'coupons'].includes(activeCategory) && (
                    <>
                        {/* Enrolled Tournaments (Only show when activeCategory is 'all' and user has enrollments) */}
                        {activeCategory === 'all' && myEnrollments.length > 0 && (() => {
                            const enrolledEvents = publicEvents.filter(e => {
                                const isExpired = new Date() > parseEventDate(e.end_date)
                                return myEnrollments.some(enr => enr.event_id === e.id) && ['active', 'upcoming', 'paused'].includes(e.status) && !isExpired
                            });
                            if (enrolledEvents.length === 0) return null;
                            return (
                                <div className="space-y-1.5 pb-1 border-b border-white/10 mb-1">
                                    <div className="flex items-center gap-2 lg:gap-4 justify-center">
                                        <div className="h-px bg-gradient-to-r from-transparent to-primary/30 flex-1"></div>
                                        <h3 className="text-sm lg:text-xl font-black text-[#F7EBA5] uppercase italic tracking-widest px-2 lg:px-8 whitespace-nowrap">
                                            KAYITLI TURNUVALARIM
                                        </h3>
                                        <div className="h-px bg-gradient-to-l from-transparent to-primary/30 flex-1"></div>
                                    </div>
                                    <div className="space-y-1.5">
                                        {enrolledEvents.map((event) => {
                                            const enrollment = myEnrollments.find(e => e.event_id === event.id);
                                            return (
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
                                                    isJoined={true}
                                                    userPoints={enrollment?.score || 0}
                                                    userRank={enrollment?.rank || 0}
                                                    totalPrize={calculateTotalPrize(event.rules)}
                                                    onJoin={(id) => handleJoin(id)}
                                                    onDetails={(id) => handleSwitchEvent(id)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex flex-col gap-1 opacity-100 transition-opacity duration-300">
                            <div className="flex items-center gap-2 lg:gap-4 justify-center">
                                <div className="h-px bg-gradient-to-r from-transparent to-primary/30 flex-1"></div>
                                <h3 className="text-sm lg:text-xl font-black text-[#F7EBA5] uppercase italic tracking-widest px-2 lg:px-8 whitespace-nowrap">
                                    {activeCategory === 'all' ? 'AKTİF TURNUVALAR' : activeCategory === 'active' ? 'AKTİF TURNUVALAR' : activeCategory === 'upcoming' ? 'YAKINDA BAŞLAYACAKLAR' : 'KATILDIĞIM TURNUVALAR'}
                                </h3>
                                <div className="h-px bg-gradient-to-l from-transparent to-primary/30 flex-1"></div>
                            </div>

                            {/* Content */}
                            <div className="space-y-1.5">
                                {filteredEvents.length === 0 ? (
                                    <div className="text-center p-4 text-neutral-500 italic bg-white/5 rounded-xl border border-dashed border-white/10">
                                        {(() => {
                                            if (activeCategory !== 'all') return "Bu kategoride turnuva bulunamadı.";
                                            const activeStartedEvents = publicEvents.filter(e => e.status === 'active' && new Date() >= parseEventDate(e.start_date) && new Date() <= parseEventDate(e.end_date));
                                            if (activeStartedEvents.length > 0 && activeStartedEvents.every(e => myEnrollments.some(enr => enr.event_id === e.id))) {
                                                return "Tüm aktif turnuvalara katıldınız,";
                                            }
                                            return "Bu kategoride turnuva bulunamadı.";
                                        })()}
                                    </div>
                                ) : (
                                    filteredEvents.map((event) => (
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
                                            totalPrize={calculateTotalPrize(event.rules)}
                                            onJoin={(id) => handleJoin(id)}
                                            onDetails={(id) => handleSwitchEvent(id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Upcoming Tournaments Slider (Only show when activeCategory is 'all' and there are upcoming events) */}
                        {activeCategory === 'all' && upcomingEventsList.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-white/10">
                                <div className="flex items-center gap-2 lg:gap-4 justify-center">
                                    <div className="h-px bg-gradient-to-r from-transparent to-primary/30 flex-1"></div>
                                    <h3 className="text-sm lg:text-xl font-black text-[#F7EBA5] uppercase italic tracking-widest px-2 lg:px-8 whitespace-nowrap">
                                        GELECEK TURNUVALAR
                                    </h3>
                                    <div className="h-px bg-gradient-to-l from-transparent to-primary/30 flex-1"></div>
                                </div>
                                <UpcomingEventsSlider
                                    events={upcomingEventsList}
                                    onDetails={(id) => {
                                        setSearchParams(prev => {
                                            const newParams = new URLSearchParams(prev)
                                            newParams.set('eventId', id.toString())
                                            return newParams
                                        })
                                    }}
                                />
                            </div>
                        )}



                        {/* Past Tournaments (Only show when activeCategory is 'all' and there are past events) */}
                        {activeCategory === 'all' && pastEvents.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-white/10">
                                <div className="flex items-center gap-2 lg:gap-4 justify-center">
                                    <div className="h-px bg-gradient-to-r from-transparent to-primary/30 flex-1"></div>
                                    <h3 className="text-sm lg:text-xl font-black text-[#F7EBA5] uppercase italic tracking-widest px-2 lg:px-8 whitespace-nowrap">
                                        GEÇMİŞ TURNUVALAR
                                    </h3>
                                    <div className="h-px bg-gradient-to-l from-transparent to-primary/30 flex-1"></div>
                                </div>
                                <div className="space-y-1.5">
                                    {pastEvents.map((event) => {
                                        const enrollment = myEnrollments.find(e => e.event_id === event.id);
                                        return (
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
                                                isJoined={!!enrollment}
                                                userPoints={enrollment?.score || 0}
                                                userRank={enrollment?.rank || 0}
                                                totalPrize={calculateTotalPrize(event.rules)}
                                                onJoin={(id) => handleJoin(id)}
                                                onDetails={(id) => handleSwitchEvent(id)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Past Tournaments Section (User Provided HTML) - Show ONLY when 'finished' OR standard (bottom) if desired? 
                    User said "seçildiğinde alta geçmiş turnuvalar görülecek" which implies when selected.
                    But also "sonuçlanan kısmına basınca".
                    Let's show it if activeCategory === 'finished' OR maybe always show it at bottom?
                    Refined: "sonuçlanan kısmına basınca ... görülecek".
                    So I will show it ONLY when activeCategory === 'finished'.
                */}
                {activeCategory === 'finished' && (
                    <div id="past" className="mt-12 opacity-100 transition-opacity duration-300">
                        <div className="px-2 lg:px-4 mb-2 lg:mb-6">
                            <div className="flex items-center justify-center gap-2 lg:gap-3">
                                <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-gray-500"></div>
                                <h2 className="text-xs lg:text-xl font-semibold text-[#F7EBA5] uppercase tracking-wide whitespace-nowrap px-2">Geçmiş Turnuvalar</h2>
                                <div className="h-[2px] flex-1 bg-gradient-to-r from-gray-500 to-transparent"></div>
                            </div>
                        </div>

                        {pastEvents.length === 0 ? (
                            <div className="text-center p-12 text-neutral-500 italic bg-white/5 rounded-xl border border-dashed border-white/10">
                                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Henüz sonuçlanmış turnuva bulunmuyor.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 lg:space-y-4 px-2 lg:px-4">
                                {pastEvents.map(event => {
                                    const enrollment = myEnrollments.find(e => e.event_id === event.id);
                                    const isParticipated = !!enrollment;
                                    const reward = myRewards.find(r => r.event_name === event.name);
                                    const userPrize = reward ? `${Number(reward.amount).toLocaleString()}₺` : null;

                                    return (
                                        <div key={event.id}>
                                            {/* Mobile Card */}
                                            <div className="lg:hidden">
                                                <div className="relative rounded-lg overflow-hidden cursor-pointer bg-black border-2 border-[#D9B648] shadow-xl" onClick={() => handleSwitchEvent(event.id)}>
                                                    <div className="flex items-stretch gap-0 p-1.5">
                                                        <div className="flex-shrink-0 w-32 h-34 rounded-l border-r-2 border-[#D9B648]/50 overflow-hidden">
                                                            <img src={event.image_url || "/5.jpg"} alt={event.name} className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex-1 flex flex-col gap-1.5 pl-2 pr-1 py-1 min-w-0">
                                                            <h3 className="text-xs font-black text-[#F7EBA5] tracking-tight leading-tight line-clamp-2">{event.name}</h3>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="flex-1 bg-[#1a1a1a] border-2 border-[#D9B648] rounded-lg px-2 py-1.5">
                                                                    <div className="flex items-center justify-center gap-1 mb-1">
                                                                        <Users className="w-3 h-3 text-[#D9B648]" />
                                                                        <span className="text-[8px] text-[#D9B648] font-bold uppercase tracking-wide">Katılımcı</span>
                                                                    </div>
                                                                    <div className="text-sm font-black text-[#F7EBA5] text-center leading-none">{event.participant_count.toLocaleString()}</div>
                                                                </div>
                                                                <div className="flex-1 bg-gradient-to-br from-[#D9B648]/20 to-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5">
                                                                    <div className="flex items-center justify-center gap-1 mb-1">
                                                                        <Trophy className="w-3 h-3 text-[#D9B648]" />
                                                                        <span className="text-[8px] text-[#D9B648] font-bold uppercase tracking-wide">Ödül</span>
                                                                    </div>
                                                                    <div className="text-[11px] font-black text-[#D9B648] text-center leading-none">{calculateTotalPrize(event.rules).toLocaleString('tr-TR')}₺</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Desktop Card */}
                                            <div className="hidden lg:block border-2 border-[#D9B648] rounded-xl lg:rounded-2xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
                                                <div className="relative rounded-xl overflow-hidden cursor-pointer transition-transform duration-300 bg-black border-2 border-[#D9B648] shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,0,0.4)]" onClick={() => handleSwitchEvent(event.id)}>
                                                    <div className="absolute top-0 right-0 z-30 overflow-hidden">
                                                        <div className="relative">
                                                            <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden">
                                                                <div className="absolute top-6 -right-6 md:top-8 md:-right-8 w-32 md:w-40 bg-gradient-to-r from-gray-600 to-gray-500 transform rotate-45 shadow-lg border-t border-b border-gray-400/30">
                                                                    <div className="flex items-center justify-center py-1.5 md:py-2">
                                                                        <span className="text-[#F7EBA5] text-[10px] md:text-xs font-bold tracking-wider">SONUÇLANMIŞ</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="relative">
                                                        <div className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-4 md:gap-0">
                                                            <div className="flex flex-col md:flex-row items-start md:items-center gap-0 flex-1 relative z-10 w-full">
                                                                <div className="w-full h-28 md:w-[280px] md:h-full shrink-0 md:border-r-2 border-[#D9B648]">
                                                                    <img src={event.image_url || "/5.jpg"} alt={event.name} className="w-full h-full object-cover" />
                                                                </div>
                                                                <div className="flex flex-col flex-1 px-3 md:px-6 py-3 md:py-6 w-full">
                                                                    <div className="text-center mb-2 md:mb-4">
                                                                        <h3 className="text-base md:text-2xl lg:text-3xl font-black text-[#F7EBA5] tracking-tight leading-tight mb-1 md:mb-2 px-2">{event.name}</h3>
                                                                        <div className="h-0.5 w-12 md:w-16 mx-auto bg-gradient-to-r from-transparent via-[#D9B648] to-transparent rounded-full"></div>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
                                                                        <div className="group relative bg-[#1a1a1a] border-2 border-[#D9B648] rounded-xl md:rounded-2xl p-3 md:p-8 hover:border-[#F7EBA5] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#1a1a1a]/20 hover:shadow-xl hover:shadow-[#D9B648]/40 flex-1 min-w-[110px] md:min-w-[130px] max-w-[150px] md:max-w-[180px]">
                                                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl md:rounded-2xl"></div>
                                                                            <div className="relative">
                                                                                <div className="flex items-center justify-center gap-1 md:gap-2 mb-1 md:mb-2">
                                                                                    <Users className="w-3 h-3 md:w-6 md:h-6 text-[#D9B648]" />
                                                                                    <span className="text-[9px] md:text-xs text-[#D9B648] font-bold uppercase tracking-wide md:tracking-widest">Katılımcı</span>
                                                                                </div>
                                                                                <div className="text-center text-base md:text-2xl lg:text-3xl font-black text-[#F7EBA5]">{event.participant_count.toLocaleString()}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="group relative bg-gradient-to-br from-[#D9B648]/20 via-[#F7EBA5]/10 to-black border-2 border-[#D9B648] rounded-xl md:rounded-2xl p-3 md:p-8 hover:border-[#F7EBA5] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#D9B648]/20 hover:shadow-[#D9B648]/40 hover:shadow-xl flex-1 min-w-[110px] md:min-w-[130px] max-w-[150px] md:max-w-[180px]">
                                                                            <div className="absolute inset-0 bg-gradient-to-br from-[#D9B648]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl md:rounded-2xl"></div>
                                                                            <div className="relative">
                                                                                <div className="flex items-center justify-center gap-1 md:gap-2 mb-1 md:mb-2">
                                                                                    <Trophy className="w-3 h-3 md:w-6 md:h-6 text-[#D9B648]" />
                                                                                    <span className="text-[9px] md:text-xs text-[#D9B648] font-bold uppercase tracking-wide md:tracking-widest">Ödül</span>
                                                                                </div>
                                                                                <div className="text-center text-sm md:text-lg lg:text-xl font-black text-[#D9B648]">{calculateTotalPrize(event.rules).toLocaleString('tr-TR')}₺</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-2 md:gap-4 relative z-10 items-stretch md:items-end px-3 md:pr-6 pb-3 md:py-6 w-full md:w-auto">
                                                                {isParticipated ? (
                                                                    <>
                                                                        <div className="flex items-center gap-2 md:gap-4 justify-center md:justify-end">
                                                                            <div className="text-center">
                                                                                <div className="flex items-center justify-center gap-1 md:gap-2 text-gray-400 mb-0.5 md:mb-1">
                                                                                    <Zap className="w-3 h-3 md:w-4 md:h-4" />
                                                                                    <span className="text-[9px] md:text-xs uppercase tracking-wide">Puanım</span>
                                                                                </div>
                                                                                <div className="text-lg md:text-3xl lg:text-4xl font-bold text-[#F7EBA5]">{(Math.floor((enrollment.score || 0) * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                                                                            </div>
                                                                            <div className="w-px h-10 md:h-16 bg-[#D9B648]/30"></div>
                                                                            <div className="text-center">
                                                                                <div className="flex items-center justify-center gap-1 md:gap-2 text-[#D9B648] mb-0.5 md:mb-1">
                                                                                    <Trophy className="w-3 h-3 md:w-4 md:h-4" />
                                                                                    <span className="text-[9px] md:text-xs uppercase tracking-wide">Sıralama</span>
                                                                                </div>
                                                                                <div className="text-lg md:text-3xl lg:text-4xl font-bold text-[#D9B648]">#{enrollment.rank}</div>
                                                                            </div>
                                                                        </div>
                                                                        {userPrize && (
                                                                            <div className="bg-gradient-to-r from-[#D9B648]/20 to-[#F7EBA5]/20 border-2 border-[#D9B648] rounded-xl px-3 md:px-6 py-2.5 md:py-4">
                                                                                <div className="text-center">
                                                                                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-wide mb-1">Kazandığınız Ödül</p>
                                                                                    <p className="text-[#D9B648] text-xl md:text-3xl font-bold">{userPrize}</p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <div className="bg-black border border-[#D9B648]/30 rounded-xl px-4 md:px-6 py-3 md:py-4">
                                                                        <p className="text-gray-400 text-xs md:text-sm font-semibold text-center md:text-left">Bu turnuvaya katılmadınız</p>
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={() => handleSwitchEvent(event.id)}
                                                                    className="px-4 md:px-8 py-1.5 md:py-3 bg-[#D9B648] hover:bg-[#F7EBA5] text-black rounded-lg md:rounded-xl font-bold text-xs md:text-base shadow-lg hover:shadow-xl transition-all w-full md:w-auto"
                                                                >
                                                                    Sonuçları Gör
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Report View */}
                {activeCategory === 'report' && (() => {
                    // Calculate Statistics
                    const totalWinnings = myRewards.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

                    const validRanks = myEnrollments.filter(e => e.rank && e.rank > 0).map(e => e.rank)
                    const avgRank = validRanks.length > 0 ? Math.round(validRanks.reduce((a, b) => a + b, 0) / validRanks.length) : '-'
                    const bestRank = validRanks.length > 0 ? Math.min(...validRanks) : '-'

                    const participationCount = myEnrollments.length
                    const top3Count = validRanks.filter(r => r <= 3).length
                    const successRate = participationCount > 0 ? ((top3Count / participationCount) * 100).toFixed(2) : '0.00'

                    return (
                        <div className="mt-6 animation-in fade-in slide-in-from-bottom-2 max-w-7xl mx-auto">
                            {/* Back Button */}
                            <button
                                onClick={() => setActiveCategory('all')}
                                className="flex items-center gap-2 px-6 py-3 bg-black border border-[#D9B648] hover:bg-[#F7EBA5] hover:text-black text-[#D9B648] rounded-xl transition-all font-bold shadow-lg mb-8 group"
                            >
                                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                <span>ANA SAYFA</span>
                            </button>

                            <div className="space-y-6 md:space-y-8">
                                {/* Top Row - Key Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                                    <div className="bg-gradient-to-br from-[#D9B648]/20 via-[#D9B648]/10 to-black border-2 border-[#D9B648] rounded-xl p-4 md:p-6 hover:scale-105 transition-transform">
                                        <div className="flex flex-col gap-2">
                                            <DollarSign className="w-6 h-6 text-[#D9B648]" />
                                            <p className="text-gray-400 text-xs md:text-sm">Toplam Kazanç</p>
                                            <p className="text-2xl md:text-3xl font-black text-[#D9B648]">{totalWinnings.toLocaleString('tr-TR')}₺</p>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-[#D9B648]/20 via-[#D9B648]/10 to-black border-2 border-[#D9B648] rounded-xl p-4 md:p-6 hover:scale-105 transition-transform">
                                        <div className="flex flex-col gap-2">
                                            <Award className="w-6 h-6 text-[#D9B648]" />
                                            <p className="text-gray-400 text-xs md:text-sm">Ortalama Sıralama</p>
                                            <p className="text-2xl md:text-3xl font-black text-[#D9B648]">#{avgRank}</p>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-[#D9B648]/20 via-[#D9B648]/10 to-black border-2 border-[#D9B648] rounded-xl p-4 md:p-6 hover:scale-105 transition-transform">
                                        <div className="flex flex-col gap-2">
                                            <Medal className="w-6 h-6 text-[#D9B648]" />
                                            <p className="text-gray-400 text-xs md:text-sm">En İyi Sıralama</p>
                                            <p className="text-2xl md:text-3xl font-black text-[#D9B648]">#{bestRank}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle Row - Secondary Stats (Katılım, İlk 3, Başarı) - Gizli, sonra açılacak: SHOW_SECONDARY_STATS=true yap */}
                                {false && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                                    <div className="bg-black border-2 border-[#D9B648]/30 rounded-xl p-4 md:p-6 hover:border-[#D9B648] transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-[#D9B648]" />
                                                <p className="text-sm font-semibold text-gray-400">Katılım</p>
                                            </div>
                                            <p className="text-2xl font-black text-[#F7EBA5]">{participationCount}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">Toplam Turnuva</p>
                                    </div>
                                    <div className="bg-black border-2 border-[#D9B648]/30 rounded-xl p-4 md:p-6 hover:border-[#D9B648] transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Trophy className="w-5 h-5 text-[#D9B648]" />
                                                <p className="text-sm font-semibold text-gray-400">İlk 3</p>
                                            </div>
                                            <p className="text-2xl font-black text-[#F7EBA5]">{top3Count}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">Derece Sayısı</p>
                                    </div>
                                    <div className="bg-black border-2 border-[#D9B648]/30 rounded-xl p-4 md:p-6 hover:border-[#D9B648] transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-5 h-5 text-[#D9B648]" />
                                                <p className="text-sm font-semibold text-gray-400">Başarı</p>
                                            </div>
                                            <p className="text-2xl font-black text-[#F7EBA5]">%{successRate}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">Kazanma Oranı</p>
                                    </div>
                                </div>
                                )}

                                {/* Tournament History Table */}
                                <div className="bg-black border-2 border-[#D9B648]/30 rounded-xl p-4 md:p-6">
                                    <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2">
                                        <Trophy className="w-6 h-6 text-[#D9B648]" />
                                        Turnuva Geçmişi
                                    </h2>
                                    <div className="overflow-x-auto">
                                        {myEnrollments.length === 0 ? (
                                            <div className="text-center p-8 text-gray-500 italic">Henüz katılım bulunmamaktadır.</div>
                                        ) : (
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b-2 border-[#D9B648]/30">
                                                        <th className="text-left py-3 px-2 md:px-4 text-gray-400 text-xs md:text-sm font-bold">Turnuva</th>
                                                        <th className="text-center py-3 px-1 md:px-4 text-gray-400 text-xs md:text-sm font-bold table-cell">Tarih</th>
                                                        <th className="text-center py-3 px-2 md:px-4 text-gray-400 text-xs md:text-sm font-bold hidden md:table-cell">Durum</th>
                                                        <th className="text-center py-3 px-2 md:px-4 text-gray-400 text-xs md:text-sm font-bold">Sıra</th>
                                                        <th className="text-center py-3 px-1 md:px-4 text-gray-400 text-xs md:text-sm font-bold table-cell">Puan</th>
                                                        <th className="text-right py-3 px-2 md:px-4 text-gray-400 text-xs md:text-sm font-bold">Kazanç</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {myEnrollments.map((enr, idx) => {
                                                        const eventRewards = myRewards.filter(r => Number(r.event_id) === Number(enr.event_id));
                                                        const userWinnings = eventRewards.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

                                                        let rewardDisplay = '-';
                                                        if (userWinnings > 0) {
                                                            const type = eventRewards[0]?.reward_type?.toLowerCase() || 'cash';
                                                            if (type.includes('spin')) {
                                                                rewardDisplay = `${userWinnings} Spin`;
                                                            } else if (type.includes('bet')) {
                                                                rewardDisplay = `${userWinnings.toLocaleString('tr-TR')}₺ Freebet`;
                                                            } else {
                                                                // Default to cash
                                                                rewardDisplay = `${userWinnings.toLocaleString('tr-TR')}₺ Nakit`;
                                                            }
                                                        }

                                                        return (
                                                            <tr key={enr.event_id} className="border-b border-[#D9B648]/10 hover:bg-[#D9B648]/5 transition-colors cursor-pointer" onClick={() => toggleLeaderboard(enr.event_id)}>
                                                                <td className="py-3 md:py-4 px-2 md:px-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="hidden md:flex w-6 h-6 rounded-full bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] items-center justify-center text-black text-xs font-bold">{idx + 1}</div>
                                                                        <div>
                                                                            <div className="font-bold text-xs md:text-sm text-[#F7EBA5]">{enr.event_name}</div>
                                                                            {/* Placeholder user count as data is not available yet */}
                                                                            <div className="text-[10px] md:text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                                                <Users className="w-3 h-3" />
                                                                                Katılımcı
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 md:py-4 px-1 md:px-4 text-center text-xs text-gray-300 table-cell whitespace-nowrap">
                                                                    {enr.joined_at ? new Date(enr.joined_at.endsWith('Z') ? enr.joined_at : enr.joined_at + 'Z').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                                                </td>
                                                                <td className="py-3 md:py-4 px-2 md:px-4 text-center text-xs text-gray-300 hidden md:table-cell">
                                                                    <Badge variant={enr.status === 'active' ? 'default' : 'secondary'} className={enr.status === 'active' ? 'bg-emerald-500/20 text-emerald-500 border-none' : 'bg-white/5 text-neutral-500 border-none'}>
                                                                        {enr.status === 'active' ? 'AKTİF' : 'TAMAMLANDI'}
                                                                    </Badge>
                                                                </td>
                                                                <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                                                                    <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold ${enr.rank <= 3 ? 'bg-[#D9B648]/30 text-[#D9B648]' : 'bg-gray-800 text-gray-400'}`}>
                                                                        #{enr.rank || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 md:py-4 px-1 md:px-4 text-center text-xs font-semibold table-cell text-gray-300">{(Math.floor((enr.score || 0) * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                                                                <td className="text-right py-3 md:py-4 px-2 md:px-4 font-bold text-[#D9B648] text-xs md:text-sm">
                                                                    {rewardDisplay}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* Keeping the detailed tabs hidden but available if needed */}
                <div className="hidden">
                    <Tabs defaultValue="leaderboard" className="w-full" value={activeTab} onValueChange={(v) => setActiveTab(v)}>
                        <TabsContent value="leaderboard" className="mt-6 animation-in fade-in slide-in-from-bottom-2">
                            <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-[#F7EBA5]"><Trophy className="h-5 w-5 text-amber-500" /> Sıralamarım</CardTitle>
                                    <CardDescription className="text-neutral-500">Katıldığınız aktif ve geçmiş turnuvalardaki durumunuz.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loadingEnrollments ? (
                                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500" /></div>
                                    ) : myEnrollments.length === 0 ? (
                                        <div className="text-center p-12 text-neutral-500 italic bg-white/5 rounded-xl border border-dashed border-white/10">Henüz hiçbir turnuvaya katılmadınız.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent border-white/5">
                                                        <TableHead className="text-neutral-400 uppercase text-[10px] font-black tracking-widest">Turnuva</TableHead>
                                                        <TableHead className="text-neutral-400 uppercase text-[10px] font-black tracking-widest">Durum</TableHead>
                                                        <TableHead className="text-right text-neutral-400 uppercase text-[10px] font-black tracking-widest">Puan</TableHead>
                                                        <TableHead className="text-right text-neutral-400 uppercase text-[10px] font-black tracking-widest">Sıralama</TableHead>
                                                        <TableHead className="text-right text-neutral-400 uppercase text-[10px] font-black tracking-widest">Detay</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {myEnrollments.map((enr) => (
                                                        <Fragment key={enr.event_id}>
                                                            <TableRow className="border-white/5 hover:bg-white/5 transition-colors">
                                                                <TableCell className="font-bold text-[#F7EBA5]">{enr.event_name}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={enr.status === 'active' ? 'default' : 'secondary'} className={enr.status === 'active' ? 'bg-emerald-500/20 text-emerald-500 border-none' : 'bg-white/5 text-neutral-500 border-none'}>
                                                                        {enr.status === 'active' ? 'AKTİF' : 'TAMAMLANDI'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-amber-500 font-bold">{enr.score.toLocaleString()}</TableCell>
                                                                <TableCell className="text-right font-black text-xl text-[#F7EBA5] italic">#{enr.rank}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button size="sm" variant="ghost" className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10" onClick={() => toggleLeaderboard(enr.event_id)}>
                                                                        {expandedEventId === enr.event_id ? 'Kapat' : 'Sıralama'}
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                            {expandedEventId === enr.event_id && (
                                                                <tr className="bg-black/40 border-none">
                                                                    <td colSpan={5} className="p-4">
                                                                        <div className="rounded-xl border border-white/5 overflow-hidden animate-in fade-in zoom-in-95">
                                                                            {loadingLeaderboard ? (
                                                                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500" /></div>
                                                                            ) : (
                                                                                <div className="bg-black rounded-xl border border-[#D9B648]/30 overflow-hidden">
                                                                                    <div className="text-center p-4 text-gray-500 italic text-sm">
                                                                                        Detaylı sıralama için turnuva detay sayfasına gidiniz.
                                                                                    </div>

                                                                                    {/* Current User Rank Fixed Footer */}
                                                                                    <div className="mt-6 bg-black rounded-xl border-2 border-[#D9B648] overflow-hidden">
                                                                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 md:px-6 py-4 md:py-5">
                                                                                            <div className="flex items-center gap-3 md:gap-4">
                                                                                                <div className="w-10 h-10 md:w-12 md:h-12 bg-black border-2 border-[#D9B648] rounded-full flex items-center justify-center text-[#D9B648] font-bold text-sm md:text-base">
                                                                                                    {enr.rank || '-'}
                                                                                                </div>
                                                                                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] flex items-center justify-center font-bold text-base md:text-lg text-black">
                                                                                                    {username ? username.substring(0, 2).toUpperCase() : 'ME'}
                                                                                                </div>
                                                                                                <div>
                                                                                                    <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Senin Sıran</div>
                                                                                                    <div className="text-[#D9B648] font-bold text-sm md:text-base">#{enr.rank || '-'}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-center sm:text-right">
                                                                                                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Puanın</div>
                                                                                                <div className="text-lg md:text-xl font-bold text-[#F7EBA5]">{enr.score.toLocaleString()}</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="my-coupons" className="mt-6 animation-in fade-in slide-in-from-bottom-2">
                            <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-[#F7EBA5]"><Ticket className="h-5 w-5 text-amber-500" /> Kuponlarım</CardTitle>
                                    <div className="flex items-center gap-4 mt-4">
                                        <Select value={eventId ? eventId.toString() : ""} onValueChange={(val) => {
                                            setEventId(Number(val))
                                            setSlug(null)
                                        }}>
                                            <SelectTrigger className="w-full sm:w-[320px] bg-white/5 border-white/10 text-[#F7EBA5]">
                                                <SelectValue placeholder="Turnuva Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-white/10 text-[#F7EBA5]">
                                                {myEnrollments.length > 0 ? (
                                                    myEnrollments.map((enr) => (
                                                        <SelectItem key={enr.event_id} value={enr.event_id.toString()}>
                                                            {enr.event_name}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <SelectItem value="none" disabled>Katıldığınız turnuva yok</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {!username ? (
                                        <div className="text-center p-12 text-neutral-500 italic bg-white/5 rounded-xl border border-dashed border-white/10">Kuponlarınızı görmek için giriş yapmalısınız.</div>
                                    ) : loadingCoupons ? (
                                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500" /></div>
                                    ) : myCoupons.length === 0 ? (
                                        <div className="text-center p-12 flex flex-col items-center gap-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                                            <Ticket className="h-12 w-12 text-neutral-700" />
                                            <p className="text-neutral-500 italic">Bu turnuvada henüz puanlanan kuponunuz bulunmuyor.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {myCoupons.map((coupon: any) => (
                                                <div key={coupon.id} className="p-4 bg-black/40 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all group shadow-lg">
                                                    <div className="grid grid-cols-12 items-center gap-4">
                                                        <div className="col-span-12 sm:col-span-3 space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono text-neutral-500">#{coupon.bet_id}</span>
                                                                <Badge variant={coupon.state === "Won" ? "default" : coupon.state === "Lost" ? "destructive" : "secondary"}
                                                                    className={`uppercase text-[9px] font-black px-2 py-0.5 border-none ${coupon.state === 'Won' ? 'bg-emerald-500/20 text-emerald-500' : coupon.state === 'Lost' ? 'bg-red-500/20 text-red-500' : 'bg-neutral-800 text-neutral-400'}`}>
                                                                    {coupon.state === "Won" ? "KAZANDI" : coupon.state === "Lost" ? "KAYBETTİ" : "BEKLİYOR"}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-[10px] text-neutral-500 font-medium">
                                                                {parseUtcDate(coupon.created_at || coupon.inserted_at).toLocaleString('tr-TR')}
                                                            </div>
                                                            {coupon.is_live && <Badge className="bg-red-500 text-[#F7EBA5] text-[9px] font-black px-1.5 py-0 h-4 border-none">CANLI</Badge>}
                                                        </div>

                                                        <div className="col-span-12 sm:col-span-6 bg-white/5 rounded-lg p-3 text-xs border border-white/5">
                                                            {coupon.bet_data?.Selections && coupon.bet_data.Selections.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    <button
                                                                        onClick={() => setExpandedCouponId(expandedCouponId === coupon.id ? null : coupon.id)}
                                                                        className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-amber-500 transition-colors"
                                                                    >
                                                                        <span>{coupon.bet_data.Selections.length} SEÇİM</span>
                                                                        <span className="text-amber-500 underline underline-offset-4">
                                                                            {expandedCouponId === coupon.id ? 'GİZLE' : 'DETAYLARI GÖR'}
                                                                        </span>
                                                                    </button>

                                                                    {expandedCouponId === coupon.id && (
                                                                        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2">
                                                                            {coupon.bet_data.Selections.map((sel: any, i: number) => (
                                                                                <div key={i} className="flex flex-col gap-1 border-b border-white/5 last:border-0 pb-2 last:pb-0">
                                                                                    <div className="text-[#F7EBA5] font-bold text-[11px] leading-tight">{sel.MatchName}</div>
                                                                                    <div className="flex justify-between items-center text-[10px]">
                                                                                        <span className="text-amber-500 font-medium">{sel.DisplaySelectionName || sel.SelectionName}</span>
                                                                                        <span className="text-neutral-500">{sel.DisplayMarketName || sel.MarketName}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-neutral-600 italic text-center text-[10px]">Maç detayı bulunamadı.</div>
                                                            )}
                                                        </div>

                                                        <div className="col-span-12 sm:col-span-3 text-right space-y-1">
                                                            <div className="font-black text-2xl text-amber-500 italic tabular-nums leading-none">
                                                                +{(coupon.calculation || 0).toLocaleString()}
                                                            </div>
                                                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">PUAN</div>
                                                            <div className="flex justify-end gap-3 text-[10px] items-center pt-1 border-white/5 border-t mt-1">
                                                                <span className="text-neutral-500">Tutar: <span className="text-[#F7EBA5] font-mono">{coupon.stake}TL</span></span>
                                                                <span className="text-neutral-500">Oran: <span className="text-[#F7EBA5] font-mono">{coupon.odds}</span></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="tournaments" className="mt-6 animation-in fade-in slide-in-from-bottom-2">
                            <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-xl">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2 text-[#F7EBA5]"><LayoutGrid className="h-5 w-5 text-amber-500" /> Kategoriler</CardTitle>
                                        <CardDescription className="text-neutral-500">Aktif turnuvalara katılarak büyük ödüllerden payınızı alın.</CardDescription>
                                    </div>
                                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                                        <Button
                                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className={`h-8 w-8 p-0 ${viewMode === 'grid' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'text-neutral-400 hover:text-[#F7EBA5]'}`}
                                            onClick={() => setViewMode('grid')}
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className={`h-8 w-8 p-0 ${viewMode === 'list' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'text-neutral-400 hover:text-[#F7EBA5]'}`}
                                            onClick={() => setViewMode('list')}
                                        >
                                            <ListIcon className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {publicEvents.length === 0 ? (
                                        <div className="text-center p-12 text-neutral-500 italic bg-white/5 rounded-xl border border-dashed border-white/10">
                                            {fetchError || "Hiçbir turnuva bulunamadı."}
                                        </div>
                                    ) : (
                                        <>
                                            {viewMode === 'grid' ? (
                                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="border-white/5 hover:bg-transparent">
                                                                <TableHead className="text-neutral-400 uppercase text-[10px] font-black tracking-widest">Turnuva</TableHead>
                                                                <TableHead className="text-neutral-400 uppercase text-[10px] font-black tracking-widest">Durum</TableHead>
                                                                <TableHead className="text-right text-neutral-400 uppercase text-[10px] font-black tracking-widest">Katılımcı</TableHead>
                                                                <TableHead className="text-right text-neutral-400 uppercase text-[10px] font-black tracking-widest">Tarih</TableHead>
                                                                <TableHead className="text-right text-neutral-400 uppercase text-[10px] font-black tracking-widest">İşlem</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {publicEvents.map((event) => (
                                                                <TableRow key={event.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                                                    <TableCell className="font-bold text-[#F7EBA5]">{event.name}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className={event.status === 'active' ? 'bg-emerald-500/20 text-emerald-500 border-none px-3' : 'bg-neutral-800 text-neutral-500 border-none px-3'}>
                                                                            {event.status === 'active' ? 'AKTİF' : 'TAMAMLANDI'}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-[#F7EBA5]">{event.participant_count}</TableCell>
                                                                    <TableCell className="text-right text-[10px] text-neutral-500">
                                                                        <div className="font-bold">{parseEventDate(event.start_date).toLocaleDateString('tr-TR')}</div>
                                                                        <div>{parseEventDate(event.end_date).toLocaleDateString('tr-TR')}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button size="sm" variant={event.status === 'active' ? "default" : "outline"}
                                                                            className={`font-black text-[10px] uppercase px-4 ${event.status === 'active' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-transparent border-white/10 text-[#F7EBA5] hover:bg-white/5'}`}
                                                                            disabled={myEnrollments.some(e => e.event_id === event.id)}
                                                                            onClick={() => event.status === 'active' ? handleJoin(event.id) : handleSwitchEvent(event.id)}>
                                                                            {myEnrollments.some(e => e.event_id === event.id) ? 'KATILDI' : (event.status === 'active' ? 'KATIL' : 'BİTTİ')}
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="rules" className="mt-6 animation-in fade-in slide-in-from-bottom-2">
                            <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-[#F7EBA5]"><FileText className="h-5 w-5 text-amber-500" /> Turnuva Kuralları</CardTitle>
                                    <CardDescription className="text-neutral-500">Adil bir yarışma için belirtilen kurallara uymanız gerekmektedir.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    {publicEvents.filter(e => e.status === 'active').length === 0 ? (
                                        <div className="text-center p-12 text-neutral-500 italic bg-white/5 rounded-xl border border-dashed border-white/10">Aktif turnuva bulunmuyor.</div>
                                    ) : (
                                        publicEvents.filter(e => e.status === 'active').map(event => {
                                            const rules = event.rules || {}
                                            return (
                                                <div key={event.id} className="p-8 rounded-2xl border border-white/5 bg-black/60 shadow-2xl space-y-8 relative overflow-hidden group border-l-4 border-l-amber-500">
                                                    <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-10 transition-opacity">
                                                        <Trophy className="h-64 w-64 text-amber-500" />
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="bg-amber-500/10 p-3 rounded-2xl">
                                                                <Trophy className="h-8 w-8 text-amber-500" />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[#F7EBA5]">
                                                                    {event.name}
                                                                </h3>
                                                                <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest mt-1">Katılım Şartları ve Ödül Havuzu</p>
                                                            </div>
                                                        </div>
                                                        <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black px-4 py-1 animate-pulse">
                                                            • AKTİF TURNUVA
                                                        </Badge>
                                                    </div>

                                                    <div className="grid md:grid-cols-2 gap-4">
                                                        <div className="p-5 bg-zinc-900/40 rounded-xl border border-white/5 transition-all hover:bg-zinc-900 group/item">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                                                                    <TrendingUp className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-[#F7EBA5]">Yatırım Şartı</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed"> Minimum <strong className="text-amber-500 font-black">{rules.min_deposit ?? 1000} TL</strong> yatırım yapmış olmanız gerekmektedir.</p>
                                                        </div>

                                                        <div className="p-5 bg-zinc-900/40 rounded-xl border border-white/5 transition-all hover:bg-zinc-900 group/item">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                                                                    <ArrowUpRight className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-[#F7EBA5]">Minimum Oran</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed">Kupon başı toplam oran en az <strong className="text-amber-500 font-black">{(rules.min_odd || 1.5).toFixed(2)}</strong> olmalıdır.</p>
                                                        </div>

                                                        <div className="p-5 bg-zinc-900/40 rounded-xl border border-white/5 transition-all hover:bg-zinc-900 group/item">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                                                                    <Ticket className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-[#F7EBA5]">Kombine Şartı</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed">Her kupon en az <strong className="text-amber-500 font-black">{rules.min_combination || 2} maç</strong> (kombine) içermelidir.</p>
                                                        </div>

                                                        <div className="p-5 bg-zinc-900/40 rounded-xl border border-white/5 transition-all hover:bg-zinc-900 group/item">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                                                                    <Award className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-[#F7EBA5]">Minimum Tutar</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed">Kupon tutarı en az <strong className="text-amber-500 font-black">{rules.min_stake || 100} TL</strong> olmalıdır.</p>
                                                        </div>
                                                    </div>

                                                    {/* Rewards Section */}
                                                    {rules.rewards && rules.rewards.length > 0 && (
                                                        <div className="space-y-6 pt-6 border-t border-white/5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-1 w-8 bg-amber-500 rounded-full" />
                                                                <h4 className="font-black italic uppercase tracking-widest text-sm text-[#F7EBA5] flex items-center gap-2">
                                                                    <Gift className="h-4 w-4 text-amber-500" /> ÖDÜL TABLOSU
                                                                </h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                {rules.rewards.map((reward: any, idx: number) => {
                                                                    let rankLabel = "";
                                                                    if (reward.criteria_type === 'rank_exact') {
                                                                        rankLabel = `${reward.criteria_value}. SIRA`;
                                                                    } else if (reward.criteria_type === 'rank') {
                                                                        rankLabel = `İLK ${reward.criteria_value} KİŞİ`;
                                                                    } else if (reward.criteria_type === 'min_points') {
                                                                        rankLabel = `+${reward.criteria_value} PUAN`;
                                                                    } else {
                                                                        rankLabel = "ÖZEL ÖDÜL";
                                                                    }

                                                                    const rewardTypeLabel = reward.reward_type === 'cash' ? 'TRY' : (reward.reward_type === 'spin' ? 'FRES SPIN' : 'FREE BET');

                                                                    return (
                                                                        <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-zinc-950 transition-all hover:scale-105 hover:border-amber-500/30 group/reward">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] font-black text-neutral-500 tracking-tighter">{rankLabel}</span>
                                                                                <span className="text-xl font-black italic text-[#F7EBA5] tracking-tight">
                                                                                    {reward.amount} <span className="text-[10px] text-amber-500 not-italic ml-1">{rewardTypeLabel}</span>
                                                                                </span>
                                                                            </div>
                                                                            <div className="p-2.5 rounded-xl bg-white/5 group-hover/reward:bg-amber-500/10 transition-colors">
                                                                                {idx === 0 ? <Trophy className="h-5 w-5 text-amber-500" /> : <Award className="h-5 w-5 text-neutral-600 group-hover/reward:text-amber-500" />}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="rewards" className="mt-6 animation-in fade-in slide-in-from-bottom-2">
                            <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-[#F7EBA5]"><Gift className="h-5 w-5 text-amber-500" /> Kazandığım Ödüller</CardTitle>
                                    <CardDescription className="text-neutral-500">Geçmiş turnuvalarda elde ettiğiniz kazançlar.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loadingRewards ? (
                                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500" /></div>
                                    ) : myRewards.length === 0 ? (
                                        <div className="text-center p-12 flex flex-col items-center gap-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                                            <Gift className="h-12 w-12 text-neutral-700" />
                                            <p className="text-neutral-500 italic">Henüz bir ödül kazanmadınız. Zirveye oynamaya devam edin!</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                            {myRewards.map((reward, idx) => (
                                                <div key={idx} className="p-6 rounded-2xl border border-white/5 bg-zinc-950 flex flex-col gap-4 relative overflow-hidden group hover:border-amber-500/30 transition-all shadow-xl animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                                                    <div className="absolute -top-4 -right-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                                        <Trophy className="h-32 w-32 text-amber-500" />
                                                    </div>

                                                    <div className="space-y-1 relative z-10">
                                                        <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Kampanya</div>
                                                        <h3 className="text-[11px] font-bold text-[#F7EBA5] uppercase tracking-tight line-clamp-1">{reward.event_name}</h3>
                                                    </div>

                                                    <div className="py-2 relative z-10">
                                                        <div className="text-4xl font-black italic text-amber-500 leading-none drop-shadow-sm flex items-end gap-1">
                                                            {reward.amount} <span className="text-xs not-italic font-black text-neutral-500 mb-1">TL</span>
                                                        </div>
                                                        <Badge className="mt-3 bg-emerald-500/10 text-emerald-500 border-none text-[9px] font-black uppercase tracking-tighter px-2">
                                                            • İŞLEM TAMAMLANDI
                                                        </Badge>
                                                    </div>

                                                    <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center relative z-10">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] uppercase font-black text-neutral-600 tracking-widest">Tarih</span>
                                                            <span className="text-xs font-mono font-bold text-neutral-300">{new Date(reward.timestamp).toLocaleDateString('tr-TR')}</span>
                                                        </div>
                                                        <div className="p-2 rounded-full bg-amber-500/10 text-amber-500">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </ClientLayout>
    )
}
