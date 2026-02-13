import { useState, useEffect } from "react"
import { Trophy, Users, Award, Target } from "lucide-react"

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
    userPoints, userRank, onJoin, onDetails, status, startDate, endDate, isJoined
}: TournamentCardProps) {
    const baseUrl = import.meta.env.VITE_API_URL || ""
    const [mounted, setMounted] = useState(false)

    const isUpcoming = new Date() < new Date(startDate)

    // Calculate time remaining
    const calculateTimeRemaining = () => {
        const end = isUpcoming ? new Date(startDate).getTime() : new Date(endDate).getTime();
        const now = new Date().getTime();
        const distance = end - now;

        if (distance < 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

        return {
            days: Math.floor(distance / (1000 * 60 * 60 * 24)),
            hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((distance % (1000 * 60)) / 1000)
        };
    };

    const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining());

    // Real-time countdown update
    useEffect(() => {
        setMounted(true)
        const timer = setInterval(() => {
            setTimeRemaining(calculateTimeRemaining())
        }, 1000)
        return () => clearInterval(timer)
    }, [startDate, endDate])

    const renderDigits = (value: number, isDesktop = false, groupIndex = 0) => {
        return String(value).padStart(2, '0').split('').map((digit, i) => {
            const delay = (groupIndex * 2 + i) * 0.08;
            return (
                <div key={i} className={`relative overflow-hidden ${isDesktop ? 'w-[24px] h-[40px]' : 'w-[18px] h-[28px]'}`}>
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-black rounded"
                        style={{
                            animation: mounted ? `digitSlideIn 0.5s ${delay}s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
                        }}
                    >
                        <span className={`font-oswald font-bold text-[#FFB800] tabular-nums ${isDesktop ? 'text-3xl' : 'text-xl'}`}>{digit}</span>
                    </div>
                    <div className={`absolute top-1/2 left-0 right-0 bg-black/60 z-10 ${isDesktop ? 'h-[1px]' : 'h-[0.5px]'}`}></div>
                </div>
            );
        });
    };

    const handleClick = () => {
        onDetails?.(id);
    };

    return (
        <div onClick={handleClick} className="cursor-pointer font-roboto w-full">
            {/* Slide-in animation keyframes */}
            <style>{`
                @keyframes digitSlideIn {
                    0% {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    100% {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>

            {/* MOBILE VIEW (lg:hidden) */}
            <div className="lg:hidden">
                <div className="relative rounded-lg overflow-hidden bg-black border-2 border-[#FFB800] shadow-xl">
                    {/* Status Badge */}
                    <div className="absolute top-0 right-0 z-30 overflow-hidden pointer-events-none">
                        <div className="relative">
                            <div className="absolute top-0 right-0 w-16 overflow-hidden">
                                <div className={`absolute top-3 -right-4 w-24 transform rotate-45 shadow-lg flex justify-center py-0.5 ${status === 'active' ? 'bg-gradient-to-r from-[#FFB800] to-[#FFA500]' : 'bg-zinc-600'}`}>
                                    <div className="flex items-center justify-center gap-0.5">
                                        {status === 'active' && <div className="w-1 h-1 bg-black rounded-full animate-pulse"></div>}
                                        <span className={`font-oswald ${status === 'active' ? 'text-black' : 'text-white'} text-[7px] font-bold tracking-wide uppercase`}>
                                            {status === 'active' ? (isUpcoming ? 'YAKINDA' : 'AKTİF') : 'BİTTİ'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-stretch gap-0 p-1.5">
                        {/* Image */}
                        <div className="flex-shrink-0 w-32 h-34 rounded-l border-r-2 border-[#FFB800]/50 overflow-hidden">
                            {image_url ? (
                                <img src={`${baseUrl}${image_url}`} alt={name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-900 border-r border-[#FFB800]/20">
                                    <Trophy className="w-10 h-10 text-[#FFB800]/20" />
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col gap-1.5 pl-2 pr-1 py-1 min-w-0">
                            <h3 className="font-oswald text-xs font-black text-white tracking-tight leading-tight line-clamp-2 uppercase">
                                {name}
                            </h3>

                            {/* Stats */}
                            <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-[#1a1a1a] border-2 border-[#FFB800] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <Users className="w-3 h-3 text-[#FFB800]" />
                                        <span className="text-[8px] text-[#FFB800] font-bold uppercase tracking-wide">Katılımcı</span>
                                    </div>
                                    <div className="font-oswald text-sm font-black text-white text-center leading-none">
                                        {participantCount.toLocaleString('tr-TR')}
                                    </div>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-[#FFB800]/20 to-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <Award className="w-3 h-3 text-[#FFB800]" />
                                        <span className="text-[8px] text-[#FFB800] font-bold uppercase tracking-wide">Ödül</span>
                                    </div>
                                    <div className="font-oswald text-[11px] font-black text-[#FFB800] text-center leading-none whitespace-nowrap">
                                        10.000.000₺
                                    </div>
                                </div>
                            </div>

                            {/* User Stats */}
                            {isJoined && (
                                <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1.5 border border-[#FFB800]/30">
                                    <div className="flex-1 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Target className="w-3 h-3 text-gray-400" />
                                            <span className="text-[8px] text-gray-400 font-bold uppercase">Puanım</span>
                                        </div>
                                        <div className="font-oswald text-sm font-black text-white leading-none">
                                            {userPoints.toLocaleString('tr-TR')}
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-[#FFB800]/30"></div>
                                    <div className="flex-1 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Trophy className="w-3 h-3 text-[#FFB800]" />
                                            <span className="text-[8px] text-[#FFB800] font-bold uppercase">Sıra</span>
                                        </div>
                                        <div className="font-oswald text-sm font-black text-[#FFB800] leading-none">
                                            #{userRank}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Countdown */}
                            <div className="mt-auto">
                                {status === 'active' ? (
                                    isUpcoming ? (
                                        <div className="mb-1 text-center">
                                            <span className="text-[#FFB800] text-[10px] font-bold uppercase tracking-widest animate-pulse">BAŞLIYOR</span>
                                        </div>
                                    ) : null
                                ) : null}
                                {status === 'active' ? (
                                    <div className="flex justify-center gap-1">
                                        {/* Days */}
                                        <div className="text-center">
                                            <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 shadow-lg shadow-[#FFB800]/20">
                                                <div className="flex gap-0.5">
                                                    {renderDigits(timeRemaining.days, false, 0)}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-white mt-1 font-bold uppercase tracking-wide">GÜN</div>
                                        </div>
                                        <div className="font-oswald text-xl font-bold text-[#FFB800]/70 self-center pb-4 animate-pulse">:</div>
                                        {/* Hours */}
                                        <div className="text-center">
                                            <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 shadow-lg shadow-[#FFB800]/20">
                                                <div className="flex gap-0.5">
                                                    {renderDigits(timeRemaining.hours, false, 1)}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-white mt-1 font-bold uppercase tracking-wide">SAAT</div>
                                        </div>
                                        <div className="font-oswald text-xl font-bold text-[#FFB800]/70 self-center pb-4 animate-pulse">:</div>
                                        {/* Minutes */}
                                        <div className="text-center">
                                            <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 shadow-lg shadow-[#FFB800]/20">
                                                <div className="flex gap-0.5">
                                                    {renderDigits(timeRemaining.minutes, false, 2)}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-white mt-1 font-bold uppercase tracking-wide">DAK</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-neutral-900/80 border border-white/10 rounded-lg py-2 px-4 text-center">
                                        <span className="text-neutral-400 text-xs font-bold uppercase tracking-widest">Turnuva Bitti</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DESKTOP VIEW (hidden lg:block) - Based on User HTML */}
            <div className="hidden lg:block">
                <div className="relative rounded-xl overflow-hidden bg-black border-2 border-[#FFB800] shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,0,0.4)] transition-transform duration-300 hover:scale-[1.01]">

                    {/* Status Badge */}
                    <div className="absolute top-0 right-0 z-30 overflow-hidden pointer-events-none">
                        <div className="relative">
                            <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden">
                                <div className={`absolute top-8 -right-8 w-40 transform rotate-45 shadow-lg flex justify-center py-2 ${status === 'active' ? 'bg-gradient-to-r from-[#FFB800] to-[#FFA500]' : 'bg-gradient-to-r from-gray-600 to-gray-500 border-t border-b border-gray-400/30'}`}>
                                    <div className="flex items-center justify-center gap-1.5">
                                        {status === 'active' && <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse"></div>}
                                        <span className={`font-oswald ${status === 'active' ? 'text-black' : 'text-white'} text-xs font-bold tracking-wider uppercase`}>
                                            {status === 'active' ? (isUpcoming ? 'YAKINDA' : 'AKTİF') : 'SONUÇLANMIŞ'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="flex flex-row items-center justify-between">

                            {/* Left Section: Image and Basic Info */}
                            <div className="flex flex-row items-center gap-0 flex-1 relative z-10 w-full">
                                {/* Image */}
                                <div className="w-[280px] h-full shrink-0 border-r-2 border-[#FFB800] min-h-[200px]">
                                    {image_url ? (
                                        <img src={`${baseUrl}${image_url}`} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                            <Trophy className="w-16 h-16 text-[#FFB800]/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Middle: Title and Stats Boxes */}
                                <div className="flex flex-col flex-1 px-6 py-6 w-full">
                                    <div className="text-center mb-4">
                                        <h3 className="font-oswald text-3xl font-black text-white tracking-tight leading-tight mb-2 px-2 uppercase">
                                            {name}
                                        </h3>
                                        <div className="h-0.5 w-16 mx-auto bg-gradient-to-r from-transparent via-[#FFB800] to-transparent rounded-full"></div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center gap-4">
                                        {/* Participants Box */}
                                        <div className="group relative bg-[#1a1a1a] border-2 border-[#FFB800] rounded-2xl p-8 hover:border-[#FFA500] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#1a1a1a]/20 hover:shadow-xl hover:shadow-[#FFB800]/40 flex-1 min-w-[130px] max-w-[180px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center justify-center gap-2 mb-2">
                                                    <Users className="w-6 h-6 text-[#FFB800]" />
                                                    <span className="text-xs text-[#FFB800] font-bold uppercase tracking-widest">Katılımcı</span>
                                                </div>
                                                <div className="text-center font-oswald text-3xl font-black text-white">
                                                    {participantCount.toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Prize Box */}
                                        <div className="group relative bg-gradient-to-br from-[#FFB800]/20 via-[#FFA500]/10 to-black border-2 border-[#FFB800] rounded-2xl p-8 hover:border-[#FFA500] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#FFB800]/20 hover:shadow-[#FFB800]/40 hover:shadow-xl flex-1 min-w-[130px] max-w-[180px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center justify-center gap-2 mb-2">
                                                    <Award className="w-6 h-6 text-[#FFB800]" />
                                                    <span className="text-xs text-[#FFB800] font-bold uppercase tracking-widest">Ödül</span>
                                                </div>
                                                <div className="text-center font-oswald text-xl font-black text-[#FFB800]">
                                                    10.000.000₺
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Section: User Status and Countdown */}
                            <div className="flex flex-col gap-4 relative z-10 items-end pr-6 py-6 w-auto min-w-[300px]">
                                {isJoined ? (
                                    <div className="flex items-center gap-4 justify-end mb-4">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                                                <Target className="w-4 h-4" />
                                                <span className="text-xs uppercase tracking-wide">Puanım</span>
                                            </div>
                                            <div className="font-oswald text-4xl font-bold text-white">
                                                {userPoints.toLocaleString('tr-TR')}
                                            </div>
                                        </div>
                                        <div className="w-px h-16 bg-[#FFB800]/30"></div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-2 text-[#FFB800] mb-1">
                                                <Trophy className="w-4 h-4" />
                                                <span className="text-xs uppercase tracking-wide">Sıralama</span>
                                            </div>
                                            <div className="font-oswald text-4xl font-bold text-[#FFB800]">
                                                #{userRank}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-4">
                                        {/* Placeholder spacing or promo text for non-joined users could go here if needed */}
                                    </div>
                                )}

                                <div className="w-full flex flex-col gap-4">
                                    {status === 'active' && isUpcoming && (
                                        <div className="text-center mb-[-10px]">
                                            <span className="text-[#FFB800] text-sm font-bold uppercase tracking-widest animate-pulse">BAŞLIYOR</span>
                                        </div>
                                    )}
                                    {status === 'active' ? (
                                        <div className="flex justify-center gap-3">
                                            {/* Days */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#FFB800] rounded-lg px-3 py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                    <div className="flex gap-1">
                                                        {renderDigits(timeRemaining.days, true, 0)}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-white mt-1.5 font-bold uppercase tracking-wide">GÜN</div>
                                            </div>
                                            <div className="font-oswald text-2xl font-bold text-[#FFB800]/70 self-center pb-5 animate-pulse">:</div>
                                            {/* Hours */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#FFB800] rounded-lg px-3 py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                    <div className="flex gap-1">
                                                        {renderDigits(timeRemaining.hours, true, 1)}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-white mt-1.5 font-bold uppercase tracking-wide">SAAT</div>
                                            </div>
                                            <div className="font-oswald text-2xl font-bold text-[#FFB800]/70 self-center pb-5 animate-pulse">:</div>
                                            {/* Minutes */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#FFB800] rounded-lg px-3 py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                    <div className="flex gap-1">
                                                        {renderDigits(timeRemaining.minutes, true, 2)}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-white mt-1.5 font-bold uppercase tracking-wide">DAK</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-neutral-900/80 border border-white/10 rounded-xl py-4 px-8 text-center">
                                            <span className="text-neutral-400 text-sm font-bold uppercase tracking-widest">Turnuva Sona Erdi</span>
                                        </div>
                                    )}


                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
