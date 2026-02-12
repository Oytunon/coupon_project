import { Trophy, Users, BarChart3, Star, CircleDot } from "lucide-react"
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
            className="group overflow-hidden bg-black border-primary border-[3px] rounded-[24px] mb-6 cursor-pointer relative shadow-[0_0_30px_rgba(255,184,0,0.05)] transition-all duration-500 hover:shadow-[0_0_80px_rgba(255,184,0,0.3)] hover:border-primary hover:-translate-y-1 active:scale-[0.99] z-10"
        >
            <div className="flex flex-col lg:flex-row h-full min-h-[260px]">
                {/* Left: Banner Image */}
                <div className="relative w-full lg:w-[260px] h-[260px] overflow-hidden bg-black shrink-0 border-r-[2px] border-primary/40">
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

                {/* Center Content Area */}
                <CardContent className="p-0 flex-[1.5] flex flex-col items-center justify-center py-6">
                    {/* Centered Title */}
                    <div className="text-center mb-6">
                        <h3 className="text-4xl font-black text-white tracking-widest uppercase italic">
                            {name}
                        </h3>
                        <div className="h-[3px] w-12 bg-primary rounded-full mx-auto mt-1 shadow-[0_0_10px_#FFB800]"></div>
                    </div>

                    {/* Middle Info Boxes */}
                    <div className="flex items-center gap-4">
                        {/* Katılımcı Box */}
                        <div className="bg-zinc-900/40 border-[2px] border-primary/40 rounded-[20px] px-8 py-5 flex flex-col items-center justify-center min-w-[170px] shadow-[0_0_20px_rgba(255,184,0,0.1)]">
                            <div className="flex items-center gap-2 mb-2 text-primary">
                                <Users className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">KATILIMCI</span>
                            </div>
                            <span className="text-3xl font-black text-white tabular-nums">
                                {participantCount.toLocaleString('tr-TR')}
                            </span>
                        </div>

                        {/* Ödül Box */}
                        <div className="bg-zinc-900/40 border-[2px] border-primary/40 rounded-[20px] px-8 py-5 flex flex-col items-center justify-center min-w-[170px] shadow-[0_0_20px_rgba(255,184,0,0.15)]">
                            <div className="flex items-center gap-2 mb-2 text-primary">
                                <Trophy className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">ÖDÜL</span>
                            </div>
                            <span className="text-2xl font-black text-primary italic">
                                10.000.000₺
                            </span>
                        </div>
                    </div>
                </CardContent>

                {/* Right Side Area */}
                <div className="flex-1 lg:max-w-[400px] flex items-center justify-center border-l border-white/10 px-8">
                    <div className="flex flex-col items-center gap-6 w-full py-4">
                        {/* Stats Row */}
                        <div className="flex items-center justify-center gap-12 w-full">
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-black tracking-widest uppercase mb-1">
                                    <CircleDot className="h-3 w-3" /> PUANIM
                                </div>
                                <div className="text-4xl font-black text-white tabular-nums leading-none">
                                    {userPoints.toLocaleString('tr-TR')}
                                </div>
                            </div>

                            {/* Small vertical line between stats */}
                            <div className="w-px h-8 bg-white/10"></div>

                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 text-[10px] text-primary font-black tracking-widest uppercase mb-1">
                                    <Trophy className="h-3 w-3" /> SIRALAMA
                                </div>
                                <div className="text-4xl font-black text-primary italic leading-none">
                                    #{userRank}
                                </div>
                            </div>
                        </div>

                        {/* Horizontal Divider Line */}
                        <div className="w-full h-[2px] bg-primary/20 rounded-full"></div>

                        {/* Countdown Grid */}
                        <div className="flex items-center justify-center gap-3">
                            {[
                                { value: '15', label: 'GÜN' },
                                { value: '06', label: 'SAAT' },
                                { value: '11', label: 'DAK' }
                            ].map((time, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="flex flex-col items-center gap-1.5">
                                        <div className="w-14 h-14 border-[2px] border-primary/60 rounded-xl flex items-center justify-center text-2xl font-black text-white tabular-nums bg-zinc-900/30">
                                            {time.value}
                                        </div>
                                        <span className="text-[10px] font-black text-zinc-500 tracking-widest">{time.label}</span>
                                    </div>
                                    {idx < 2 && (
                                        <div className="text-primary/60 font-black text-xl mb-4">:</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Shine Overlay */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:animate-[shine_1.5s_ease-in-out_infinite]"></div>
            </div>
        </Card>
    )
}
