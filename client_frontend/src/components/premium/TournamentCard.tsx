import { Trophy, Users, Award, Target } from "lucide-react"
import { Card } from "@/components/ui/card"
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
    userPoints, userRank, onJoin, onDetails, status, endDate, isJoined
}: TournamentCardProps) {
    const baseUrl = import.meta.env.VITE_API_URL || ""

    // Calculate time remaining
    const calculateTimeRemaining = () => {
        const end = new Date(endDate).getTime();
        const now = new Date().getTime();
        const distance = end - now;

        if (distance < 0) return { days: 0, hours: 0, minutes: 0 };

        return {
            days: Math.floor(distance / (1000 * 60 * 60 * 24)),
            hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        };
    };

    const timeRemaining = calculateTimeRemaining();

    const renderDigits = (value: number) => {
        return String(value).padStart(2, '0').split('').map((digit, i) => (
            <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center bg-black rounded transition-transform duration-150 ease-out">
                    <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums">{digit}</span>
                </div>
                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
            </div>
        ));
    };

    return (
        <div
            onClick={() => status === 'active' ? onJoin?.(id) : onDetails?.(id)}
            className="cursor-pointer group h-full"
        >
            <div className="flex items-stretch gap-0 p-1.5 bg-black border-2 border-[#FFB800] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(255,184,0,0.1)] hover:shadow-[0_0_30px_rgba(255,184,0,0.3)] transition-all h-full relative">

                {/* Status Badge (Overlay) */}
                <div className="absolute top-0 right-0 z-30 overflow-hidden pointer-events-none">
                    <div className="relative">
                        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                            <div className={`absolute top-3 -right-6 w-24 transform rotate-45 shadow-lg flex justify-center py-0.5 ${status === 'active' ? 'bg-[#FFB800]' : 'bg-zinc-600'}`}>
                                <span className={`${status === 'active' ? 'text-black' : 'text-white'} text-[7px] font-bold tracking-wide uppercase`}>
                                    {status === 'active' ? 'AKTİF' : 'BİTTİ'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Left: Image */}
                <div className="flex-shrink-0 w-40 h-44 rounded-l border-r-2 border-[#FFB800]/50 overflow-hidden relative">
                    {image_url ? (
                        <img
                            src={`${baseUrl}${image_url}`}
                            alt={name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 border-r border-[#FFB800]/20">
                            <Trophy className="w-10 h-10 text-[#FFB800]/20" />
                        </div>
                    )}
                </div>

                {/* Right: Content */}
                <div className="flex-1 flex flex-col gap-1.5 pl-2 pr-1 py-1 min-w-0">
                    <h3 className="text-xs font-black text-white tracking-tight leading-tight line-clamp-2 uppercase min-h-[2.5em]">
                        {name}
                    </h3>

                    {/* Stats Row 1 */}
                    <div className="flex items-center gap-1.5">
                        <div className="flex-1 bg-[#1a1a1a] border-2 border-[#FFB800] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Users className="w-3 h-3 text-[#FFB800]" />
                                <span className="text-[8px] text-[#FFB800] font-bold uppercase tracking-wide">Katılımcı</span>
                            </div>
                            <div className="text-sm font-black text-white text-center leading-none">
                                {participantCount.toLocaleString('tr-TR')}
                            </div>
                        </div>
                        <div className="flex-1 bg-gradient-to-br from-[#FFB800]/20 to-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Award className="w-3 h-3 text-[#FFB800]" />
                                <span className="text-[8px] text-[#FFB800] font-bold uppercase tracking-wide">Ödül</span>
                            </div>
                            <div className="text-[11px] font-black text-[#FFB800] text-center leading-none whitespace-nowrap">
                                10.000.000₺
                            </div>
                        </div>
                    </div>

                    {/* Stats Row 2 */}
                    <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1.5 border border-[#FFB800]/30">
                        <div className="flex-1 text-center border-r border-[#FFB800]/30 pr-1">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <Target className="w-3 h-3 text-gray-400" />
                                <span className="text-[8px] text-gray-400 font-bold uppercase">Puanım</span>
                            </div>
                            <div className="text-sm font-black text-white leading-none">
                                {userPoints.toLocaleString('tr-TR')}
                            </div>
                        </div>
                        <div className="flex-1 text-center pl-1">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <Trophy className="w-3 h-3 text-[#FFB800]" />
                                <span className="text-[8px] text-[#FFB800] font-bold uppercase">Sıra</span>
                            </div>
                            <div className="text-sm font-black text-[#FFB800] leading-none">
                                #{userRank}
                            </div>
                        </div>
                    </div>

                    {/* Countdown */}
                    <div className="mt-auto pt-1">
                        {status === 'active' ? (
                            <div className="flex justify-center gap-1 lg:gap-3">
                                {/* Days */}
                                <div className="text-center">
                                    <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                        <div className="flex gap-0.5 lg:gap-1">
                                            {renderDigits(timeRemaining.days)}
                                        </div>
                                    </div>
                                    <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">GÜN</div>
                                </div>

                                <div className="text-xl lg:text-2xl font-bold text-[#FFB800]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>

                                {/* Hours */}
                                <div className="text-center">
                                    <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                        <div className="flex gap-0.5 lg:gap-1">
                                            {renderDigits(timeRemaining.hours)}
                                        </div>
                                    </div>
                                    <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">SAAT</div>
                                </div>

                                <div className="text-xl lg:text-2xl font-bold text-[#FFB800]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>

                                {/* Minutes */}
                                <div className="text-center">
                                    <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                        <div className="flex gap-0.5 lg:gap-1">
                                            {renderDigits(timeRemaining.minutes)}
                                        </div>
                                    </div>
                                    <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">DAK</div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-neutral-900/80 border border-white/10 rounded-lg py-2 px-4 text-center">
                                <span className="text-neutral-400 text-xs font-bold uppercase tracking-widest">
                                    Turnuva Sona Erdi
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
