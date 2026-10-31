import { useEffect, useRef, useState } from "react"
import { joinCampaign, getMyEnrollments, getMyRewards } from "../api/participation"
import { getPublicEvents, PublicEvent } from "../api/client"
import { getUsernameFromUrl } from "../utils/useUsername"
import {
    ArrowLeft, Trophy, Loader2, Award, Zap, Users, DollarSign, Medal, Calendar, Activity
} from "lucide-react"
import { TournamentCard } from "@/components/premium/TournamentCard"
import { UpcomingEventsSlider } from "@/components/premium/UpcomingEventsSlider"
import { PastEventsPagination } from "@/components/premium/PastEventsPagination"
import { EventImage } from "@/components/premium/EventImage"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ClientLayout } from "@/components/layout/ClientLayout"

import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { TournamentDetails } from "@/components/premium/TournamentDetails"
import { parseEventDate } from "@/utils/dateUtils"
import { calculateTotalPrize } from "@/utils/rewardUtils"
import { getThumbUrl } from "@/utils/imageUtils"

// Geçmiş turnuvalar sayfa başına 5 gösterilir; görseller yalnızca görünen sayfa için iner
const PAST_PAGE_SIZE = 5

// Sonuçlanmış (veya süresi geçmiş) ve display_until'i dolmamış turnuvalar, API sırasıyla
function getPastEvents(events: PublicEvent[]): PublicEvent[] {
    const now = new Date()
    return events.filter(e => {
        const isPast = e.status === 'ended' || e.status === 'paused' || (e.status === 'active' && now > parseEventDate(e.end_date))
        if (!isPast) return false
        // Hide if display_until is set and expired
        if (e.display_until && now > parseEventDate(e.display_until)) return false
        return true
    })
}

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
    const [myRewards, setMyRewards] = useState<any[]>([])
    // Ödüller yalnızca SONUÇLANAN / RAPOR görünümünde lazım; ilk açılışı bekletmeden ilk ihtiyaçta çekilir
    const [rewardsStatus, setRewardsStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')

    // Filters
    const [activeCategory, setActiveCategory] = useState("all")
    const [joinCooldownUntil, setJoinCooldownUntil] = useState<number | null>(null)

    // Past tournaments pagination
    const [pastPage, setPastPage] = useState(1)
    const [pastSectionSeen, setPastSectionSeen] = useState(false)
    const pastSectionRef = useRef<HTMLDivElement | null>(null)

    // Kullanıcı adı ilk render'da okunur (sonradan set edilince açılışta veriler iki kez çekiliyordu)
    const [username] = useState<string | null>(() => paramUsername || getUsernameFromUrl())

    // Fetch Data - ilk ekran yalnızca turnuva listesini ve kullanıcının kayıtlarını bekler
    const fetchData = async () => {
        setLoading(true)
        setFetchError(null)
        try {
            const [events, enrollments] = await Promise.all([
                getPublicEvents(),
                username ? getMyEnrollments(username) : Promise.resolve([])
            ])
            setPublicEvents(Array.isArray(events) ? events : [])
            setMyEnrollments(Array.isArray(enrollments) ? enrollments : [])
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

    const loadRewards = async () => {
        if (!username) return
        setRewardsStatus('loading')
        try {
            const rewards = await getMyRewards(username)
            setMyRewards(Array.isArray(rewards) ? rewards : [])
            setRewardsStatus('loaded')
        } catch (err) {
            console.error(err)
            setRewardsStatus('error')
        }
    }

    useEffect(() => {
        if ((activeCategory === 'finished' || activeCategory === 'report') && rewardsStatus === 'idle') {
            loadRewards()
        }
    }, [activeCategory, rewardsStatus])

    // Actions
    const handleJoin = async (id: number) => {
        if (!username) {
            toast({ title: "Hata", description: "Katılmak için giriş yapmalısınız.", variant: "destructive" })
            return
        }
        if (joinCooldownUntil && Date.now() < joinCooldownUntil) {
            const secLeft = Math.ceil((joinCooldownUntil - Date.now()) / 1000)
            toast({ title: "Lütfen bekleyin", description: `Sunucu yoğun. ${secLeft} saniye sonra tekrar deneyin.`, variant: "destructive" })
            return
        }

        const event = publicEvents.find(e => e.id === id)
        if (event && new Date() > parseEventDate(event.end_date)) {
            toast({ title: "Hata", description: "Bu turnuvanın süresi dolmuştur.", variant: "destructive" })
            return
        }

        try {
            await joinCampaign(username, id)
            setJoinCooldownUntil(null)
            toast({ title: "Başarılı", description: "Turnuvaya başarıyla katıldınız!" })
            fetchData()
        } catch (e: any) {
            const status = e?.response?.status
            const msg = e?.response?.data?.detail || e?.response?.data?.message || "Katılım başarısız oldu."
            if (status === 429) {
                const retrySec = e?.response?.data?.retry_after_seconds ?? 130
                setJoinCooldownUntil(Date.now() + retrySec * 1000)
            }
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

    // Kategori değişince geçmiş turnuvalar ilk sayfadan başlasın
    useEffect(() => {
        setPastPage(1)
    }, [activeCategory])

    // Geçmiş bölüm ekrana yaklaşınca işaretle; sonraki sayfanın önden yüklenmesi ancak o zaman başlar
    useEffect(() => {
        const el = pastSectionRef.current
        if (!el || pastSectionSeen) return
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setPastSectionSeen(true)
        }, { rootMargin: "200px" })
        observer.observe(el)
        return () => observer.disconnect()
    }, [loading, activeCategory, publicEvents, pastSectionSeen])

    // Sadece BİR sonraki sayfanın görsellerini boşta ve düşük öncelikle indir (veri tasarrufu modunda atla)
    useEffect(() => {
        if (!pastSectionSeen) return
        if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
        const nextUrls = getPastEvents(publicEvents)
            .slice(pastPage * PAST_PAGE_SIZE, (pastPage + 1) * PAST_PAGE_SIZE)
            .map(e => getThumbUrl(e.image_url))
            .filter((url): url is string => !!url)
        if (nextUrls.length === 0) return
        const preload = () => nextUrls.forEach(url => {
            const img = new Image()
            img.setAttribute("fetchpriority", "low")
            img.src = url
        })
        if (typeof window.requestIdleCallback === "function") {
            const handle = window.requestIdleCallback(preload, { timeout: 4000 })
            return () => window.cancelIdleCallback(handle)
        }
        const handle = window.setTimeout(preload, 1500)
        return () => window.clearTimeout(handle)
    }, [pastSectionSeen, pastPage, publicEvents])

    // Detail View Logic - hesaplamaları her zaman yap (hooks sırası sabit kalsın)
    const targetEventId = paramEventId ? Number(paramEventId) : null
    const selectedEvent = targetEventId ? publicEvents.find(e => e.id === targetEventId) : null
    const selectedEnrollment = selectedEvent ? myEnrollments.find(e => e.event_id === targetEventId) : null

    if (loading) {
        // Turnuva linkiyle gelindiyse ana sayfa bir anlığına görünmesin; detay açılana kadar bekle
        if (targetEventId) {
            return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-amber-500 w-12 h-12" /></div>
        }
        // Menü hemen görünsün; liste gelene kadar iskelet kartlar
        return (
            <ClientLayout username={username} activeCategory={activeCategory} onCategoryChange={(c) => setActiveCategory(c)}>
                <main className="max-w-[1200px] mx-auto px-2 md:px-6 py-8 space-y-12">
                    <div className="space-y-6 animate-pulse" aria-busy="true">
                        <div className="h-12 md:h-28 rounded-lg md:rounded-3xl bg-white/5 border border-white/5" />
                        <div className="space-y-1.5">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="h-32 lg:h-44 rounded-xl bg-white/5 border-2 border-[#D9B648]/20" />
                            ))}
                        </div>
                    </div>
                </main>
            </ClientLayout>
        )
    }

    if (selectedEvent) {
        return (
            <TournamentDetails
                event={selectedEvent}
                userPoints={selectedEnrollment?.score || 0}
                userRank={selectedEnrollment?.rank || 0}
                isJoined={!!selectedEnrollment}
                onBack={() => {
                    setSearchParams(prev => {
                        const newParams = new URLSearchParams(prev)
                        newParams.delete('eventId')
                        return newParams
                    })
                }}
                username={username || ''}
                onJoin={() => handleJoin(selectedEvent.id)}
                joinedAt={selectedEnrollment?.joined_at}
            />
        )
    }

    // Filter Logic - Event dates are stored as TR (UTC+3), parse with +03:00 to avoid 3h shift
    const upcomingEventsList = publicEvents.filter(e => {
        const now = new Date()
        const start = parseEventDate(e.start_date)
        const isUpcoming = e.status === 'active' && (now < start)
        const isJoined = myEnrollments.some(enr => enr.event_id === e.id)
        return isUpcoming && !isJoined
    }).sort((a, b) => parseEventDate(a.start_date).getTime() - parseEventDate(b.start_date).getTime())

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
    }).sort((a, b) => {
        if (activeCategory !== 'upcoming') return 0
        return parseEventDate(a.start_date).getTime() - parseEventDate(b.start_date).getTime()
    })

    const pastEvents = getPastEvents(publicEvents)
    const pastPageCount = Math.max(1, Math.ceil(pastEvents.length / PAST_PAGE_SIZE))
    const currentPastPage = Math.min(pastPage, pastPageCount)
    const pagedPastEvents = pastEvents.slice((currentPastPage - 1) * PAST_PAGE_SIZE, currentPastPage * PAST_PAGE_SIZE)

    const handlePastPageChange = (page: number) => {
        setPastPage(page)
        pastSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }


    return (
        <ClientLayout username={username} activeCategory={activeCategory} onCategoryChange={(c) => setActiveCategory(c)}>
            <main className="max-w-[1200px] mx-auto px-2 md:px-6 py-8 space-y-12">

                {fetchError && (
                    <div className="text-center p-4 text-neutral-400 bg-white/5 rounded-xl border border-dashed border-white/10">
                        {fetchError}
                        <button onClick={() => fetchData()} className="ml-2 font-bold text-[#D9B648] underline underline-offset-4">Tekrar dene</button>
                    </div>
                )}

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
                                                return "Tüm aktif turnuvalara katıldınız!";
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
                            <div ref={pastSectionRef} className="space-y-1.5 pt-1 border-t border-white/10 scroll-mt-4">
                                <div className="flex items-center gap-2 lg:gap-4 justify-center">
                                    <div className="h-px bg-gradient-to-r from-transparent to-primary/30 flex-1"></div>
                                    <h3 className="text-sm lg:text-xl font-black text-[#F7EBA5] uppercase italic tracking-widest px-2 lg:px-8 whitespace-nowrap">
                                        GEÇMİŞ TURNUVALAR
                                    </h3>
                                    <div className="h-px bg-gradient-to-l from-transparent to-primary/30 flex-1"></div>
                                </div>
                                <div className="space-y-1.5">
                                    {pagedPastEvents.map((event) => {
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
                                    <PastEventsPagination page={currentPastPage} pageCount={pastPageCount} onChange={handlePastPageChange} />
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
                    <div id="past" ref={pastSectionRef} className="mt-12 opacity-100 transition-opacity duration-300 scroll-mt-4">
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
                                {pagedPastEvents.map(event => {
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
                                                            <EventImage src={event.image_url || "/5.jpg"} alt={event.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
                                                                    <EventImage src={event.image_url || "/5.jpg"} alt={event.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
                                <PastEventsPagination page={currentPastPage} pageCount={pastPageCount} onChange={handlePastPageChange} />
                            </div>
                        )}
                    </div>
                )}

                {/* Ödüller henüz gelmediyse rapordaki kazançlar yanlışlıkla 0 görünmesin */}
                {activeCategory === 'report' && username && rewardsStatus !== 'loaded' && (
                    <div className="mt-6 flex flex-col items-center gap-3 p-12 text-neutral-500">
                        {rewardsStatus === 'error' ? (
                            <>
                                <p>Ödül bilgileri yüklenemedi.</p>
                                <button onClick={() => loadRewards()} className="font-bold text-[#D9B648] underline underline-offset-4">Tekrar dene</button>
                            </>
                        ) : (
                            <Loader2 className="animate-spin text-amber-500 w-8 h-8" />
                        )}
                    </div>
                )}

                {/* Report View */}
                {activeCategory === 'report' && (!username || rewardsStatus === 'loaded') && (() => {
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
                                                            <tr key={enr.event_id} className="border-b border-[#D9B648]/10 hover:bg-[#D9B648]/5 transition-colors cursor-pointer">
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
            </main>
        </ClientLayout>
    )
}
