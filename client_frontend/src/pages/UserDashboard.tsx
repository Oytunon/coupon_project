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

import { useNavigate, useParams } from "react-router-dom"
import { TournamentDetails } from "@/components/premium/TournamentDetails"

export default function UserDashboard() {
    const { eventId: paramEventId, username: paramUsername } = useParams()
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
            setPublicEvents(events)
            setMyEnrollments(enrollments || [])
            setMyCoupons(coupons || [])
            setMyRewards(rewards || [])
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
        try {
            await joinCampaign(username, id)
            toast({ title: "Başarılı", description: "Turnuvaya başarıyla katıldınız!" })
            fetchData()
        } catch (e) {
            toast({ title: "Hata", description: "Katılım başarısız oldu.", variant: "destructive" })
        }
    }

    const handleSwitchEvent = (id: number) => {
        let url = `/event/${id}`
        if (username) url += `?username=${username}`
        window.location.href = url
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
                    onBack={() => navigate('/')}
                    username={username || ''}
                />
            )
        }
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
                        <TabsContent value="leaderboard" className="mt-6 animation-in fade-in slide-in-from-bottom-2">
                            <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-white"><Trophy className="h-5 w-5 text-amber-500" /> Sıralamarım</CardTitle>
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
                                                                <TableCell className="font-bold text-white">{enr.event_name}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={enr.status === 'active' ? 'default' : 'secondary'} className={enr.status === 'active' ? 'bg-emerald-500/20 text-emerald-500 border-none' : 'bg-white/5 text-neutral-500 border-none'}>
                                                                        {enr.status === 'active' ? 'AKTİF' : 'TAMAMLANDI'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-amber-500 font-bold">{enr.score.toLocaleString()}</TableCell>
                                                                <TableCell className="text-right font-black text-xl text-white italic">#{enr.rank}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button size="sm" variant="ghost" className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10" onClick={() => toggleLeaderboard(enr.event_id)}>
                                                                        {expandedEventId === enr.event_id ? 'Kapat' : 'Sıralama'}
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                            {expandedEventId === enr.event_id && (
                                                                <TableRow className="bg-black/40 border-none">
                                                                    <TableCell colSpan={5} className="p-4">
                                                                        <div className="rounded-xl border border-white/5 overflow-hidden animate-in fade-in zoom-in-95">
                                                                            <Table>
                                                                                <TableHeader className="bg-white/5">
                                                                                    <TableRow className="border-none">
                                                                                        <TableHead className="w-[80px] text-[10px] uppercase font-bold">Sıra</TableHead>
                                                                                        <TableHead className="text-[10px] uppercase font-bold">Kullanıcı</TableHead>
                                                                                        <TableHead className="text-right text-[10px] uppercase font-bold">Puan</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {loadingLeaderboard ? (
                                                                                        <TableRow><TableCell colSpan={3} className="text-center py-4"><Loader2 className="animate-spin h-5 w-5 mx-auto text-amber-500" /></TableCell></TableRow>
                                                                                    ) : (
                                                                                        expandedLeaderboard.map((user, idx) => (
                                                                                            <TableRow key={idx} className={user.username === username ? "bg-amber-500/10 border-amber-500/20" : "border-white/5"}>
                                                                                                <TableCell className="font-mono font-bold text-white">#{idx + 1}</TableCell>
                                                                                                <TableCell className={user.username === username ? "text-amber-500 font-bold" : "text-neutral-300"}>
                                                                                                    {user.username === username ? `${user.username} (SEN)` : user.username}
                                                                                                </TableCell>
                                                                                                <TableCell className="text-right font-mono text-white">{(user.score || 0).toLocaleString()}</TableCell>
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
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="my-coupons" className="mt-6 animation-in fade-in slide-in-from-bottom-2">
                            <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-white"><Ticket className="h-5 w-5 text-amber-500" /> Kuponlarım</CardTitle>
                                    <div className="flex items-center gap-4 mt-4">
                                        <Select value={eventId ? eventId.toString() : ""} onValueChange={(val) => {
                                            setEventId(Number(val))
                                            setSlug(null)
                                        }}>
                                            <SelectTrigger className="w-full sm:w-[320px] bg-white/5 border-white/10 text-white">
                                                <SelectValue placeholder="Turnuva Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-white/10 text-white">
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
                                                                {new Date(coupon.inserted_at).toLocaleString('tr-TR')}
                                                            </div>
                                                            {coupon.is_live && <Badge className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0 h-4 border-none">CANLI</Badge>}
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
                                                                                    <div className="text-white font-bold text-[11px] leading-tight">{sel.MatchName}</div>
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
                                                                <span className="text-neutral-500">Tutar: <span className="text-white font-mono">{coupon.stake}TL</span></span>
                                                                <span className="text-neutral-500">Oran: <span className="text-white font-mono">{coupon.odds}</span></span>
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
                                        <CardTitle className="flex items-center gap-2 text-white"><LayoutGrid className="h-5 w-5 text-amber-500" /> Kategoriler</CardTitle>
                                        <CardDescription className="text-neutral-500">Aktif turnuvalara katılarak büyük ödüllerden payınızı alın.</CardDescription>
                                    </div>
                                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                                        <Button
                                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className={`h-8 w-8 p-0 ${viewMode === 'grid' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'text-neutral-400 hover:text-white'}`}
                                            onClick={() => setViewMode('grid')}
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className={`h-8 w-8 p-0 ${viewMode === 'list' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'text-neutral-400 hover:text-white'}`}
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
                                                                    <TableCell className="font-bold text-white">{event.name}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className={event.status === 'active' ? 'bg-emerald-500/20 text-emerald-500 border-none px-3' : 'bg-neutral-800 text-neutral-500 border-none px-3'}>
                                                                            {event.status === 'active' ? 'AKTİF' : 'TAMAMLANDI'}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-white">{event.participant_count}</TableCell>
                                                                    <TableCell className="text-right text-[10px] text-neutral-500">
                                                                        <div className="font-bold">{new Date(event.start_date).toLocaleDateString('tr-TR')}</div>
                                                                        <div>{new Date(event.end_date).toLocaleDateString('tr-TR')}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button size="sm" variant={event.status === 'active' ? "default" : "outline"}
                                                                            className={`font-black text-[10px] uppercase px-4 ${event.status === 'active' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-transparent border-white/10 text-white hover:bg-white/5'}`}
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
                                    <CardTitle className="flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-amber-500" /> Turnuva Kuralları</CardTitle>
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
                                                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
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
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-white">Yatırım Şartı</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed"> Minimum <strong className="text-amber-500 font-black">{rules.min_deposit ?? 1000} TL</strong> yatırım yapmış olmanız gerekmektedir.</p>
                                                        </div>

                                                        <div className="p-5 bg-zinc-900/40 rounded-xl border border-white/5 transition-all hover:bg-zinc-900 group/item">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                                                                    <ArrowUpRight className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-white">Minimum Oran</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed">Kupon başı toplam oran en az <strong className="text-amber-500 font-black">{(rules.min_odd || 1.5).toFixed(2)}</strong> olmalıdır.</p>
                                                        </div>

                                                        <div className="p-5 bg-zinc-900/40 rounded-xl border border-white/5 transition-all hover:bg-zinc-900 group/item">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                                                                    <Ticket className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-white">Kombine Şartı</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed">Her kupon en az <strong className="text-amber-500 font-black">{rules.min_combination || 2} maç</strong> (kombine) içermelidir.</p>
                                                        </div>

                                                        <div className="p-5 bg-zinc-900/40 rounded-xl border border-white/5 transition-all hover:bg-zinc-900 group/item">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                                                                    <Award className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <h4 className="font-black uppercase tracking-wider text-xs text-white">Minimum Tutar</h4>
                                                            </div>
                                                            <p className="text-xs text-neutral-400 font-medium leading-relaxed">Kupon tutarı en az <strong className="text-amber-500 font-black">{rules.min_stake || 100} TL</strong> olmalıdır.</p>
                                                        </div>
                                                    </div>

                                                    {/* Rewards Section */}
                                                    {rules.rewards && rules.rewards.length > 0 && (
                                                        <div className="space-y-6 pt-6 border-t border-white/5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-1 w-8 bg-amber-500 rounded-full" />
                                                                <h4 className="font-black italic uppercase tracking-widest text-sm text-white flex items-center gap-2">
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
                                                                                <span className="text-xl font-black italic text-white tracking-tight">
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
                                    <CardTitle className="flex items-center gap-2 text-white"><Gift className="h-5 w-5 text-amber-500" /> Kazandığım Ödüller</CardTitle>
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
                                                        <h3 className="text-[11px] font-bold text-white uppercase tracking-tight line-clamp-1">{reward.event_name}</h3>
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
