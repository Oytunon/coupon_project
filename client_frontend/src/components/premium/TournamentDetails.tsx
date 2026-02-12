import {
    ArrowLeft, Trophy, Users, Award, Target, Calendar, Clock,
    CheckCircle2, TrendingUp, Shield, Gift, Ticket, ScrollText, Info, Crown, Search, UserPlus, FileText, AlertCircle, ChevronDown
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PublicEvent } from "@/api/client"
import { getLeaderboard, getMyCoupons } from "@/api/participation"
import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

interface TournamentDetailsProps {
    event: PublicEvent
    userPoints: number
    userRank: number
    isJoined: boolean
    onBack: () => void
    username: string
}

export function TournamentDetails({ event, userPoints, userRank, isJoined, onBack, username }: TournamentDetailsProps) {
    const baseUrl = import.meta.env.VITE_API_URL || ""
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number }>({ days: 0, hours: 0, minutes: 0 })
    const [activeTab, setActiveTab] = useState<'info' | 'leaderboard' | 'coupons' | 'rewards' | 'rules'>('info')

    // Leaderboard State
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)

    // Coupons State
    const [coupons, setCoupons] = useState<any[]>([])
    const [activeRule, setActiveRule] = useState<number | null>(1)
    const [loadingCoupons, setLoadingCoupons] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        const calculateTimeRemaining = () => {
            const end = new Date(event.end_date).getTime()
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
    }, [event.end_date])

    // Fetch Leaderboard when tab changes
    useEffect(() => {
        if (activeTab === 'leaderboard') {
            const fetchLb = async () => {
                setLoadingLeaderboard(true)
                try {
                    const data = await getLeaderboard(undefined, event.id, 100)
                    setLeaderboard(data)
                } catch (error) {
                    console.error("Leaderboard fetch error", error)
                } finally {
                    setLoadingLeaderboard(false)
                }
            }
            fetchLb()
        }
    }, [activeTab, event.id])

    // Fetch Coupons when tab changes
    useEffect(() => {
        if (activeTab === 'coupons' && username) {
            const fetchCoupons = async () => {
                setLoadingCoupons(true)
                try {
                    const data = await getMyCoupons(username, undefined, event.id)
                    setCoupons(data || [])
                } catch (error) {
                    console.error("Coupons fetch error", error)
                } finally {
                    setLoadingCoupons(false)
                }
            }
            fetchCoupons()
        }
    }, [activeTab, event.id, username])

    // Format dates
    const startDate = new Date(event.start_date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const endDate = new Date(event.end_date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    // Rules from event or defaults
    const rules = event.rules || {}

    // Helpers
    const maskUsername = (u: string) => {
        if (!u || u.length < 3) return u
        const first = u[0]
        const last = u[u.length - 1]
        const stars = "*".repeat(Math.min(u.length - 2, 5))
        return `${first}${stars}${last}`
    }

    const getInitials = (u: string) => {
        if (!u) return "??"
        return u.substring(0, 2).toUpperCase()
    }

    // Filtered coupons
    const filteredCoupons = coupons.filter(c => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase().trim()
        const ids = q.split(',').map(s => s.trim()).filter(s => s)
        if (ids.length === 0) return c.bet_id.toString().includes(q)
        return ids.some(id => c.bet_id.toString().includes(id))
    })

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-7xl mx-auto">
                <div className="px-4 py-6">
                    {/* Back Button */}
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-6 py-3 bg-[#FFB800] hover:bg-[#FFA500] text-black rounded-xl transition-all font-bold shadow-lg mb-6"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Turnuvalara Dön</span>
                    </button>

                    {/* Hero Card */}
                    <div className="relative rounded-xl overflow-hidden bg-black border-2 border-[#FFB800] shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,0,0.4)] transition-shadow duration-300 mb-6">
                        {/* Status Badge */}
                        <div className="absolute top-0 right-0 z-30 overflow-hidden pointer-events-none">
                            <div className="relative">
                                <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden">
                                    <div className={`absolute top-6 -right-6 md:top-8 md:-right-8 w-32 md:w-40 transform rotate-45 shadow-lg flex justify-center py-1.5 md:py-2 ${event.status === 'active' ? 'bg-gradient-to-r from-[#FFB800] to-[#FFA500]' : 'bg-zinc-600'}`}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            {event.status === 'active' && <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse"></div>}
                                            <span className={`text-[10px] md:text-xs font-bold tracking-wider ${event.status === 'active' ? 'text-black' : 'text-white'}`}>
                                                {event.status === 'active' ? 'AKTİF' : 'BİTTİ'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="flex flex-col md:flex-row items-start md:items-stretch gap-0">
                                {/* Image */}
                                <div className="shrink-0 w-full md:w-[300px] border-b-2 md:border-b-0 md:border-r-2 border-[#FFB800]">
                                    {event.image_url ? (
                                        <img src={`${baseUrl}${event.image_url}`} alt={event.name} className="w-full h-48 md:h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-48 md:h-full flex items-center justify-center bg-zinc-900">
                                            <Trophy className="w-16 h-16 text-[#FFB800]/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-center gap-6 p-6">
                                    <div className="text-center">
                                        <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight mb-2 uppercase">
                                            {event.name}
                                        </h3>
                                        <div className="h-0.5 w-16 mx-auto bg-gradient-to-r from-transparent via-[#FFB800] to-transparent rounded-full"></div>
                                    </div>

                                    {/* Stats Boxes */}
                                    <div className="flex flex-wrap items-center justify-center gap-4">
                                        {/* Participants */}
                                        <div className="group relative bg-[#1a1a1a] border-2 border-[#FFB800] rounded-2xl p-6 md:p-8 hover:border-[#FFA500] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#1a1a1a]/20 hover:shadow-xl hover:shadow-[#FFB800]/40 flex-1 min-w-[130px] max-w-[180px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                                    <Users className="w-4 h-4 md:w-6 md:h-6 text-[#FFB800]" />
                                                    <span className="text-[10px] md:text-xs text-[#FFB800] font-bold uppercase tracking-wide md:tracking-widest">Katılımcı</span>
                                                </div>
                                                <div className="text-center text-xl md:text-2xl lg:text-3xl font-black text-white font-oswald">
                                                    {event.participant_count.toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Prize */}
                                        <div className="group relative bg-gradient-to-br from-[#FFB800]/20 via-[#FFA500]/10 to-black border-2 border-[#FFB800] rounded-2xl p-6 md:p-8 hover:border-[#FFA500] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#FFB800]/20 hover:shadow-[#FFB800]/40 hover:shadow-xl flex-1 min-w-[130px] max-w-[180px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                                    <Award className="w-4 h-4 md:w-6 md:h-6 text-[#FFB800]" />
                                                    <span className="text-[10px] md:text-xs text-[#FFB800] font-bold uppercase tracking-wide md:tracking-widest">Ödül Havuzu</span>
                                                </div>
                                                <div className="text-center text-base md:text-lg lg:text-xl font-black text-[#FFB800] font-oswald">
                                                    10.000.000₺
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Section: User Stats & Countdown */}
                                <div className="flex flex-col gap-3 md:gap-4 justify-center items-stretch md:items-end px-4 md:pr-6 pb-4 md:py-6 w-full md:w-auto">
                                    {isJoined && (
                                        <div className="flex items-center gap-3 md:gap-4 justify-center md:justify-end">
                                            <div className="text-center">
                                                <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                                                    <Target className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                    <span className="text-[10px] md:text-xs uppercase tracking-wide">Puanım</span>
                                                </div>
                                                <div className="text-2xl md:text-4xl font-bold text-white font-oswald">
                                                    {userPoints.toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                            <div className="w-px h-12 md:h-16 bg-[#FFB800]/30"></div>
                                            <div className="text-center">
                                                <div className="flex items-center justify-center gap-2 text-[#FFB800] mb-1">
                                                    <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                    <span className="text-[10px] md:text-xs uppercase tracking-wide">Sıralama</span>
                                                </div>
                                                <div className="text-2xl md:text-4xl font-bold text-[#FFB800] font-oswald">
                                                    #{userRank}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Countdown */}
                                    <div className="w-full flex flex-col gap-3 md:gap-4">
                                        {event.status === 'active' ? (
                                            <div className="flex justify-center gap-1 lg:gap-3">
                                                {['GÜN', 'SAAT', 'DAK'].map((label, idx) => {
                                                    const val = idx === 0 ? timeLeft.days : idx === 1 ? timeLeft.hours : timeLeft.minutes
                                                    return (
                                                        <div key={label} className="contents">
                                                            <div className="text-center">
                                                                <div className="bg-black border-2 border-[#FFB800] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#FFB800]/20">
                                                                    <div className="flex gap-0.5 lg:gap-1">
                                                                        {String(val).padStart(2, '0').split('').map((d, i) => (
                                                                            <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                                <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                                    <span className="text-xl lg:text-3xl font-bold text-[#FFB800] tabular-nums font-oswald">{d}</span>
                                                                                </div>
                                                                                <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="text-[9px] lg:text-xs text-white mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">{label}</div>
                                                            </div>
                                                            {idx < 2 && <div className="text-xl lg:text-2xl font-bold text-[#FFB800]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>}
                                                        </div>
                                                    )
                                                })}
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

                    {/* Navigation Buttons */}
                    <div className="bg-black border border-[#FFB800]/30 rounded-2xl p-1.5 md:p-2 mx-4 mb-6 flex gap-1 md:gap-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'info' ? 'bg-[#FFB800] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <Info className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                            <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">BİLGİLENDİRME</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('leaderboard')}
                            className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-[#FFB800] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <Trophy className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                            <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">SIRALAMA</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('coupons')}
                            className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'coupons' ? 'bg-[#FFB800] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <Ticket className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                            <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">KUPONLARIM</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('rewards')}
                            className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'rewards' ? 'bg-[#FFB800] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <Gift className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                            <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">ÖDÜLLER</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'rules' ? 'bg-[#FFB800] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <ScrollText className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                            <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">KURALLAR</span>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="px-4 pb-8">
                        {/* INFO TAB */}
                        {activeTab === 'info' && (
                            <div className="space-y-3 md:space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                    <div className="bg-black/50 border border-[#FFB800]/30 rounded-lg p-3 md:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="w-4 h-4 text-[#FFB800]" />
                                            <span className="text-[#FFB800] text-xs md:text-sm font-semibold">Turnuva Tarihi</span>
                                        </div>
                                        <p className="text-white text-sm md:text-base font-medium">{endDate}</p>
                                    </div>
                                    <div className="bg-black/50 border border-[#FFB800]/30 rounded-lg p-3 md:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-4 h-4 text-[#FFB800]" />
                                            <span className="text-[#FFB800] text-xs md:text-sm font-semibold">Katılım Tarihi</span>
                                        </div>
                                        <p className="text-white text-sm md:text-base font-medium">{startDate}</p>
                                    </div>
                                    <div className="bg-black/50 border border-[#FFB800]/30 rounded-lg p-3 md:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-4 h-4 text-[#FFB800]" />
                                            <span className="text-[#FFB800] text-xs md:text-sm font-semibold">Katılım Durumu</span>
                                        </div>
                                        <p className="text-sm md:text-base font-bold text-[#FFB800]">{isJoined ? 'Katıldınız' : 'Katılmadınız'}</p>
                                    </div>
                                    <div className="bg-black/50 border border-[#FFB800]/30 rounded-lg p-3 md:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-4 h-4 text-[#FFB800]" />
                                            <span className="text-[#FFB800] text-xs md:text-sm font-semibold">Geçerli Bahis Miktarları</span>
                                        </div>
                                        <p className="text-white text-xs md:text-sm">
                                            <span className="font-medium">Minimum:</span> <span className="font-bold text-[#FFB800]">{rules.min_stake || 100} TL</span>
                                            <span className="mx-2 text-gray-500">|</span>
                                            <span className="font-medium">Maksimum:</span> <span className="font-bold text-[#FFB800]">∞</span>
                                        </p>
                                    </div>
                                    <div className="bg-black/50 border border-[#FFB800]/30 rounded-lg p-3 md:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Trophy className="w-4 h-4 text-[#FFB800]" />
                                            <span className="text-[#FFB800] text-xs md:text-sm font-semibold">Geçerli Bahis Türleri</span>
                                        </div>
                                        <p className="text-white text-xs md:text-sm font-medium">{(rules.min_odd || 1.5).toFixed(2)} oran veya üzerinde tekli ya da kombine bahisler</p>
                                    </div>
                                </div>
                                <div className="bg-black/50 border border-[#FFB800]/30 rounded-lg p-3 md:p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className="w-4 h-4 text-[#FFB800]" />
                                        <span className="text-[#FFB800] text-xs md:text-sm font-semibold">Geçerli Ligler & Karşılaşmalar</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                                        <div className="bg-black/30 border border-[#FFB800]/20 rounded-lg p-2 md:p-3">
                                            <div className="text-[#FFB800] text-xs font-bold mb-1">⚽ FUTBOL</div>
                                            <div className="text-white text-[10px] md:text-xs leading-relaxed">Türkiye Süper Lig, İngiltere Premier Lig, İspanya La Liga, İtalya Serie A, Almanya Bundesliga, Fransa Ligue 1, UEFA Şampiyonlar Ligi, UEFA Avrupa Ligi</div>
                                        </div>
                                        <div className="bg-black/30 border border-[#FFB800]/20 rounded-lg p-2 md:p-3">
                                            <div className="text-[#FFB800] text-xs font-bold mb-1">🏀 BASKETBOL</div>
                                            <div className="text-white text-[10px] md:text-xs leading-relaxed">Türkiye BSL, NBA, Euroleague, Eurocup</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LEADERBOARD TAB */}
                        {activeTab === 'leaderboard' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2">
                                {isJoined && (
                                    <div className="mb-8 bg-black border border-[#FFB800]/30 rounded-2xl p-4 md:p-8">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Trophy className="md:w-7 md:h-7 text-[#FFB800]" />
                                            <div>
                                                <h3 className="text-xl md:text-2xl font-bold text-white">Senin Performansın</h3>
                                                <p className="text-gray-400 text-xs md:text-sm">Turnuvanın mevcut durumun</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                            <div className="bg-black rounded-xl p-4 md:p-6 border border-[#FFB800]/30">
                                                <div className="flex items-center gap-2 md:gap-3 mb-2">
                                                    <Crown className="w-5 h-5 md:w-6 md:h-6 text-[#FFB800]" />
                                                    <span className="text-gray-400 text-xs md:text-sm font-semibold uppercase tracking-wide">Sıralaman</span>
                                                </div>
                                                <div className="text-3xl md:text-5xl font-black text-[#FFB800]">#{userRank}</div>
                                                <div className="mt-2 text-gray-500 text-xs md:text-sm">{leaderboard.length} oyuncu arasında</div>
                                            </div>
                                            <div className="bg-black rounded-xl p-4 md:p-6 border border-[#FFB800]/30">
                                                <div className="flex items-center gap-2 md:gap-3 mb-2">
                                                    <Trophy className="w-5 h-5 md:w-6 md:h-6 text-[#FFB800]" />
                                                    <span className="text-gray-400 text-xs md:text-sm font-semibold uppercase tracking-wide">Toplam Puanın</span>
                                                </div>
                                                <div className="text-3xl md:text-5xl font-black text-white">{userPoints.toLocaleString('tr-TR')}</div>
                                                <div className="mt-2 text-gray-500 text-xs md:text-sm">Devam ediyor</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-6">
                                    <Crown className="md:w-7 md:h-7 text-[#FFB800]" />
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-bold">Liderlik Tablosu</h2>
                                        <p className="text-gray-400 text-xs md:text-sm">Turnuvanın en yüksek puanlı {leaderboard.length} katılımcısı</p>
                                    </div>
                                </div>

                                {loadingLeaderboard ? (
                                    <div className="flex justify-center p-12">
                                        <Loader2 className="w-10 h-10 text-[#FFB800] animate-spin" />
                                    </div>
                                ) : leaderboard.length === 0 ? (
                                    <div className="text-center p-8 text-gray-500">Henüz sıralama verisi yok.</div>
                                ) : (
                                    <>
                                        <div className="relative py-8 md:py-12 mb-8">
                                            <div className="flex justify-center items-end gap-2 md:gap-4">
                                                {leaderboard[1] && (
                                                    <div className="flex flex-col items-center">
                                                        <div className="relative mb-2 md:mb-4">
                                                            <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#5a4a2a] to-[#3a2a1a] flex items-center justify-center text-base md:text-2xl font-bold border-2 md:border-4 border-black shadow-xl">
                                                                {getInitials(leaderboard[1].username)}
                                                            </div>
                                                        </div>
                                                        <div className="text-center mb-2">
                                                            <div className="font-bold text-xs md:text-base">{maskUsername(leaderboard[1].username)}</div>
                                                            <div className="text-yellow-500 font-bold text-xs md:text-base">{leaderboard[1].score.toLocaleString('tr-TR')}</div>
                                                        </div>
                                                        <div className="rounded-t-xl flex items-center justify-center text-2xl md:text-5xl font-bold bg-gradient-to-b from-gray-700 to-gray-800 w-20 h-16 md:w-32 md:h-28">2</div>
                                                    </div>
                                                )}
                                                {leaderboard[0] && (
                                                    <div className="flex flex-col items-center">
                                                        <div className="relative mb-2 md:mb-4 scale-110">
                                                            <Crown className="w-8 h-8 absolute -top-6 md:-top-8 left-1/2 -translate-x-1/2 text-yellow-500" />
                                                            <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FFA500] flex items-center justify-center text-base md:text-2xl font-bold border-2 md:border-4 border-black shadow-xl text-black">
                                                                {getInitials(leaderboard[0].username)}
                                                            </div>
                                                        </div>
                                                        <div className="text-center mb-2">
                                                            <div className="font-bold text-xs md:text-base">{maskUsername(leaderboard[0].username)}</div>
                                                            <div className="text-yellow-500 font-bold text-xs md:text-base">{leaderboard[0].score.toLocaleString('tr-TR')}</div>
                                                        </div>
                                                        <div className="rounded-t-xl flex items-center justify-center text-2xl md:text-5xl font-bold bg-gradient-to-b from-yellow-600 to-yellow-700 w-20 h-24 md:w-32 md:h-40">1</div>
                                                    </div>
                                                )}
                                                {leaderboard[2] && (
                                                    <div className="flex flex-col items-center">
                                                        <div className="relative mb-2 md:mb-4">
                                                            <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#4a3a1a] to-[#2a1a0a] flex items-center justify-center text-base md:text-2xl font-bold border-2 md:border-4 border-black shadow-xl">
                                                                {getInitials(leaderboard[2].username)}
                                                            </div>
                                                        </div>
                                                        <div className="text-center mb-2">
                                                            <div className="font-bold text-xs md:text-base">{maskUsername(leaderboard[2].username)}</div>
                                                            <div className="text-yellow-500 font-bold text-xs md:text-base">{leaderboard[2].score.toLocaleString('tr-TR')}</div>
                                                        </div>
                                                        <div className="rounded-t-xl flex items-center justify-center text-2xl md:text-5xl font-bold bg-gradient-to-b from-amber-800 to-amber-900 w-20 h-12 md:w-32 md:h-20">3</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-black rounded-xl border border-[#FFB800]/30 overflow-hidden">
                                            {leaderboard.slice(3).map((user: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 hover:bg-black/50 transition-all border-b border-[#FFB800]/30 last:border-0">
                                                    <div className="flex items-center gap-2 md:gap-4">
                                                        <div className="w-8 h-8 md:w-12 md:h-12 bg-black border border-[#FFB800]/30 rounded-full flex items-center justify-center text-gray-300 font-bold text-xs md:text-base">{idx + 4}</div>
                                                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-[#4a3a1a] to-[#2a1a0a] flex items-center justify-center font-bold text-sm md:text-lg">{getInitials(user.username)}</div>
                                                        <div className="font-medium text-gray-200 text-sm md:text-base">{maskUsername(user.username)}</div>
                                                    </div>
                                                    <div className="text-base md:text-xl font-bold text-white">{user.score.toLocaleString('tr-TR')}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* COUPONS TAB */}
                        {activeTab === 'coupons' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#FFB800] to-[#FFA500] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFB800]/20">
                                        <Ticket className="md:w-6 md:h-6 text-black" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-bold">Kuponlarım</h2>
                                        <p className="text-gray-400 text-xs md:text-sm">Turnuva süresince oynadığınız kuponlar</p>
                                    </div>
                                </div>
                                <div className="mb-6 text-center">
                                    <p className="text-gray-400 text-sm">Bu sayfada yalnızca turnuva puanlamasına dahil edilen kuponlar görüntülenmektedir.</p>
                                </div>
                                <div className="mb-6 bg-gradient-to-br from-[#FFB800]/20 via-[#FFB800]/10 to-black border-2 border-[#FFB800] rounded-xl p-6 text-center">
                                    <div className="text-gray-400 text-sm mb-2">Toplam Puan:</div>
                                    <div className="text-5xl md:text-6xl font-black text-[#FFB800]">{userPoints.toLocaleString('tr-TR')}</div>
                                </div>

                                {/* Search */}
                                <div className="mb-6">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            placeholder="Birden fazla kupon aramak için virgül (,) ile ayırınız (Örneğin; 6001673730, 6001673731)"
                                            className="w-full bg-black border-2 border-[#FFB800]/30 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#FFB800] transition-colors"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="mt-3 text-gray-500 text-xs">
                                        * Kupon ID veya Bahis Numarasına göre arama yapabilirsiniz.
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="bg-black border-2 border-[#FFB800]/30 rounded-xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gradient-to-r from-[#FFB800]/10 to-black border-b-2 border-[#FFB800]/30">
                                                <tr>
                                                    <th className="text-left py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">İşlem No</th>
                                                    <th className="text-left py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Bahis ID</th>
                                                    <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold hidden md:table-cell">Tarih</th>
                                                    <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Bahis Tutarı</th>
                                                    <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Oran</th>
                                                    <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold hidden lg:table-cell">Tür</th>
                                                    <th className="text-right py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Elde Edilen Puan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loadingCoupons ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-8 text-center text-white"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#FFB800]" /></td>
                                                    </tr>
                                                ) : filteredCoupons.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-8 text-center text-gray-500 italic">Kupon bulunamadı.</td>
                                                    </tr>
                                                ) : (
                                                    filteredCoupons.map((coupon, idx) => {
                                                        const isPending = coupon.state === 'Pending';
                                                        const isWon = coupon.state === 'Won';
                                                        const isLost = coupon.state === 'Lost';

                                                        // Fallback logic for point color/status if state is vague
                                                        // Using the logic: Pending -> Pulsing Yellow, Won -> Yellow, Lost/Other -> Gray
                                                        let dotClass = "bg-gray-600";
                                                        if (isWon) dotClass = "bg-[#FFB800] shadow-lg shadow-[#FFB800]/50";
                                                        if (isPending) dotClass = "bg-[#FFB800] animate-pulse shadow-lg shadow-[#FFB800]/50";

                                                        return (
                                                            <tr key={idx} className="border-b border-[#FFB800]/10 hover:bg-[#FFB800]/5 transition-colors cursor-pointer group">
                                                                <td className="py-4 px-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}></div>
                                                                        <span className="text-white font-bold text-sm md:text-base">{filteredCoupons.length - idx}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-4 px-4"><span className="text-gray-300 font-mono text-xs md:text-sm">{coupon.bet_id}</span></td>
                                                                <td className="py-4 px-4 text-center text-xs text-gray-400 hidden md:table-cell">
                                                                    <div className="flex flex-col items-center">
                                                                        <span>{new Date(coupon.inserted_at).toLocaleDateString('tr-TR')}</span>
                                                                        <span className="text-[10px]">{new Date(coupon.inserted_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-4 px-4 text-center"><span className="text-white font-semibold text-sm md:text-base">{coupon.stake}₺</span></td>
                                                                <td className="py-4 px-4 text-center"><span className="px-2 md:px-3 py-1 bg-[#FFB800]/20 text-[#FFB800] rounded-full text-xs md:text-sm font-bold">{coupon.odds}</span></td>
                                                                <td className="py-4 px-4 text-center hidden lg:table-cell">
                                                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                        {coupon.bet_data?.Selections?.length > 1 ? 'Kombine' : 'Tekli'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 px-4 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-lg md:text-xl font-black text-[#FFB800]">{coupon.calculation || 0}</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* REWARDS TAB */}
                        {activeTab === 'rewards' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-3 mb-6 md:mb-8">
                                    <Gift className="md:w-7 md:h-7 text-[#FFB800]" />
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-bold">Ödüller</h2>
                                        <p className="text-gray-400 text-xs md:text-sm">Turnuva ödül havuzu ve dağılımı</p>
                                    </div>
                                </div>
                                <div className="bg-black rounded-2xl p-6 md:p-8 mb-6 md:mb-8 text-center border-2 border-[#FFB800]">
                                    <div className="text-[#FFB800]/80 text-xs md:text-sm mb-2 md:mb-3 uppercase tracking-wide font-semibold">Toplam Ödül Havuzu</div>
                                    <div className="text-3xl md:text-5xl lg:text-6xl font-black text-[#FFB800] drop-shadow-[0_0_12px_rgba(255,184,0,0.4)]">10.000.000₺</div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                                    <div className="bg-gradient-to-br from-[#5a4a2a] to-[#3a2a1a] rounded-xl p-4 md:p-6 text-center border border-[#FFB800]/30">
                                        <div className="text-gray-300 text-xs md:text-sm mb-2 font-semibold">1. Sıra</div>
                                        <div className="text-3xl md:text-5xl font-black text-[#FFB800]">₺150.000</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-[#3a2a1a] to-[#2a1a0a] rounded-xl p-4 md:p-6 text-center border border-[#FFB800]/30">
                                        <div className="text-gray-300 text-xs md:text-sm mb-2 font-semibold">2. Sıra</div>
                                        <div className="text-3xl md:text-5xl font-black text-[#FFB800]">₺100.000</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-[#3a2a1a] to-[#2a1a0a] rounded-xl p-4 md:p-6 text-center border border-[#FFB800]/30">
                                        <div className="text-gray-300 text-xs md:text-sm mb-2 font-semibold">3. Sıra</div>
                                        <div className="text-3xl md:text-5xl font-black text-[#FFB800]">₺50.000</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                                    <div className="bg-black rounded-xl p-4 md:p-6 text-center border border-[#FFB800]/50">
                                        <div className="text-[#FFB800]/70 text-xs md:text-sm mb-2 font-semibold">4-10. Sıra</div>
                                        <div className="text-2xl md:text-3xl font-bold text-[#FFB800]">₺15.000</div>
                                    </div>
                                    <div className="bg-black rounded-xl p-4 md:p-6 text-center border border-[#FFB800]/50">
                                        <div className="text-[#FFB800]/70 text-xs md:text-sm mb-2 font-semibold">11-25. Sıra</div>
                                        <div className="text-2xl md:text-3xl font-bold text-[#FFB800]">₺5.000</div>
                                    </div>
                                    <div className="bg-black rounded-xl p-4 md:p-6 text-center border border-[#FFB800]/50">
                                        <div className="text-[#FFB800]/70 text-xs md:text-sm mb-2 font-semibold">26-50. Sıra</div>
                                        <div className="text-2xl md:text-3xl font-bold text-[#FFB800]">₺2.000</div>
                                    </div>
                                </div>

                                <div className="mt-6 md:mt-8 bg-black border border-[#FFB800]/30 rounded-xl p-4 md:p-6">
                                    <p className="text-gray-400 text-xs md:text-sm leading-relaxed"><strong className="text-[#FFB800]">Not:</strong> Turnuva kurallarında değişiklik hakkı saklıdır. Güncel kurallar için bu sayfayı düzenli olarak kontrol ediniz.</p>
                                </div>
                            </div>
                        )}

                        {/* RULES TAB */}
                        {activeTab === 'rules' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#FFB800] to-[#FFA500] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFB800]/20">
                                        <ScrollText className="md:w-6 md:h-6 text-black" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-bold">Turnuva Kuralları</h2>
                                        <p className="text-gray-400 text-xs md:text-sm">Katılım şartları ve detaylı kurallar</p>
                                    </div>
                                </div>
                                <div className="mb-6 bg-gradient-to-br from-[#FFB800]/10 via-black to-black border-2 border-[#FFB800]/30 rounded-xl p-4 md:p-5">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="text-[#FFB800] flex-shrink-0 mt-0.5" size={20} />
                                        <div>
                                            <h3 className="font-bold text-sm md:text-base text-[#FFB800] mb-1">Önemli Bilgilendirme</h3>
                                            <p className="text-gray-300 text-xs md:text-sm leading-relaxed">Lütfen turnuvaya katılmadan önce aşağıdaki kuralları dikkatlice okuyunuz. Katılım ile birlikte tüm kuralları kabul etmiş sayılırsınız.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { id: 1, title: 'Nasıl Katılırım?', icon: UserPlus, content: 'Turnuvaya katılmak için "HEMEN KATIL" butonuna tıklamanız yeterlidir. Katılım ücretsizdir ve anında başlayabilirsiniz. Turnuva süresince oynadığınız tüm kuponlar otomatik olarak puan kazandırır.' },
                                        { id: 2, title: 'Puan Nasıl Kazanılır?', icon: TrendingUp, content: 'Puanlarınız kuponlarınızın oranına ve tutarına göre hesaplanır. Yüksek oranlı ve tutarlı kuponlar daha fazla puan kazandırır.' },
                                        { id: 3, title: 'Kupon Kuralları', icon: Ticket, content: 'Sadece futbol ve basketbol maçları geçerlidir. Minimum oran 1.50 olmalıdır. Canlı bahisler dahildir.' },
                                        { id: 4, title: 'Ödül Dağıtımı', icon: Award, content: 'Ödüller turnuva bitiminden 24 saat sonra hesabınıza otomatik olarak yatırılır. Şartları sağlayan kullanıcılar ödül havuzundan pay alır.' },
                                        { id: 5, title: 'Genel Şartlar', icon: FileText, content: 'Turnuvaya katılan herkes genel kuralları kabul etmiş sayılır. Hile girişimi tespit edilen kullanıcılar diskalifiye edilir.' }
                                    ].map((rule) => (
                                        <div key={rule.id} className={`bg-gradient-to-br from-gray-900 to-black border-2 rounded-xl overflow-hidden transition-all ${activeRule === rule.id ? 'border-[#FFB800]' : 'border-[#FFB800]/20'}`}>
                                            <button
                                                onClick={() => setActiveRule(activeRule === rule.id ? null : rule.id)}
                                                className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-black/30 transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-3 md:gap-4 flex-1">
                                                    <div className="relative">
                                                        <div className={`absolute inset-0 bg-[#FFB800] blur-lg opacity-20 ${activeRule === rule.id ? 'opacity-40' : ''}`}></div>
                                                        <div className="relative w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-[#FFB800] to-[#FFA500] rounded-xl flex items-center justify-center shadow-lg">
                                                            <rule.icon className="md:w-6 md:h-6 text-black" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[#FFB800] font-black text-lg md:text-xl">{rule.id}.</span>
                                                            <h3 className="font-bold text-sm md:text-base text-white">{rule.title}</h3>
                                                        </div>
                                                        {activeRule !== rule.id && (
                                                            <p className="text-gray-500 text-xs md:text-sm line-clamp-1">Detayları görüntülemek için tıklayın</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronDown className={`md:w-6 md:h-6 text-[#FFB800] transition-transform flex-shrink-0 ml-2 ${activeRule === rule.id ? 'rotate-180' : ''}`} />
                                            </button>

                                            {activeRule === rule.id && (
                                                <div className="px-4 md:px-5 pb-4 md:pb-5 animate-in slide-in-from-top-2">
                                                    <div className="bg-black/50 rounded-lg p-4 md:p-5 border-l-4 border-[#FFB800]">
                                                        <p className="text-gray-300 leading-relaxed text-xs md:text-sm">{rule.content}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 bg-black border-2 border-[#FFB800]/30 rounded-xl p-4 md:p-5">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 bg-[#FFB800]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <AlertCircle className="text-[#FFB800]" size={16} />
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-xs md:text-sm leading-relaxed"><strong className="text-[#FFB800]">Yasal Uyarı:</strong> Turnuva kurallarında değişiklik yapma hakkı saklıdır. Güncel kurallar için bu sayfayı düzenli olarak kontrol ediniz. Herhangi bir soru veya sorun için müşteri hizmetlerimizle iletişime geçebilirsiniz.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
