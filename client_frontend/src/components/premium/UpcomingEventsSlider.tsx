import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Event {
    id: number
    name: string
    start_date: string
    image_url?: string | null
    participant_count?: number
    // We might not have prize in the event object yet, defaults to placeholder or passed prop if available
    // For now I'll hardcode or deduce. The user HTML shows '20.000.000₺'
}

interface UpcomingEventsSliderProps {
    events: Event[]
    onDetails: (eventId: number) => void
}

export function UpcomingEventsSlider({ events, onDetails }: UpcomingEventsSliderProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })
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
            const start = new Date(currentEvent.start_date).getTime()
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
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft())
        }, 60000) // Update every minute is enough for D/H/M display

        return () => clearInterval(timer)
    }, [currentEvent])

    if (!currentEvent) return null

    // Format helpers
    const d = timeLeft.days.toString().padStart(2, '0')
    const h = timeLeft.hours.toString().padStart(2, '0')
    const m = timeLeft.minutes.toString().padStart(2, '0')

    const goToDetails = () => {
        // Using search params method as used in UserDashboard
        const url = new URL(window.location.href);
        url.searchParams.set("eventId", currentEvent.id.toString());
        window.history.pushState({}, "", url);
        // Force re-render or event dispatch? 
        // Actually, simpler to pass an onDetails prop or use standard navigation if route based.
        // In UserDashboard we use setSearchParams. 
        // For now, I'll assume the parent passes a handler or I use this hack, 
        // BUT better to just let the parent handle it? 
        // The user code in UserDashboard uses `setSearchParams`.
        // I'll accept an `onEventSelect` prop.
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-2 lg:px-4">
            <div className="relative overflow-hidden">
                <div className="transition-opacity duration-300 opacity-100">

                    {/* MOBILE VIEW */}
                    <div className="lg:hidden">
                        <div
                            onClick={() => onDetails(currentEvent.id)}
                            className="relative rounded-lg overflow-hidden cursor-pointer bg-black border-2 border-[#FFB800] shadow-xl"
                        >
                            <div className="flex items-stretch gap-0 p-1.5">
                                <div className="flex-shrink-0 w-32 h-34 rounded-l border-r-2 border-[#FFB800]/50 overflow-hidden">
                                    <img
                                        src={currentEvent.image_url || "/placeholder-tournament.jpg"}
                                        alt={currentEvent.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 flex flex-col gap-1.5 pl-2 pr-1 py-1 min-w-0">
                                    <h3 className="text-xs font-black text-white tracking-tight leading-tight line-clamp-2">
                                        {currentEvent.name}
                                    </h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex-1 bg-[#1a1a1a] border-2 border-[#FFB800] rounded-lg px-2 py-1.5">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <svg className="w-3 h-3 text-[#FFB800]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                                </svg>
                                                <span className="text-[8px] text-[#FFB800] font-bold uppercase tracking-wide">Katılımcı</span>
                                            </div>
                                            <div className="text-sm font-black text-white text-center leading-none">
                                                {currentEvent.participant_count || 0}
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-gradient-to-br from-[#FFB800]/20 to-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <svg className="w-3 h-3 text-[#FFB800]" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path>
                                                </svg>
                                                <span className="text-[8px] text-[#FFB800] font-bold uppercase tracking-wide">Ödül</span>
                                            </div>
                                            <div className="text-[11px] font-black text-[#FFB800] text-center leading-none">
                                                20.000.000₺
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-auto">
                                        <div className="flex justify-center gap-1 lg:gap-3">
                                            {/* Days */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                    <div className="flex gap-0.5 lg:gap-1">
                                                        {d.split('').map((digit, i) => (
                                                            <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                    <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums">{digit}</span>
                                                                </div>
                                                                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">GÜN</div>
                                            </div>
                                            <div className="text-xl lg:text-2xl font-bold text-[#FFB800]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>
                                            {/* Hours */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                    <div className="flex gap-0.5 lg:gap-1">
                                                        {h.split('').map((digit, i) => (
                                                            <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                    <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums">{digit}</span>
                                                                </div>
                                                                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">SAAT</div>
                                            </div>
                                            <div className="text-xl lg:text-2xl font-bold text-[#FFB800]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>
                                            {/* Minutes */}
                                            <div className="text-center">
                                                <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                    <div className="flex gap-0.5 lg:gap-1">
                                                        {m.split('').map((digit, i) => (
                                                            <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                    <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums">{digit}</span>
                                                                </div>
                                                                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">DAK</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DESKTOP VIEW */}
                    <div className="hidden lg:block border-2 border-[#FFB800] rounded-xl lg:rounded-2xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
                        <div className="relative rounded-xl overflow-hidden cursor-pointer transition-transform duration-300 bg-black border-2 border-[#FFB800] shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,0,0.4)]">
                            <div className="relative">
                                <div className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-4 md:gap-0">
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-0 flex-1 relative z-10 w-full">
                                        <div className="w-full h-28 md:w-[280px] md:h-full shrink-0 md:border-r-2 border-[#FFB800]">
                                            <img
                                                src={currentEvent.image_url || "/placeholder-tournament.jpg"}
                                                alt={currentEvent.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex flex-col flex-1 px-3 md:px-6 py-3 md:py-6 w-full">
                                            <div className="text-center mb-2 md:mb-4">
                                                <h3 className="text-base md:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight mb-1 md:mb-2 px-2">
                                                    {currentEvent.name}
                                                </h3>
                                                <div className="h-0.5 w-12 md:w-16 mx-auto bg-gradient-to-r from-transparent via-[#FFB800] to-transparent rounded-full"></div>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
                                                {/* Prize Box */}
                                                <div className="group relative bg-gradient-to-br from-[#FFB800]/20 via-[#FFA500]/10 to-black border-2 border-[#FFB800] rounded-xl md:rounded-2xl p-3 md:p-8 hover:border-[#FFA500] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#FFB800]/20 hover:shadow-[#FFB800]/40 hover:shadow-xl flex-1 min-w-[110px] md:min-w-[130px] max-w-[150px] md:max-w-[180px]">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl md:rounded-2xl"></div>
                                                    <div className="relative">
                                                        <div className="flex items-center justify-center gap-1 md:gap-2 mb-1 md:mb-2">
                                                            <svg className="w-3 h-3 md:w-6 md:h-6 text-[#FFB800]" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path>
                                                            </svg>
                                                            <span className="text-[9px] md:text-xs text-[#FFB800] font-bold uppercase tracking-wide md:tracking-widest">Ödül</span>
                                                        </div>
                                                        <div className="text-center text-sm md:text-lg lg:text-xl font-black text-[#FFB800]">
                                                            20.000.000₺
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Countdown and Button */}
                                    <div className="flex flex-col gap-2 md:gap-4 relative z-10 items-stretch md:items-end px-3 md:pr-6 pb-3 md:py-6 w-full md:w-auto">
                                        <div className="w-full flex flex-col gap-2 md:gap-4">
                                            <div className="flex justify-center gap-1 lg:gap-3">
                                                {/* Days */}
                                                <div className="text-center">
                                                    <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                        <div className="flex gap-0.5 lg:gap-1">
                                                            {d.split('').map((digit, i) => (
                                                                <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                        <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums">{digit}</span>
                                                                    </div>
                                                                    <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">GÜN</div>
                                                </div>
                                                <div className="text-xl lg:text-2xl font-bold text-[#FFB800]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>
                                                {/* Hours */}
                                                <div className="text-center">
                                                    <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                        <div className="flex gap-0.5 lg:gap-1">
                                                            {h.split('').map((digit, i) => (
                                                                <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                        <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums">{digit}</span>
                                                                    </div>
                                                                    <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">SAAT</div>
                                                </div>
                                                <div className="text-xl lg:text-2xl font-bold text-[#FFB800]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>
                                                {/* Minutes */}
                                                <div className="text-center">
                                                    <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                        <div className="flex gap-0.5 lg:gap-1">
                                                            {m.split('').map((digit, i) => (
                                                                <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                        <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums">{digit}</span>
                                                                    </div>
                                                                    <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">DAK</div>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDetails(currentEvent.id);
                                            }}
                                            className="px-4 md:px-8 py-1.5 md:py-3 bg-[#FFB800] hover:bg-[#FFA500] text-black rounded-lg md:rounded-xl font-bold text-xs md:text-base shadow-lg hover:shadow-xl transition-all w-full md:w-auto"
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
                                    ? 'bg-[#FFB800] w-8'
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
