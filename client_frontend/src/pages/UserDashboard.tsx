import { useEffect, useState, Fragment } from "react"
import { getParticipationStatus, joinCampaign, getLeaderboard, getMyCoupons, getMyEnrollments } from "../api/participation"
import { getPublicEvents, PublicEvent } from "../api/client"
import { getUsernameFromUrl } from "../utils/useUsername"
import {
    Trophy, Loader2, FileText, Award,
    TrendingUp, ArrowUpRight, CheckCircle2, Ticket, List as ListIcon, LayoutGrid, PlayCircle
} from "lucide-react"
import tournamentBanner from "../assets/tournament-banner.jpg"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClientLayout } from "@/components/layout/ClientLayout"

import { useParams } from "react-router-dom"

export default function UserDashboard() {
    const { eventId: paramEventId, username: paramUsername } = useParams()
    const [canJoin, setCanJoin] = useState(false)
    const [isJoined, setIsJoined] = useState(false)
    const [username, setUsername] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState(false)
    const [userScore, setUserScore] = useState<number>(0)
    const [userRank, setUserRank] = useState<number>(0)
    const [eventId, setEventId] = useState<number | null>(null)
    const [slug, setSlug] = useState<string | null>(null)
    const [publicEvents, setPublicEvents] = useState<PublicEvent[]>([])
    const [activeTab, setActiveTab] = useState("leaderboard")
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [myEnrollments, setMyEnrollments] = useState<any[]>([])
    const [myCoupons, setMyCoupons] = useState<any[]>([])
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
    const [loadingEnrollments, setLoadingEnrollments] = useState(false)
    const [loadingCoupons, setLoadingCoupons] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [expandedEventId, setExpandedEventId] = useState<number | null>(null)
    const [expandedLeaderboard, setExpandedLeaderboard] = useState<any[]>([])

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
                // If it's a string in the ID slot, treat as slug
                sl = rawEid
            }
        }

        setEventId(parsedEid)
        setSlug(sl)

        const fetchData = async () => {
            setLoadingLeaderboard(true)
            try {
                const lb = await getLeaderboard(sl || undefined, parsedEid || undefined, 50, u || null)
                setLeaderboard(lb)
            } catch (e) {
                console.error("Leaderboard error", e)
            } finally {
                setLoadingLeaderboard(false)
            }

            if (!u) {
                setLoading(false)
                return
            }

            try {
                const status = await getParticipationStatus(u, parsedEid || undefined, sl || undefined)
                setCanJoin(status.can_join)
                setIsJoined(status.joined)
                if (status.score !== undefined) setUserScore(status.score || 0)
                if (status.rank !== undefined) setUserRank(status.rank)

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
        const loadEvents = async () => {
            try {
                const events = await getPublicEvents()
                console.log("DEBUG: Events fetched:", events)
                if (Array.isArray(events)) {
                    setPublicEvents(events)
                    console.log("DEBUG: Public events state updated:", events.length)

                    // If no eventId is set yet (root path), auto-select the first active valid event
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
            setCanJoin(false)
            toast({
                title: "Katılım Başarılı! 🎉",
                description: "Turnuvaya başarıyla katıldınız.",
            })
            // Refresh
            window.location.reload()
        } catch (e: any) {
            const errorMsg = e.response?.data?.detail || "Katılım işlemi başarısız oldu."
            if (errorMsg.includes("1000 TL")) {
                toast({
                    variant: "destructive",
                    title: "⚠️ Katılım Şartı Sağlanmadı",
                    description: errorMsg + " Bu ay içinde tek seferde 1000 TL veya üzeri yatırım yapmalısınız.",
                })
            } else {
                toast({ variant: "destructive", title: "Hata", description: errorMsg })
            }
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
            const lb = await getLeaderboard(undefined, eventId, 50, username)
            setExpandedLeaderboard(lb)
            setExpandedEventId(eventId)
            // Sync global event context so Coupons tab shows this event
            setEventId(eventId)
            setSlug(null)
        } catch (e) {
            toast({ variant: "destructive", title: "Hata", description: "Sıralama yüklenemedi." })
        } finally {
            setLoadingLeaderboard(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Yükleniyor...</p>
            </div>
        )
    }

    return (
        <ClientLayout username={username}>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Hero Section */}
                <section className="relative rounded-3xl overflow-hidden bg-black border border-primary/20 p-8 md:p-12">
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
                    <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <Badge className="bg-primary/20 text-primary border-primary/30 py-1.5 px-4 rounded-full font-bold uppercase tracking-widest text-[10px]">
                                Aktif Turnuva
                            </Badge>
                            <div>
                                <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-none uppercase italic mb-2">
                                    <span className="text-primary">Zirveye</span> Oyna
                                </h2>
                                <p className="text-muted-foreground text-lg">Puan topla, sıralamada yüksel, ödülleri kazan.</p>
                            </div>




                        </div>
                        {/* Right Side Image */}
                        <div className="hidden md:flex justify-center md:absolute md:right-0 md:bottom-0 md:h-full md:w-1/2 items-end">
                            <img
                                src={tournamentBanner}
                                alt="Tournament Banner"
                                className="object-contain max-h-[120%] w-auto mask-image-gradient"
                                style={{ maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)' }}
                            />
                        </div>
                    </div>
                </section>

                {/* Main Tabs */}
                <Tabs defaultValue="leaderboard" className="w-full" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4 bg-card/50 p-1 h-auto">
                        <TabsTrigger value="leaderboard" className="py-3 font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Award className="w-4 h-4 mr-2" /> Sıralamalarım
                        </TabsTrigger>
                        <TabsTrigger value="tournaments" className="py-3 font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <ListIcon className="w-4 h-4 mr-2" /> Turnuvalar
                        </TabsTrigger>
                        <TabsTrigger value="my-coupons" className="py-3 font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Ticket className="w-4 h-4 mr-2" /> Kuponlarım
                        </TabsTrigger>
                        <TabsTrigger value="rules" className="py-3 font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <FileText className="w-4 h-4 mr-2" /> Kurallar
                        </TabsTrigger>
                    </TabsList>

                    {/* My Rankings / Leaderboard Tab */}
                    <TabsContent value="leaderboard" className="mt-6">
                        <Card className="border-white/10 bg-card/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Sıralamalarım</CardTitle>
                                <CardDescription>Katıldığınız turnuvalardaki anlık durumunuz.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingEnrollments ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                                ) : myEnrollments.length === 0 ? (
                                    <div className="text-center p-8 text-muted-foreground">Henüz hiçbir turnuvaya katılmadınız.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-white/10">
                                                <TableHead>Turnuva</TableHead>
                                                <TableHead>Durum</TableHead>
                                                <TableHead className="text-right">Puan</TableHead>
                                                <TableHead className="text-right">Sıralama</TableHead>
                                                <TableHead className="text-right">İşlem</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {myEnrollments.map((enr) => (
                                                <Fragment key={enr.event_id}>
                                                    <TableRow className="border-white/5 hover:bg-white/5">
                                                        <TableCell className="font-bold text-white">{enr.event_name}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={enr.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                                                {enr.status === 'active' ? 'Aktif' : 'Tamamlandı'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">{enr.score.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-bold text-lg text-primary">#{enr.rank}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" variant="ghost" onClick={() => toggleLeaderboard(enr.event_id)}>
                                                                {expandedEventId === enr.event_id ? 'Kapat' : 'Sıralamayı Göster'} <ListIcon className="ml-1 h-3 w-3" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    {expandedEventId === enr.event_id && (
                                                        <TableRow className="bg-black/20 hover:bg-black/20">
                                                            <TableCell colSpan={5} className="p-4">
                                                                <div className="rounded-lg border border-white/10 overflow-hidden">
                                                                    <Table>
                                                                        <TableHeader className="bg-black/40">
                                                                            <TableRow>
                                                                                <TableHead className="w-[80px]">Sıra</TableHead>
                                                                                <TableHead>Kullanıcı</TableHead>
                                                                                <TableHead className="text-right">Puan</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {loadingLeaderboard ? (
                                                                                <TableRow><TableCell colSpan={3} className="text-center py-4"><Loader2 className="animate-spin h-5 w-5 mx-auto" /></TableCell></TableRow>
                                                                            ) : expandedLeaderboard.length === 0 ? (
                                                                                <TableRow><TableCell colSpan={3} className="text-center py-4">Veri yok</TableCell></TableRow>
                                                                            ) : (
                                                                                expandedLeaderboard.map((user, idx) => (
                                                                                    <TableRow key={idx} className={user.username === username ? "bg-primary/10" : ""}>
                                                                                        <TableCell className="font-mono font-bold">#{idx + 1}</TableCell>
                                                                                        <TableCell>{user.username === username ? `${user.username} (Sen)` : user.username}</TableCell>
                                                                                        <TableCell className="text-right font-mono">{user.total_score.toLocaleString()}</TableCell>
                                                                                    </TableRow>
                                                                                ))
                                                                            )}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* My Coupons Tab */}
                    <TabsContent value="my-coupons" className="mt-6">
                        <Card className="border-white/10 bg-card/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-blue-500" /> Kuponlarım</CardTitle>
                                <CardDescription>
                                    {publicEvents.find(e => e.id === eventId)?.name ?
                                        <span className="text-primary font-bold">Seçili Turnuva: {publicEvents.find(e => e.id === eventId)?.name}</span>
                                        : "Katılım sağlanan turnuvalara dahil olan kuponlarınız."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!username ? (
                                    <div className="text-center p-8 text-muted-foreground bg-secondary/20 rounded-lg border-dashed border-2">
                                        Kuponlarınızı görmek için lütfen kampanya linki üzerinden giriş yapınız.
                                    </div>
                                ) : loadingCoupons ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                                ) : myCoupons.length === 0 ? (
                                    <div className="text-center p-12 flex flex-col items-center gap-4">
                                        <Ticket className="h-12 w-12 text-muted-foreground/50" />
                                        <p className="text-muted-foreground">Henüz puanlanan bir kuponunuz yok.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {myCoupons.map((coupon: any) => (
                                            <div key={coupon.id} className="flex items-center justify-between p-4 bg-background/40 rounded-lg border border-white/5 hover:border-primary/20 transition-colors">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono text-muted-foreground">#{coupon.bet_id}</span>
                                                        <Badge variant={
                                                            coupon.state === "Won" ? "default" :
                                                                coupon.state === "Lost" ? "destructive" : "secondary"
                                                        } className="uppercase text-[10px]">
                                                            {coupon.state || "Bekliyor"}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(coupon.inserted_at).toLocaleString('tr-TR')}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-lg">
                                                        {(coupon.calculation || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">PUAN</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Oran: {coupon.odds}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tournaments Tab */}
                    <TabsContent value="tournaments" className="mt-6">
                        <Card className="border-white/10 bg-card/30">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="flex items-center gap-2"><ListIcon className="h-5 w-5 text-purple-500" /> Turnuvalar</CardTitle>
                                    <CardDescription>Aktif ve tamamlanmış tüm turnuvalar.</CardDescription>
                                </div>
                                <div className="flex bg-background/50 p-1 rounded-lg border border-white/5">
                                    <Button
                                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setViewMode('list')}
                                    >
                                        <ListIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {publicEvents.length === 0 ? (
                                    <div className="text-center p-12 text-muted-foreground">
                                        {fetchError ? (
                                            <div className="text-red-500 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                                                <p className="font-bold">Hata Oluştu</p>
                                                <p className="text-sm">{fetchError}</p>
                                                <p className="text-xs mt-2 text-muted-foreground">Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.</p>
                                            </div>
                                        ) : (
                                            "Hiçbir turnuva bulunamadı."
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {viewMode === 'grid' ? (
                                            <div className="grid gap-4 md:grid-cols-2">
                                                {publicEvents.map((event) => (
                                                    <div key={event.id} className="group relative overflow-hidden rounded-xl border border-white/5 bg-background/40 hover:border-primary/50 transition-all duration-300">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="p-5 flex flex-col gap-4 relative z-10">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                                                            {event.status === 'active' ? 'Aktif' : 'Tamamlandı'}
                                                                        </Badge>
                                                                        {event.status === 'active' &&
                                                                            <span className="flex items-center text-[10px] text-green-500 font-bold animate-pulse">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" /> CANLI
                                                                            </span>
                                                                        }
                                                                    </div>
                                                                    <h3 className="font-bold text-xl leading-tight group-hover:text-primary transition-colors">{event.name}</h3>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs text-muted-foreground font-mono">Katılımcı</div>
                                                                    <div className="font-bold text-lg">{event.participant_count > 0 ? event.participant_count : 0}</div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1 text-sm text-muted-foreground">
                                                                <div className="flex justify-between">
                                                                    <span>Başlangıç:</span>
                                                                    <span className="text-foreground">{new Date(event.start_date).toLocaleDateString('tr-TR')}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Bitiş:</span>
                                                                    <span className="text-foreground">{new Date(event.end_date).toLocaleDateString('tr-TR')}</span>
                                                                </div>
                                                            </div>

                                                            <Button variant="secondary" className="w-full mt-2 font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                                                disabled={myEnrollments.some(e => e.event_id === event.id)}
                                                                onClick={() => event.status === 'active' ? handleJoin(event.id) : handleSwitchEvent(event.id)}>
                                                                {myEnrollments.some(e => e.event_id === event.id) ? (
                                                                    <><CheckCircle2 className="mr-2 h-4 w-4" /> KATILDI</>
                                                                ) : (
                                                                    event.status === 'active' ? (joining ? 'İŞLENİYOR...' : 'HEMEN KATIL') : 'SONUÇLARI GÖR'
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent border-white/10">
                                                        <TableHead>Turnuva Adı</TableHead>
                                                        <TableHead>Durum</TableHead>
                                                        <TableHead className="text-right">Katılımcı</TableHead>
                                                        <TableHead className="text-right">Tarihler</TableHead>
                                                        <TableHead className="text-right">İşlem</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {publicEvents.map((event) => (
                                                        <TableRow key={event.id} className="border-white/5 hover:bg-white/5">
                                                            <TableCell className="font-bold text-white">
                                                                {event.name}
                                                                {event.status === 'active' &&
                                                                    <span className="ml-2 inline-flex items-center text-[10px] text-green-500 font-bold">
                                                                        CANLI
                                                                    </span>
                                                                }
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                                                    {event.status === 'active' ? 'Aktif' : 'Tamamlandı'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">{event.participant_count}</TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                                <div>{new Date(event.start_date).toLocaleDateString('tr-TR')}</div>
                                                                <div>{new Date(event.end_date).toLocaleDateString('tr-TR')}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button size="sm" variant={event.status === 'active' ? "default" : "secondary"}
                                                                    className="font-bold text-xs"
                                                                    disabled={myEnrollments.some(e => e.event_id === event.id)}
                                                                    onClick={() => event.status === 'active' ? handleJoin(event.id) : handleSwitchEvent(event.id)}>
                                                                    {myEnrollments.some(e => e.event_id === event.id) ? (
                                                                        <><CheckCircle2 className="mr-1 h-3 w-3" /> KATILDI</>
                                                                    ) : (
                                                                        event.status === 'active' ? (joining ? 'KATIL' : 'HEMEN KATIL') : 'İNCELE'
                                                                    )}
                                                                    {!myEnrollments.some(e => e.event_id === event.id) && <ArrowUpRight className="ml-1 h-3 w-3" />}
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Rules Tab */}
                    <TabsContent value="rules" className="mt-6">
                        <Card className="border-white/10 bg-card/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-green-500" /> Turnuva Kuralları</CardTitle>
                                <CardDescription>
                                    Aktif turnuvalar ve katılım şartları.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                {publicEvents.filter(e => e.status === 'active').length === 0 ? (
                                    <div className="text-center text-muted-foreground p-8">Aktif turnuva bulunmuyor.</div>
                                ) : (
                                    publicEvents.filter(e => e.status === 'active').map(event => {
                                        const rules = event.rules || {}
                                        return (
                                            <div key={event.id} className="space-y-4 border-b border-white/5 pb-8 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
                                                        {event.name}
                                                    </Badge>
                                                    <span className="text-sm text-muted-foreground">Turnuva Kuralları</span>
                                                </div>

                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                                        <div className="mt-1 bg-primary/20 p-1 rounded">
                                                            <TrendingUp className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-sm mb-1">Yatırım Şartı</h4>
                                                            <p className="text-xs text-muted-foreground">Bu ay içerisinde tek seferde minimum <strong className="text-foreground">{rules.min_deposit ?? 1000} TL</strong> yatırım yapmış olmanız gerekmektedir.</p>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                                        <div className="mt-1 bg-yellow-500/20 p-1 rounded">
                                                            <ArrowUpRight className="h-4 w-4 text-yellow-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-sm mb-1">Minimum Oran</h4>
                                                            <p className="text-xs text-muted-foreground">Kupon başına toplam oran en az <strong className="text-foreground">{(rules.min_odd || 1.5).toFixed(2)}</strong> olmalıdır.</p>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                                        <div className="mt-1 bg-blue-500/20 p-1 rounded">
                                                            <Ticket className="h-4 w-4 text-blue-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-sm mb-1">Kombine Şartı</h4>
                                                            <p className="text-xs text-muted-foreground">Her kupon en az <strong className="text-foreground">{rules.min_combination || 2} maç</strong> (kombine) içermelidir.</p>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                                        <div className="mt-1 bg-purple-500/20 p-1 rounded">
                                                            <Award className="h-4 w-4 text-purple-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-sm mb-1">Kupon Tutarı</h4>
                                                            <p className="text-xs text-muted-foreground">Kupon tutarı en az <strong className="text-foreground">{rules.min_stake || 100} TL</strong> olmalıdır.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </ClientLayout >
    )
}
