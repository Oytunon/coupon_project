import { useState, useEffect } from "react"

interface UpcomingTournamentCardProps {
    id: number
    name: string
    image_url?: string
    participantCount: number
    startDate: string
    onDetails: () => void
}

export function UpcomingTournamentCard({
    id, name, image_url, participantCount, startDate, onDetails
}: UpcomingTournamentCardProps) {
    const baseUrl = ""
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number }>({ days: 0, hours: 0, minutes: 0 })

    useEffect(() => {
        const calculateTimeRemaining = () => {
            const end = new Date(startDate).getTime()
            const now = new Date().getTime()
            const distance = end - now

            if (distance < 0) return { days: 0, hours: 0, minutes: 0 }

            return {
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
            }
        }

        setTimeLeft(calculateTimeRemaining())
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeRemaining())
        }, 60000)

        return () => clearInterval(timer)
    }, [startDate])

    const formatDigit = (val: number) => {
        return String(val).padStart(2, '0').split('')
    }

    return (
        <div
            onClick={onDetails}
            className="relative rounded-xl overflow-hidden cursor-pointer bg-black border-2 border-[#FFB800] shadow-xl"
        >
            <div className="flex items-stretch gap-0">
                {/* Image */}
                <div className="flex-shrink-0 w-32 border-r-2 border-[#FFB800] overflow-hidden">
                    {image_url ? (
                        <img src={`${baseUrl}${image_url}`} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <span className="text-[#FFB800] text-xs">No Img</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col gap-1 p-2 min-w-0">
                    <h3 className="font-oswald text-base font-black text-white tracking-tight leading-tight line-clamp-2 uppercase">
                        {name}
                    </h3>

                    {/* Stats Row */}
                    <div className="flex items-stretch gap-1.5">
                        {/* Participants */}
                        <div className="flex-1 bg-[#1a1a1a] border-2 border-[#FFB800] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                                <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                                <span className="text-[9px] text-[#FFB800] font-bold uppercase tracking-wide">Katılımcı</span>
                            </div>
                            <div className="font-oswald text-lg font-black text-white text-center leading-none">
                                {participantCount}
                            </div>
                        </div>

                        {/* Prize */}
                        <div className="flex-1 bg-gradient-to-br from-[#FFB800]/20 to-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center">
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                                <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path>
                                </svg>
                                <span className="text-[9px] text-[#FFB800] font-bold uppercase tracking-wide">Ödül</span>
                            </div>
                            <div className="font-oswald text-base font-black text-[#FFB800] text-center leading-none whitespace-nowrap">
                                20.000.000₺
                            </div>
                        </div>
                    </div>

                    {/* Countdown */}
                    <div className="mt-auto">
                        <div className="flex justify-center items-end gap-1.5">
                            {['GÜN', 'SAAT', 'DAK'].map((label, idx) => {
                                const val = idx === 0 ? timeLeft.days : idx === 1 ? timeLeft.hours : timeLeft.minutes
                                const digits = formatDigit(val)
                                return (
                                    <div key={label} className="contents">
                                        <div className="text-center">
                                            <div className="bg-black border-2 border-[#FFB800] rounded-lg px-1.5 py-1 shadow-lg shadow-[#FFB800]/20">
                                                <div className="flex gap-0.5">
                                                    {digits.map((d, i) => (
                                                        <div key={i} className="relative w-[18px] h-[28px] overflow-hidden">
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black rounded transition-transform duration-150 ease-out" style={{ transform: 'translateY(0px)', opacity: 1 }}>
                                                                <span className="text-xl font-bold text-[#FFB800] tabular-nums font-oswald">{d}</span>
                                                            </div>
                                                            <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-black/60 z-10"></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-white mt-1 font-bold uppercase tracking-wide">{label}</div>
                                        </div>
                                        {idx < 2 && <div className="font-oswald text-2xl font-bold text-[#FFB800]/70 pb-5 animate-pulse">:</div>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
