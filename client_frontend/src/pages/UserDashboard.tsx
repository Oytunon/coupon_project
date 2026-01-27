import { useEffect, useState } from "react"
import { getParticipationStatus, joinCampaign, getLeaderboard, getMyCoupons } from "../api/participation"
import { getUsernameFromUrl } from "../utils/useUsername"
import {
    Trophy, Loader2, FileText, Award,
    TrendingUp, ArrowUpRight, CheckCircle2, Ticket
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

    // Tab Data States
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [myCoupons, setMyCoupons] = useState<any[]>([])
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
    const [loadingCoupons, setLoadingCoupons] = useState(false)

    const { toast } = useToast()

    useEffect(() => {
        // Priority: Route Params > URL Query Params > Utilities

        let u = paramUsername || getUsernameFromUrl()
        // If route has username, prefer it
        if (paramUsername) u = paramUsername

        setUsername(u)

        const params = new URLSearchParams(window.location.search)

        // Event ID logic
        let rawEid = paramEventId || params.get("event_id")
        // If paramEventId is a slug (not a number), handle it? 
        // Backend supports slug in the same endpoint now, but let's check parsing.

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

        // Parallel Fetching
        const fetchData = async () => {
            // 1. Leaderboard (Public)
            setLoadingLeaderboard(true)
            try {
                const lb = await getLeaderboard(sl || undefined, parsedEid || undefined)
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

            // 2. User specific data
            try {
                const status = await getParticipationStatus(u, parsedEid || undefined, sl || undefined)
                setCanJoin(status.can_join)
                setIsJoined(status.joined)
                if (status.score !== undefined) setUserScore(status.score || 0)
                if (status.rank !== undefined) setUserRank(status.rank)

                // Fetch coupons if user is known
                setLoadingCoupons(true)
                const coupons = await getMyCoupons(u, sl || undefined, parsedEid || undefined)
                setMyCoupons(coupons)
            } catch (err) {
                console.error("User data error", err)
            } finally {
                setLoading(false)
                setLoadingCoupons(false)
            }
        }

        fetchData()
    }, [])

    const handleJoin = async () => {
        if (!username) return

        setJoining(true)
        try {
            await joinCampaign(username, eventId === null ? undefined : eventId, slug || undefined)
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

                            {/* Stats */}
                            <div className="flex gap-4">
                                <Card className="bg-background/10 border-white/10 backdrop-blur flex-1">
                                    <CardHeader className="p-4">
                                        <CardDescription className="text-primary font-bold text-xs uppercase">Puanım</CardDescription>
                                        <CardTitle className="text-2xl text-white">{userScore.toLocaleString()}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="bg-background/10 border-white/10 backdrop-blur flex-1">
                                    <CardHeader className="p-4">
                                        <CardDescription className="text-primary font-bold text-xs uppercase">Sıralamam</CardDescription>
                                        <CardTitle className="text-2xl text-white">#{userRank > 0 ? userRank : '-'}</CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            {/* Join Button */}
                            <div className="pt-2">
                                {isJoined ? (
                                    <Button size="lg" className="w-full md:w-auto h-12 font-bold bg-green-600/20 text-green-500 hover:bg-green-600/30 border border-green-600/50" disabled>
                                        <CheckCircle2 className="mr-2 h-5 w-5" /> KATILIM SAĞLANDI
                                    </Button>
                                ) : (
                                    <Button onClick={handleJoin} disabled={joining || !canJoin} size="lg" className="w-full md:w-auto h-12 font-bold bg-primary hover:bg-primary/90">
                                        {joining ? "İşleniyor..." : "HEMEN KATIL"}
                                    </Button>
                                )}
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
                <Tabs defaultValue="leaderboard" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-card/50 p-1 h-auto">
                        <TabsTrigger value="leaderboard" className="py-3 font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Award className="w-4 h-4 mr-2" /> Sıralama
                        </TabsTrigger>
                        <TabsTrigger value="my-coupons" className="py-3 font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Ticket className="w-4 h-4 mr-2" /> Kuponlarım
                        </TabsTrigger>
                        <TabsTrigger value="rules" className="py-3 font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <FileText className="w-4 h-4 mr-2" /> Kurallar
                        </TabsTrigger>
                    </TabsList>

                    {/* Leaderboard Tab */}
                    <TabsContent value="leaderboard" className="mt-6">
                        <Card className="border-white/10 bg-card/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Liderlik Tablosu</CardTitle>
                                <CardDescription>Turnuvanın en yüksek puanlı 50 katılımcısı.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingLeaderboard ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                                ) : leaderboard.length === 0 ? (
                                    <div className="text-center p-8 text-muted-foreground">Henüz sıralama oluşmadı.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-white/10">
                                                <TableHead className="w-[100px]">Sıra</TableHead>
                                                <TableHead>Kullanıcı</TableHead>
                                                <TableHead className="text-right">Puan</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {leaderboard.map((user) => (
                                                <TableRow
                                                    key={user.rank}
                                                    className={`border-white/5 ${user.username === username ? "bg-primary/10 border-primary/20" : ""}`}
                                                >
                                                    <TableCell className="font-bold">
                                                        {user.rank === 1 && <Trophy className="h-4 w-4 text-yellow-500 inline mr-1" />}
                                                        {user.rank === 2 && <Trophy className="h-4 w-4 text-gray-400 inline mr-1" />}
                                                        {user.rank === 3 && <Trophy className="h-4 w-4 text-amber-700 inline mr-1" />}
                                                        #{user.rank}
                                                    </TableCell>
                                                    <TableCell className={user.username === username ? "text-primary font-bold" : ""}>
                                                        {user.username} {user.username === username && "(Sen)"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-lg">
                                                        {user.score.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
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
                                <CardDescription>Bu turnuvaya dahil olan kuponlarınız.</CardDescription>
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

                    {/* Rules Tab */}
                    <TabsContent value="rules" className="mt-6">
                        <Card className="border-white/10 bg-card/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-green-500" /> Turnuva Kuralları</CardTitle>
                                <CardDescription>Katılım ve puanlama şartları.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                        <div className="mt-1 bg-primary/20 p-1 rounded">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm mb-1">Yatırım Şartı</h4>
                                            <p className="text-xs text-muted-foreground">Bu ay içerisinde tek seferde minimum <strong className="text-foreground">1000 TL</strong> yatırım yapmış olmanız gerekmektedir.</p>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                        <div className="mt-1 bg-yellow-500/20 p-1 rounded">
                                            <ArrowUpRight className="h-4 w-4 text-yellow-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm mb-1">Minimum Oran</h4>
                                            <p className="text-xs text-muted-foreground">Kupon başına toplam oran en az <strong className="text-foreground">1.50</strong> olmalıdır.</p>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                        <div className="mt-1 bg-blue-500/20 p-1 rounded">
                                            <Ticket className="h-4 w-4 text-blue-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm mb-1">Kombine Şartı</h4>
                                            <p className="text-xs text-muted-foreground">Her kupon en az <strong className="text-foreground">2 maç</strong> (kombine) içermelidir.</p>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-background rounded-lg border border-white/5 flex gap-3 items-start">
                                        <div className="mt-1 bg-purple-500/20 p-1 rounded">
                                            <Award className="h-4 w-4 text-purple-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm mb-1">Kupon Tutarı</h4>
                                            <p className="text-xs text-muted-foreground">Kupon tutarı en az <strong className="text-foreground">100 TL</strong> olmalıdır.</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </ClientLayout>
    )
}
