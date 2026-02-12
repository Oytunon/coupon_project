import { Trophy, Users, BarChart3, Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface TournamentCardProps {
    id: number
    name: string
    description: string
    image_url: string | null
    status: string
    startDate: string
    endDate: string
    participantCount: number
    isJoined: boolean
    userPoints: number
    userRank: number
    onJoin?: (id: number) => void
    onDetails?: (id: number) => void
}

export function TournamentCard({
    id, name, image_url, participantCount,
    userPoints, userRank, onJoin, onDetails
}: TournamentCardProps) {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"

    return (
        <Card
            onClick={() => onDetails?.(id)}
            className="group overflow-hidden bg-black/40 border-primary/20 backdrop-blur-2xl hover:border-primary/60 transition-all duration-500 mb-6 border-2 relative cursor-pointer"
        >
            <div className="flex flex-col lg:flex-row h-full">
                {/* Left: Banner Image */}
                <div className="relative w-full lg:w-[280px] h-[220px] lg:h-auto overflow-hidden bg-black shrink-0">
                    {image_url ? (
                        <img
                            src={`${baseUrl}${image_url}`}
                            alt={name}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
                            <Trophy className="h-16 w-16 text-primary/10" />
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <CardContent className="p-0 flex-1 flex flex-col items-center justify-center relative py-6">
                    {/* Centered Title */}
                    <div className="text-center mb-8">
                        <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors tracking-tighter uppercase italic">
                            {name}
                        </h3>
                        <div className="h-1 w-24 bg-gradient-to-r from-transparent via-primary/50 to-transparent mx-auto mt-2"></div>
                    </div>

                    {/* Middle Info Boxes */}
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl px-8 py-4 flex flex-col items-center justify-center min-w-[150px] shadow-lg">
                            <span className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Users className="h-3 w-3" /> KATILIMCI
                            </span>
                            <span className="text-3xl font-black text-white tabular-nums">
                                {participantCount.toLocaleString('tr-TR')}
                            </span>
                        </div>
                        <div className="border border-primary/50 rounded-2xl px-8 py-4 flex flex-col items-center justify-center min-w-[150px] shadow-[0_0_20px_rgba(255,188,0,0.1)]">
                            <span className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Trophy className="h-3 w-3" /> ÖDÜL
                            </span>
                            <span className="text-2xl font-black text-primary italic">
                                10.000.000₺
                            </span>
                        </div>
                    </div>
                </CardContent>

                {/* Right: Stats and Countdown */}
                <div className="lg:w-[350px] p-8 shrink-0 flex items-center gap-8 justify-between border-t lg:border-t-0 lg:border-l border-white/5">
                    {/* User Stats */}
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] text-white/40 font-black tracking-widest uppercase">
                                <BarChart3 className="h-3 w-3" /> PUANIM
                            </div>
                            <div className="text-3xl font-black text-white tabular-nums">
                                {userPoints.toLocaleString('tr-TR')}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] text-white/40 font-black tracking-widest uppercase">
                                <Trophy className="h-3 w-3" /> SIRALAMA
                            </div>
                            <div className="text-3xl font-black text-primary italic">
                                #{userRank}
                            </div>
                        </div>
                    </div>

                    {/* Simple Box Countdown */}
                    <div className="flex items-center gap-2">
                        {[
                            { value: '15', label: 'GÜN' },
                            { value: '06', label: 'SAAT' },
                            { value: '57', label: 'DAK' }
                        ].map((time, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1">
                                <div className="w-12 h-12 border border-primary/40 rounded-lg flex items-center justify-center text-xl font-black text-white tabular-nums">
                                    {time.value}
                                </div>
                                <span className="text-[8px] font-black text-white/40 tracking-tighter">{time.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    )
}
