import { useEffect, useState } from "react"
import { getParticipationStatus, joinCampaign } from "./api/participation"
import { getUsernameFromUrl } from "./utils/useUsername"
import {
  Trophy, Loader2, Play, FileText, Award, History, Info,
  AlertCircle, TrendingUp, Users, Calendar, ArrowUpRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, Area, AreaChart } from "recharts"

// Mock data for charts
const prizeDistData = [
  { rank: "1.", prize: 150000, color: "hsl(var(--primary))" },
  { rank: "2.", prize: 100000, color: "hsl(var(--primary) / 0.8)" },
  { rank: "3.", prize: 50000, color: "hsl(var(--primary) / 0.6)" },
  { rank: "4-10", prize: 15000, color: "hsl(var(--primary) / 0.4)" },
  { rank: "11-50", prize: 2500, color: "hsl(var(--primary) / 0.2)" },
]

const activityData = [
  { day: "Pzt", users: 120 },
  { day: "Sal", users: 150 },
  { day: "Çar", users: 280 },
  { day: "Per", users: 190 },
  { day: "Cum", users: 340 },
  { day: "Cmt", users: 510 },
  { day: "Paz", users: 420 },
]

const chartConfig = {
  prize: {
    label: "Ödül Miktarı (TL)",
    color: "hsl(var(--primary))",
  },
  users: {
    label: "Aktif Katılımcı",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig

function App() {
  const [canJoin, setCanJoin] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const u = getUsernameFromUrl()
    setUsername(u)

    if (!u) {
      setLoading(false)
      return
    }

    getParticipationStatus(u)
      .then((res) => setCanJoin(res.can_join))
      .catch((err) => {
        console.error("Katılım durumu kontrol edilemedi:", err)
        setError("Sistem durumu kontrol edilirken bir hata oluştu.")
        setCanJoin(false)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleJoin = async () => {
    if (!username) return

    setJoining(true)
    setError(null)
    try {
      await joinCampaign(username)
      setCanJoin(false)
    } catch (e: any) {
      setError(e.response?.data?.detail || "Katılım işlemi başarısız oldu. Lütfen daha sonra tekrar deneyin.")
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Dashboard Hazırlanıyor...</p>
      </div>
    )
  }

  if (!username) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-dashed border-2">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Erişim Engellendi</CardTitle>
            <CardDescription>
              Bu sayfaya erişmek için kullanıcı adı parametresi gereklidir.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">

      <nav className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
              <Trophy className="h-5 w-5 text-primary-foreground font-bold" />
            </div>
            <span className="font-black text-xl tracking-tighter uppercase italic">Extrabet <span className="text-primary">Pro</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="hidden md:flex gap-1.5 py-1">
              <Users className="h-3.5 w-3.5" /> 1.254 Katılımcı
            </Badge>
            <div className="h-8 w-[1px] bg-border hidden md:block" />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase text-muted-foreground font-bold leading-tight">Hoş Geldin,</p>
                <p className="text-xs font-bold leading-tight">{username}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-orange-500 flex items-center justify-center text-primary-foreground font-bold border-2 border-background">
                {username[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        <section className="relative rounded-3xl overflow-hidden bg-black border border-primary/20 p-8 md:p-12">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-primary/20 text-primary border-primary/30 py-1.5 px-4 rounded-full font-bold uppercase tracking-widest text-[10px]">
                Aktif Turnuva: Aralık 2025
              </Badge>
              <div className="space-y-2">
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-none uppercase italic">
                  Sahada <span className="text-primary underline decoration-primary/30 decoration-8 underline-offset-8">Zirveye</span> Oyna
                </h2>
                <p className="text-muted-foreground text-lg max-w-md">
                  Kuponlarınla puanları topla, liderlik tablosunda yüksel ve ₺500.000 değerindeki dev ödülden payını hemen al.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {canJoin ? (
                  <Button
                    size="lg"
                    className="h-14 px-10 text-lg font-black bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/40 group overflow-hidden relative"
                    onClick={handleJoin}
                    disabled={joining}
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                    {joining ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Katılıyor...</>
                    ) : (
                      <><Play className="mr-2 h-5 w-5 fill-current" /> Turnuvaya Katıl</>
                    )}
                  </Button>
                ) : (
                  <div className="h-14 px-8 flex items-center gap-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl font-black tracking-tight shadow-inner">
                    <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
                    KATILIM ONAYLANDI
                  </div>
                )}
                <Button size="lg" variant="outline" className="h-14 border-white/10 hover:bg-white/5 font-bold">
                  <TrendingUp className="mr-2 h-5 w-5" /> Liderlik Tablosu
                </Button>
              </div>
            </div>

            <div className="hidden md:block relative group">
              <div className="absolute inset-0 bg-primary/20 blur-[60px] group-hover:bg-primary/30 transition-all rounded-full" />
              <Card className="bg-card/40 border-white/5 backdrop-blur-3xl overflow-hidden relative border-none">
                <img
                  src="/images/athletes-banner.png"
                  alt="Tournament"
                  className="w-full h-auto object-cover contrast-125 brightness-90 group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-white/50 uppercase font-black">Turnuva Statüsü</p>
                      <p className="text-xl font-black text-white italic">YÜKSEK GERİLİM</p>
                    </div>
                    <Trophy className="h-10 w-10 text-primary drop-shadow-[0_0_10px_rgba(255,183,0,1)]" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          <Card className="md:col-span-8 bg-card border-white/5 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Ödül Dağılımı
                </CardTitle>
                <CardDescription>Sıralamaya göre kazanılacak tutarlar</CardDescription>
              </div>
              <Badge variant="outline" className="text-primary font-bold">₺500.000 TOPLAM</Badge>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={prizeDistData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="rank"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="prize"
                    fill="var(--color-prize)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="border-t border-white/5 pt-4 text-xs text-muted-foreground flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                Şu an ilk 10'da çekişme %12 arttı
              </div>
              <p>Son Güncelleme: Az Önce</p>
            </CardFooter>
          </Card>

          <Card className="md:col-span-4 bg-card border-white/5 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                Katılım Yoğunluğu <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-6 py-2">
                <div className="text-3xl font-black italic">+850</div>
                <p className="text-xs text-green-500 font-bold flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" /> Bu hafta artışta
                </p>
              </div>
              <ChartContainer config={chartConfig} className="h-[150px] w-full">
                <AreaChart data={activityData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: "Kurallar", icon: FileText, desc: "Min. 100 TL / 1.50 Oran", color: "bg-blue-500" },
            { title: "Sıralama", icon: Award, desc: "Top 100 Listesi", color: "bg-yellow-500" },
            { title: "Geçmiş", icon: History, desc: "Tahmin Geçmişim", color: "bg-purple-500" },
            { title: "Kılavuz", icon: Info, desc: "Nasıl Kazanırım?", color: "bg-green-500" }
          ].map((item, idx) => (
            <Card key={idx} className="group hover:border-primary/50 transition-all shadow-lg hover:shadow-primary/5 cursor-pointer bg-card/40 border-white/5">
              <CardContent className="p-6">
                <div className={`${item.color} w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-black text-lg uppercase italic tracking-tighter">{item.title}</h3>
                <p className="text-xs text-muted-foreground font-medium">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-black tracking-widest uppercase text-primary/80">Turnuva Takvimi</span>
            </div>
            <CardTitle className="text-2xl font-black italic tracking-tight">KAZANMA STRATEJİSİ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 relative">
              {[
                { step: "01", title: "KAYIT OL", desc: "Turnuva sayfasından üyeliğinizle katılım onayı alın." },
                { step: "02", title: "BAHİS YAP", desc: "Her gün belirlenen limitlerde spor bahislerinizi yapın." },
                { step: "03", title: "PUAN TOPLA", desc: "Kuponlarınız sonuçlandıkça puan tablosunda yükselin." }
              ].map((s, i) => (
                <div key={i} className="flex gap-4 items-start relative z-10">
                  <div className="text-4xl font-black text-primary/20 leading-none">{s.step}</div>
                  <div>
                    <h4 className="font-black uppercase italic tracking-tight mb-1">{s.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Uyarı</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center">
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />
        <p className="text-[10px] text-muted-foreground font-bold tracking-[0.5em] uppercase">Powered by Extrabet Engineering © 2025</p>
      </footer>
    </div>
  )
}

export default App
