import { useEffect, useState } from "react"
import { getPublicEvents, PublicEvent } from "../api/client"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Loader2, Calendar, Trophy, Users, ArrowRight, PlayCircle, History, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClientLayout } from "@/components/layout/ClientLayout"
import { useUsername } from "@/utils/useUsername"

export default function Lobby() {
    const [events, setEvents] = useState<PublicEvent[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const username = useUsername()

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const data = await getPublicEvents()
                if (Array.isArray(data)) {
                    setEvents(data)
                } else {
                    console.error("API did not return an array:", data)
                    setEvents([])
                }
            } catch (error) {
                console.error("Failed to fetch events", error)
            } finally {
                setLoading(false)
            }
        }
        fetchEvents()
    }, [])

    const [activeCategory, setActiveCategory] = useState('all')

    const isEventsArray = Array.isArray(events)

    // Filter Logic matching UserDashboard
    const activeEvents = isEventsArray ? events.filter(e => {
        if (activeCategory === 'all') return e.status !== 'ended'
        if (activeCategory === 'active') return e.status === 'active'
        if (activeCategory === 'upcoming') return e.status === 'paused'
        return false
    }) : []

    // Only show past events if category is finished
    const showPastEvents = activeCategory === 'finished'
    const pastEvents = isEventsArray && showPastEvents ? events.filter(e => e.status === 'ended') : []

    const handleJoin = (eventId: number) => {
        let url = `/event/${eventId}`
        if (username) {
            url += `?username=${username}`
        }
        navigate(url)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">Turnuvalar Yükleniyor...</p>
            </div>
        )
    }

    return (
        <ClientLayout username={username} activeCategory={activeCategory} onCategoryChange={setActiveCategory}>
            <main className="max-w-7xl mx-auto px-4 py-12 space-y-12">

                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter">
                        Turnuva <span className="text-primary">Merkezi</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Aktif turnuvalara katılın, puan toplayın ve liderlik tablosunda yerinizi alın.
                    </p>
                </div>

                {/* Active Events Section - Hide if finished */}
                {activeCategory !== 'finished' && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 mb-6">
                            <PlayCircle className="h-6 w-6 text-green-500" />
                            <h2 className="text-2xl font-bold uppercase tracking-wider text-green-500">
                                {activeCategory === 'upcoming' ? 'Yakında Başlayacaklar' : 'Aktif Turnuvalar'}
                            </h2>
                        </div>

                        {activeEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {activeEvents.map(event => (
                                    <EventCard key={event.id} event={event} onAction={() => handleJoin(event.id)} actionLabel="KATIL" />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-secondary/20 border border-white/5 rounded-2xl p-8 text-center">
                                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-bold text-muted-foreground">Şu an aktif turnuva bulunmuyor.</h3>
                                <p className="text-sm text-muted-foreground/60 mt-2">Lütfen daha sonra tekrar kontrol edin.</p>
                            </div>
                        )}
                    </section>
                )}

                {/* Past Events Section */}
                {showPastEvents && pastEvents.length > 0 && (
                    <section className="space-y-6 border-t border-white/10 pt-12">
                        <div className="flex items-center gap-2 mb-6">
                            <History className="h-6 w-6 text-muted-foreground" />
                            <h2 className="text-2xl font-bold uppercase tracking-wider text-muted-foreground">Tamamlananlar</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 hover:opacity-100 transition-opacity">
                            {pastEvents.map(event => (
                                <EventCard key={event.id} event={event} onAction={() => handleJoin(event.id)} actionLabel="İNCELE" variant="secondary" />
                            ))}
                        </div>
                    </section>
                )}

            </main>
        </ClientLayout>
    )
}

function EventCard({ event, onAction, actionLabel, variant = "primary" }: { event: PublicEvent, onAction: () => void, actionLabel: string, variant?: "primary" | "secondary" }) {
    const isPrimary = variant === "primary"

    return (
        <Card className={`group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] border-white/10 bg-card/40 hover:bg-card/60 backdrop-blur-sm flex flex-col h-full`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Status Badge */}
            <div className="absolute top-4 right-4 z-10">
                <Badge className={`${event.status === 'active' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : 'bg-gray-500/20 text-gray-500'} uppercase font-bold tracking-wider border-none`}>
                    {event.status === 'active' ? '● CANLI' : (event.status === 'paused' ? 'DURAKLATILDI' : 'TAMAMLANDI')}
                </Badge>
            </div>

            <CardHeader className="space-y-2">
                <CardTitle className="text-2xl font-bold leading-tight group-hover:text-primary transition-colors">
                    {event.name}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                    {event.description || "Bu turnuva için açıklama girilmemiş."}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 flex-grow">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary/70" />
                    <span>
                        {format(new Date(event.start_date), "d MMM", { locale: tr })} - {format(new Date(event.end_date), "d MMM yyyy", { locale: tr })}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 text-primary/70" />
                    <span>
                        <strong className="text-white">{event.participant_count}</strong> Katılımcı
                    </span>
                </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-white/5">
                <Button
                    onClick={onAction}
                    className={`w-full font-bold h-10 group-hover:translate-x-1 transition-transform ${isPrimary ? 'bg-primary hover:bg-primary/90' : 'bg-secondary/50 hover:bg-secondary'}`}
                >
                    {actionLabel} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    )
}
