import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseEventDate } from '@/utils/dateUtils'

interface Event {
    id: number
    name: string
    start_date: string
    image_url?: string | null
    participant_count?: number
    rules?: any
}

interface UpcomingEventsSliderProps {
    events: Event[]
    onDetails: (eventId: number) => void
}

export function UpcomingEventsSlider({ events, onDetails }: UpcomingEventsSliderProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })
    const [mounted, setMounted] = useState(false)
    const navigate = useNavigate()

    const currentEvent = events[currentIndex]

    // Auto-rotate
    useEffect(() => {
        if (events.length <= 1) return
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % events.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [events.length])

    // Countdown Logic
    useEffect(() => {
        if (!currentEvent) return

        const calculateTimeLeft = () => {
            const now = new Date().getTime()
            const start = parseEventDate(currentEvent.start_date).getTime()
            const distance = start - now

            if (distance < 0) {
                return { days: 0, hours: 0, minutes: 0 }
            }

            return {
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
            }
        }

        setTimeLeft(calculateTimeLeft())
        setMounted(true)
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft())
        }, 1000)

        return () => clearInterval(timer)
    }, [currentEvent])

    if (!currentEvent) return null

    // Format helpers
    const d = timeLeft.days.toString().padStart(2, '0')
    const h = timeLeft.hours.toString().padStart(2, '0')
    const m = timeLeft.minutes.toString().padStart(2, '0')

    // I'll accept an `onEventSelect` prop.

    // Helper to calculate total prize
    const calculateTotalPrize = (rules: any) => {
        if (!rules) return 0;

        let validRules = rules;
        if (typeof rules === 'string') {
            try {
                validRules = JSON.parse(rules);
            } catch (e) {
                console.error("Slider failed to parse rules:", e);
                return 0;
            }
        }

        if (!validRules.rewards || !Array.isArray(validRules.rewards)) {
            return 0;
        }

        return validRules.rewards.reduce((total: number, reward: any) => {
            return total + (Number(reward.amount) || 0);
        }, 0);
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-2 lg:px-4">
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
            <div className="relative overflow-hidden">
                <div className="transition-opacity duration-300 opacity-100">

                    {/* MOBILE VIEW */}
                    <div className="lg:hidden">
                        <div
                            onClick={() => onDetails(currentEvent.id)}
                            className="relative rounded-xl overflow-hidden cursor-pointer bg-black border-2 border-[#D9B648] shadow-xl"
                        >
                            <div className="flex items-stretch gap-0">
                                <div className="flex-shrink-0 w-28 border-r-2 border-[#D9B648] overflow-hidden">
                                    <img
                                        src={currentEvent.image_url || "/placeholder-tournament.jpg"}
                                        alt={currentEvent.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 flex flex-col gap-1.5 p-2 min-w-0">
                                    <h3 className="font-oswald text-sm font-black text-[#F7EBA5] tracking-tight leading-tight line-clamp-2 uppercase">
                                        {currentEvent.name}
                                    </h3>
                                    <div className="flex items-stretch gap-1.5">
                                        <div className="flex-1 bg-[#1a1a1a] border-2 border-[#D9B648] rounded-lg px-1.5 py-1.5 flex flex-col items-center justify-center">
                                            <div className="flex items-center justify-center gap-1 mb-0.5">
                                                <svg className="w-3 h-3 text-[#D9B648]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                                </svg>
                                                <span className="text-[8px] text-[#D9B648] font-bold uppercase tracking-wide">Katılımcı</span>
                                            </div>
                                            <div className="font-oswald text-base font-black text-[#F7EBA5] text-center leading-none">
                                                {currentEvent.participant_count || 0}
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-gradient-to-br from-[#D9B648]/20 to-black border-2 border-[#D9B648] rounded-lg px-1.5 py-1.5 flex flex-col items-center justify-center">
                                            <div className="flex items-center justify-center gap-1 mb-0.5">
                                                <svg className="w-3 h-3 text-[#D9B648]" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path>
                                                </svg>
                                                <span className="text-[8px] text-[#D9B648] font-bold uppercase tracking-wide">Ödül</span>
                                            </div>
                                            <div className="font-oswald text-sm font-black text-[#D9B648] text-center leading-none whitespace-nowrap">
                                                {calculateTotalPrize(currentEvent.rules).toLocaleString('tr-TR')}₺
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-auto">
                                        <div className="flex justify-center items-end gap-1.5">
                                            {/* Days */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#D9B648] rounded-lg px-1.5 py-1 shadow-lg shadow-[#D9B648]/20">
                                                    <div className="flex gap-0.5">
                                                        {d.split('').map((digit, i) => (
                                                            <div key={i} className="relative w-[18px] h-[28px] overflow-hidden">
                                                                <div
                                                                    className="absolute inset-0 flex items-center justify-center bg-black rounded"
                                                                    style={{
                                                                        animation: mounted ? `digitSlideIn 0.5s ${i * 0.08}s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
                                                                    }}
                                                                >
                                                                    <span className="text-xl font-bold text-[#D9B648] tabular-nums">{digit}</span>
                                                                </div>
                                                                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-black/60 z-10"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-[9px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">GÜN</div>
                                            </div>
                                            <div className="font-oswald text-2xl font-bold text-[#D9B648]/70 pb-5 animate-pulse">:</div>
                                            {/* Hours */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#D9B648] rounded-lg px-1.5 py-1 shadow-lg shadow-[#D9B648]/20">
                                                    <div className="flex gap-0.5">
                                                        {h.split('').map((digit, i) => (
                                                            <div key={i} className="relative w-[18px] h-[28px] overflow-hidden">
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                    <span className="text-xl font-bold text-[#D9B648] tabular-nums">{digit}</span>
                                                                </div>
                                                                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-black/60 z-10"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-[9px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">SAAT</div>
                                            </div>
                                            <div className="font-oswald text-2xl font-bold text-[#D9B648]/70 pb-5 animate-pulse">:</div>
                                            {/* Minutes */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#D9B648] rounded-lg px-1.5 py-1 shadow-lg shadow-[#D9B648]/20">
                                                    <div className="flex gap-0.5">
                                                        {m.split('').map((digit, i) => (
                                                            <div key={i} className="relative w-[18px] h-[28px] overflow-hidden">
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                    <span className="text-xl font-bold text-[#D9B648] tabular-nums">{digit}</span>
                                                                </div>
                                                                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-black/60 z-10"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-[9px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">DAK</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DESKTOP VIEW */}
                    <div className="hidden lg:block border-2 border-[#D9B648] rounded-xl lg:rounded-2xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
                        <div className="relative rounded-xl overflow-hidden cursor-pointer transition-transform duration-300 bg-black border-2 border-[#D9B648] shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,0,0.4)]">

                            <div className="relative">
                                <div className="flex flex-row items-stretch justify-between">
                                    <div className="flex flex-row items-stretch gap-0 flex-1 relative z-10 w-full">
                                        {/* Image */}
                                        <div className="w-[240px] shrink-0 border-r-2 border-[#D9B648]">
                                            <img
                                                src={currentEvent.image_url || "/placeholder-tournament.jpg"}
                                                alt={currentEvent.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Middle: Title and Stats Boxes */}
                                        <div className="flex flex-col flex-1 px-4 py-3 w-full justify-center">
                                            <div className="text-center mb-2">
                                                <h3 className="font-oswald text-4xl font-black text-[#F7EBA5] tracking-tight leading-tight mb-2 px-2 uppercase">
                                                    {currentEvent.name}
                                                </h3>
                                                <div className="h-0.5 w-12 mx-auto bg-gradient-to-r from-transparent via-[#D9B648] to-transparent rounded-full"></div>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-center gap-3">


                                                {/* Prize Box */}
                                                <div className="group relative bg-gradient-to-br from-[#D9B648]/20 via-[#F7EBA5]/10 to-black border-2 border-[#D9B648] rounded-2xl p-6 hover:border-[#F7EBA5] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#D9B648]/20 hover:shadow-[#D9B648]/40 hover:shadow-xl flex-1 min-w-[180px] max-w-[220px]">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-[#D9B648]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                                    <div className="relative flex flex-col items-center justify-center gap-2">
                                                        <div className="flex items-center justify-center gap-2 mb-1">
                                                            <svg className="w-6 h-6 text-[#D9B648]" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path>
                                                            </svg>
                                                            <span className="text-sm text-[#D9B648] font-bold uppercase tracking-widest">Ödül</span>
                                                        </div>
                                                        <div className="text-center font-oswald text-3xl font-black text-[#D9B648] tracking-tight">
                                                            {calculateTotalPrize(currentEvent.rules).toLocaleString('tr-TR')}₺
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Countdown and Button */}
                                    <div className="flex flex-col gap-2 relative z-10 items-end pr-4 py-3 w-auto justify-center">
                                        <div className="w-full flex flex-col gap-2">
                                            <div className="flex justify-center gap-2">
                                                {/* Days */}
                                                <div className="text-center">
                                                    <div className="bg-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 shadow-lg shadow-[#D9B648]/20">
                                                        <div className="flex gap-0.5">
                                                            {d.split('').map((digit, i) => (
                                                                <div key={i} className="relative w-[20px] h-[32px] overflow-hidden">
                                                                    <div
                                                                        className="absolute inset-0 flex items-center justify-center bg-black rounded"
                                                                        style={{
                                                                            animation: mounted ? `digitSlideIn 0.5s ${i * 0.08}s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
                                                                        }}
                                                                    >
                                                                        <span className="text-2xl font-bold text-[#D9B648] tabular-nums">{digit}</span>
                                                                    </div>
                                                                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/60 z-10"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">GÜN</div>
                                                </div>
                                                <div className="font-oswald text-xl font-bold text-[#D9B648]/70 self-center pb-4 animate-pulse">:</div>
                                                {/* Hours */}
                                                <div className="text-center">
                                                    <div className="bg-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 shadow-lg shadow-[#D9B648]/20">
                                                        <div className="flex gap-0.5">
                                                            {h.split('').map((digit, i) => (
                                                                <div key={i} className="relative w-[20px] h-[32px] overflow-hidden">
                                                                    <div
                                                                        className="absolute inset-0 flex items-center justify-center bg-black rounded"
                                                                        style={{
                                                                            animation: mounted ? `digitSlideIn 0.5s ${(2 + i) * 0.08}s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
                                                                        }}
                                                                    >
                                                                        <span className="text-2xl font-bold text-[#D9B648] tabular-nums">{digit}</span>
                                                                    </div>
                                                                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/60 z-10"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">SAAT</div>
                                                </div>
                                                <div className="font-oswald text-xl font-bold text-[#D9B648]/70 self-center pb-4 animate-pulse">:</div>
                                                {/* Minutes */}
                                                <div className="text-center">
                                                    <div className="bg-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 shadow-lg shadow-[#D9B648]/20">
                                                        <div className="flex gap-0.5">
                                                            {m.split('').map((digit, i) => (
                                                                <div key={i} className="relative w-[20px] h-[32px] overflow-hidden">
                                                                    <div
                                                                        className="absolute inset-0 flex items-center justify-center bg-black rounded"
                                                                        style={{
                                                                            animation: mounted ? `digitSlideIn 0.5s ${(4 + i) * 0.08}s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
                                                                        }}
                                                                    >
                                                                        <span className="text-2xl font-bold text-[#D9B648] tabular-nums">{digit}</span>
                                                                    </div>
                                                                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/60 z-10"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-[#F7EBA5] mt-1 font-bold uppercase tracking-wide">DAK</div>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDetails(currentEvent.id);
                                            }}
                                            className="px-6 py-2 bg-[#D9B648] hover:bg-[#F7EBA5] text-black rounded-lg font-bold text-sm shadow-lg hover:shadow-xl transition-all w-auto"
                                        >
                                            Detayları Gör
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pagination Dots */}
                {events.length > 1 && (
                    <div className="flex justify-center gap-2 mt-2 lg:mt-4">
                        {events.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex
                                    ? 'bg-[#D9B648] w-8'
                                    : 'bg-gray-600 hover:bg-gray-500 w-2'
                                    }`}
                                aria-label={`Go to slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
