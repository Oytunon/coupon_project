import { useState, useEffect } from "react"
import { Trophy, Users, Award, Target } from "lucide-react"
import { parseEventDate } from "@/utils/dateUtils"

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
    totalPrize?: number
    onJoin?: (id: number) => void
    onDetails?: (id: number) => void
}

export function TournamentCard({
    id, name, image_url, participantCount,
    userPoints, userRank, onJoin, onDetails, status, startDate, endDate, isJoined, totalPrize
}: TournamentCardProps) {
    const baseUrl = ""
    const [mounted, setMounted] = useState(false)

    const isUpcoming = new Date() < parseEventDate(startDate)
    const isExpired = new Date() > parseEventDate(endDate)

    // Calculate time remaining
    const calculateTimeRemaining = () => {
        const end = isUpcoming ? parseEventDate(startDate).getTime() : parseEventDate(endDate).getTime();
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
                        <span className={`font-oswald font-bold text-[#D9B648] tabular-nums ${isDesktop ? 'text-3xl' : 'text-xl'}`}>{digit}</span>
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
                <div className="relative rounded-xl overflow-hidden bg-black border-2 border-[#D9B648] shadow-xl">

                    <div className="flex items-stretch gap-0">
                        {/* Image */}
                        <div className="flex-shrink-0 w-32 border-r-2 border-[#D9B648] overflow-hidden">
                            {image_url ? (
                                <img src={`${baseUrl}${image_url}`} alt={name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                    <Trophy className="w-10 h-10 text-[#D9B648]/20" />
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col gap-1 p-2 min-w-0">
                            <h3 className="font-oswald text-base font-black text-[#F7EBA5] tracking-tight leading-tight line-clamp-2 uppercase">
                                {name}
                            </h3>

                            {/* Stats */}
                            <div className="flex items-stretch gap-1.5">
                                <div className="flex-1 bg-[#1a1a1a] border-2 border-[#D9B648] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                                    <div className="flex items-center justify-center gap-1 mb-0.5">
                                        <Users className="w-3.5 h-3.5 text-[#D9B648]" />
                                        <span className="text-[9px] text-[#D9B648] font-bold uppercase tracking-wide">Katılımcı</span>
                                    </div>
                                    <div className="font-oswald text-lg font-black text-[#F7EBA5] text-center leading-none">
                                        {participantCount.toLocaleString('tr-TR')}
                                    </div>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-[#D9B648]/20 to-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                                    <div className="flex items-center justify-center gap-1 mb-0.5">
                                        <Award className="w-3.5 h-3.5 text-[#D9B648]" />
                                        <span className="text-[9px] text-[#D9B648] font-bold uppercase tracking-wide">Ödül</span>
                                    </div>
                                    <div className="font-oswald text-base font-black text-[#D9B648] text-center leading-none whitespace-nowrap">
                                        {totalPrize ? totalPrize.toLocaleString('tr-TR') : '0'}₺
                                    </div>
                                </div>
                            </div>

                            {/* User Stats */}
                            {isJoined && (
                                <div className="flex items-center gap-2 bg-black/40 rounded-lg px-2 py-1.5 border border-[#D9B648]/30">
                                    <div className="flex-1 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                            <Target className="w-3 h-3 text-gray-400" />
                                            <span className="text-[8px] text-gray-400 font-bold uppercase">Puanım</span>
                                        </div>
                                        <div className="font-oswald text-base font-black text-[#F7EBA5] leading-none">
                                            {userPoints.toLocaleString('tr-TR')}
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-[#D9B648]/30"></div>
                                    <div className="flex-1 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                            <Trophy className="w-3 h-3 text-[#D9B648]" />
                                            <span className="text-[8px] text-[#D9B648] font-bold uppercase">Sıra</span>
                                        </div>
                                        <div className="font-oswald text-base font-black text-[#D9B648] leading-none">
                                            #{userRank}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Join Button (Mobile) */}
                            {status === 'active' && !isJoined && !isUpcoming && !isExpired && (
                                <div className="px-1 mt-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onJoin?.(id);
                                        }}
                                        className="w-full py-2 bg-[#D9B648] hover:bg-[#F7EBA5] text-black font-black font-oswald text-sm rounded-lg shadow-[0_0_15px_rgba(255,184,0,0.5)] transition-all active:scale-95 animate-pulse uppercase"
                                    >
                                        HEMEN KATIL
                                    </button>
                                </div>
                            )}

                            {/* Countdown */}
                            <div className="mt-auto">
                                {status === 'active' && !isExpired ? (
                                    isUpcoming ? (
                                        <div className="mb-1 text-center">
                                            <span className="text-[#D9B648] text-[10px] font-bold uppercase tracking-widest animate-pulse">BAŞLIYOR</span>
                                        </div>
                                    ) : null
                                ) : null}
                                {status === 'active' && !isExpired ? (
                                    <div className="flex justify-center items-end gap-1.5">
                                        {/* Days */}
                                        <div className="text-center">
                                            <div className="bg-black border-2 border-[#D9B648] rounded-lg px-1.5 py-1 shadow-lg shadow-[#D9B648]/20">
                                                <div className="flex gap-0.5">
                                                    {renderDigits(timeRemaining.days, false, 0)}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">GÜN</div>
                                        </div>
                                        <div className="font-oswald text-2xl font-bold text-[#D9B648]/70 pb-5 animate-pulse">:</div>
                                        {/* Hours */}
                                        <div className="text-center">
                                            <div className="bg-black border-2 border-[#D9B648] rounded-lg px-1.5 py-1 shadow-lg shadow-[#D9B648]/20">
                                                <div className="flex gap-0.5">
                                                    {renderDigits(timeRemaining.hours, false, 1)}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">SAAT</div>
                                        </div>
                                        <div className="font-oswald text-2xl font-bold text-[#D9B648]/70 pb-5 animate-pulse">:</div>
                                        {/* Minutes */}
                                        <div className="text-center">
                                            <div className="bg-black border-2 border-[#D9B648] rounded-lg px-1.5 py-1 shadow-lg shadow-[#D9B648]/20">
                                                <div className="flex gap-0.5">
                                                    {renderDigits(timeRemaining.minutes, false, 2)}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">DAK</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-neutral-900/80 border border-white/10 rounded-lg py-2 px-4 text-center">
                                        <span className="text-neutral-400 text-xs font-bold uppercase tracking-widest">Turnuva Sona Erdi</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DESKTOP VIEW (hidden lg:block) - Based on User HTML */}
            <div className="hidden lg:block">
                <div className="relative rounded-xl overflow-hidden bg-black border-2 border-[#D9B648] shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,0,0.4)] transition-transform duration-300 hover:scale-[1.01]">

                    {/* Status Badge */}
                    <div className="absolute top-0 right-0 z-30 overflow-hidden pointer-events-none">
                        <div className="relative">
                            <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden">
                                <div className={`absolute top-6 -right-6 w-32 transform rotate-45 shadow-lg flex justify-center py-1 ${status === 'active' ? 'bg-gradient-to-r from-[#D9B648] to-[#F7EBA5]' : 'bg-gradient-to-r from-gray-600 to-gray-500 border-t border-b border-gray-400/30'}`}>
                                    <div className="flex items-center justify-center gap-1">
                                        {status === 'active' && <div className="w-1 h-1 bg-black rounded-full animate-pulse"></div>}
                                        <span className={`font-oswald ${status === 'active' && !isExpired ? 'text-black' : 'text-[#F7EBA5]'} text-[9px] font-bold tracking-wider uppercase`}>
                                            {status === 'active' ? (isExpired ? 'SONUÇLANMIŞ' : isUpcoming ? 'YAKINDA' : 'AKTİF') : 'SONUÇLANMIŞ'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="flex flex-row items-stretch justify-between">

                            {/* Left Section: Image and Basic Info */}
                            <div className="flex flex-row items-stretch gap-0 flex-1 relative z-10 w-full">
                                {/* Image */}
                                <div className="w-[240px] shrink-0 border-r-2 border-[#D9B648]">
                                    {image_url ? (
                                        <img src={`${baseUrl}${image_url}`} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                            <Trophy className="w-12 h-12 text-[#D9B648]/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Middle: Title and Stats Boxes */}
                                <div className="flex flex-col flex-1 px-4 py-3 w-full justify-center">
                                    <div className="text-center mb-2">
                                        <h3 className="font-oswald text-4xl font-black text-[#F7EBA5] tracking-tight leading-tight mb-2 px-2 uppercase">
                                            {name}
                                        </h3>
                                        <div className="h-0.5 w-12 mx-auto bg-gradient-to-r from-transparent via-[#D9B648] to-transparent rounded-full"></div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center gap-3">
                                        {/* Participants Box */}
                                        {/* Participants Box (Only show if NOT upcoming) */}
                                        {!isUpcoming && (
                                            <div className="group relative bg-[#1a1a1a] border-2 border-[#D9B648] rounded-2xl p-6 hover:border-[#F7EBA5] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#1a1a1a]/20 hover:shadow-xl hover:shadow-[#D9B648]/40 flex-1 min-w-[180px] max-w-[220px]">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                                <div className="relative flex flex-col items-center justify-center gap-2">
                                                    <div className="flex items-center justify-center gap-2 mb-1">
                                                        <Users className="w-6 h-6 text-[#D9B648]" />
                                                        <span className="text-sm text-[#D9B648] font-bold uppercase tracking-widest">Katılımcı</span>
                                                    </div>
                                                    <div className="text-center font-oswald text-4xl font-black text-[#F7EBA5] tracking-tight">
                                                        {participantCount.toLocaleString('tr-TR')}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Prize Box */}
                                        <div className="group relative bg-gradient-to-br from-[#D9B648]/20 via-[#F7EBA5]/10 to-black border-2 border-[#D9B648] rounded-2xl p-6 hover:border-[#F7EBA5] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#D9B648]/20 hover:shadow-[#D9B648]/40 hover:shadow-xl flex-1 min-w-[180px] max-w-[220px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-[#D9B648]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                            <div className="relative flex flex-col items-center justify-center gap-2">
                                                <div className="flex items-center justify-center gap-2 mb-1">
                                                    <Award className="w-6 h-6 text-[#D9B648]" />
                                                    <span className="text-sm text-[#D9B648] font-bold uppercase tracking-widest">Ödül</span>
                                                </div>
                                                <div className="text-center font-oswald text-3xl font-black text-[#D9B648] tracking-tight">
                                                    {totalPrize ? totalPrize.toLocaleString('tr-TR') : '0'}₺
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Section: User Status and Countdown */}
                            <div className="flex flex-col gap-2 relative z-10 items-end pr-4 py-3 w-auto justify-center">
                                {isJoined ? (
                                    <div className="flex items-center gap-3 justify-end mb-2">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                                                <Target className="w-3 h-3" />
                                                <span className="text-[10px] uppercase tracking-wide">Puanım</span>
                                            </div>
                                            <div className="font-oswald text-2xl font-bold text-[#F7EBA5]">
                                                {userPoints.toLocaleString('tr-TR')}
                                            </div>
                                        </div>
                                        <div className="w-px h-10 bg-[#D9B648]/30"></div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-[#D9B648] mb-0.5">
                                                <Trophy className="w-3 h-3" />
                                                <span className="text-[10px] uppercase tracking-wide">Sıralama</span>
                                            </div>
                                            <div className="font-oswald text-2xl font-bold text-[#D9B648]">
                                                #{userRank}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="w-full flex flex-col gap-2 items-center">
                                    {status === 'active' && !isJoined && !isUpcoming && !isExpired && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onJoin?.(id);
                                            }}
                                            className="mb-2 px-6 py-2 bg-[#D9B648] hover:bg-[#F7EBA5] text-black font-black font-oswald text-xl rounded-lg shadow-[0_0_15px_rgba(255,184,0,0.5)] hover:shadow-[0_0_25px_rgba(255,184,0,0.7)] transition-all transform hover:scale-105 active:scale-95 animate-pulse"
                                        >
                                            HEMEN KATIL
                                        </button>
                                    )}

                                    {status === 'active' && isUpcoming && (
                                        <div className="text-center">
                                            <span className="text-[#D9B648] text-xs font-bold uppercase tracking-widest animate-pulse">BAŞLIYOR</span>
                                        </div>
                                    )}
                                    {status === 'active' && !isExpired ? (
                                        <div className="flex justify-center gap-2">
                                            {/* Days */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 shadow-lg shadow-[#D9B648]/20">
                                                    <div className="flex gap-0.5">
                                                        {renderDigits(timeRemaining.days, true, 0)}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">GÜN</div>
                                            </div>
                                            <div className="font-oswald text-xl font-bold text-[#D9B648]/70 self-center pb-4 animate-pulse">:</div>
                                            {/* Hours */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 shadow-lg shadow-[#D9B648]/20">
                                                    <div className="flex gap-0.5">
                                                        {renderDigits(timeRemaining.hours, true, 1)}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">SAAT</div>
                                            </div>
                                            <div className="font-oswald text-xl font-bold text-[#D9B648]/70 self-center pb-4 animate-pulse">:</div>
                                            {/* Minutes */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 shadow-lg shadow-[#D9B648]/20">
                                                    <div className="flex gap-0.5">
                                                        {renderDigits(timeRemaining.minutes, true, 2)}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">DAK</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-neutral-900/80 border border-white/10 rounded-xl py-3 px-6 text-center">
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
