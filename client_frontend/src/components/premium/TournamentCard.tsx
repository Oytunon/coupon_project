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
            className="group overflow-hidden bg-black border-primary border-[2px] rounded-[20px] transition-all duration-500 mb-6 cursor-pointer relative"
        >
            <div className="flex flex-col lg:flex-row h-full">
                {/* Left: Banner Image */}
                <div className="relative w-full lg:w-[260px] lg:h-[260px] overflow-hidden bg-black shrink-0 border-r border-primary/40">
                    {image_url ? (
                        <img
                            src={`${baseUrl}${image_url}`}
                            alt={name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
                            <Trophy className="h-16 w-16 text-primary/10" />
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <CardContent className="p-0 flex-1 flex flex-col items-center justify-center py-6 min-h-[260px]">
                    {/* Centered Title */}
                    <div className="text-center mb-8">
                        <h3 className="text-4xl font-black text-white tracking-tighter uppercase">
                            {name}
                        </h3>
                        <div className="h-0.5 w-16 bg-primary/60 mx-auto mt-2 rounded-full"></div>
                    </div>

                    {/* Middle Info Boxes */}
                    <div className="flex items-center gap-6">
                        {/* Katılımcı Box */}
                        <div className="bg-zinc-950/80 border border-primary/50 rounded-[20px] px-10 py-5 flex flex-col items-center justify-center min-w-[160px] shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4 text-primary" />
                                <span className="text-[11px] text-primary font-black uppercase tracking-widest">KATILIMCI</span>
                            </div>
                            <span className="text-3xl font-black text-white tabular-nums">
                                {participantCount.toLocaleString('tr-TR')}
                            </span>
                        </div>

                        {/* Ödül Box */}
                        <div className="bg-zinc-950/80 border border-primary/50 rounded-[20px] px-10 py-5 flex flex-col items-center justify-center min-w-[160px] shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Trophy className="h-4 w-4 text-primary" />
                                <span className="text-[11px] text-primary font-black uppercase tracking-widest">ÖDÜL</span>
                            </div>
                            <span className="text-2xl font-black text-primary italic">
                                10.000.000₺
                            </span>
                        </div>
                    </div>
                </CardContent>

                {/* Right Area: Stats and Countdown Separated */}
                <div className="flex items-center bg-black/40 pr-10 border-l border-white/10">
                    {/* Stats Section */}
                    <div className="flex flex-col gap-6 px-10 border-r border-white/10 py-8 min-w-[200px]">
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 text-[10px] text-white/40 font-black tracking-widest uppercase mb-1">
                                <BarChart3 className="h-3 w-3" /> PUANIM
                            </div>
                            <div className="text-4xl font-black text-white tabular-nums leading-none">
                                {userPoints.toLocaleString('tr-TR')}
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 text-[10px] text-primary font-black tracking-widest uppercase mb-1">
                                <Trophy className="h-3 w-3" /> SIRALAMA
                            </div>
                            <div className="text-4xl font-black text-primary italic leading-none">
                                #{userRank}
                            </div>
                        </div>
                    </div>

                    {/* Countdown Section */}
                    <div className="flex items-center gap-3 pl-10">
                        {[
                            { value: '15', label: 'GÜN' },
                            { value: '06', label: 'SAAT' },
                            { value: '13', label: 'DAK' }
                        ].map((time, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-14 h-14 border border-primary/60 rounded-xl flex items-center justify-center text-2xl font-black text-white tabular-nums bg-black/60 shadow-[0_0_15px_rgba(255,184,0,0.1)]">
                                        {time.value}
                                    </div>
                                    <span className="text-[9px] font-black text-white/40 tracking-widest">{time.label}</span>
                                </div>
                                {idx < 2 && (
                                    <div className="text-primary/60 font-black text-xl mb-6">:</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    )
}
