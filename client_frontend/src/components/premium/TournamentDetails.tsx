import {
    ArrowLeft, Trophy, Users, Award, Target, Calendar, Clock,
    CheckCircle2, TrendingUp, Shield, Gift, Ticket, ScrollText, Info, Crown, Search, UserPlus, FileText, AlertCircle, X, ChevronDown, Globe
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PublicEvent, getLeagues } from "@/api/client"
import { getLeaderboard, getMyCoupons, getRewardWinners } from "@/api/participation"
import React, { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { parseEventDate, parseUtcDate } from "@/utils/dateUtils"

interface TournamentDetailsProps {
    event: PublicEvent
    userPoints: number
    userRank: number
    isJoined: boolean
    joinedAt?: string
    onBack: () => void
    username: string
    onJoin: () => void
}

// Helper to calculate total prize
const calculateTotalPrize = (rules: any) => {
    if (!rules) return 0;
    let validRules = rules;
    if (typeof rules === 'string') {
        try { validRules = JSON.parse(rules); } catch { return 0; }
    }
    if (!validRules.rewards || !Array.isArray(validRules.rewards)) return 0;
    return validRules.rewards.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
}

const getRewardLabel = (reward: any) => {
    if (reward.criteria_type === 'rank_exact') return `${reward.criteria_value}. Sıra`;
    if (reward.criteria_type === 'rank') return `İlk ${reward.criteria_value} Kişi`;
    return 'Ödül';
}

const CountUpAnimation = ({ target, duration = 2000 }: { target: number, duration?: number }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = currentTime - startTime;
            const percentage = Math.min(progress / duration, 1);

            // Ease out cubic function: 1 - (1 - t)^3
            const easeOut = 1 - Math.pow(1 - percentage, 3);

            setCount(Math.floor(easeOut * target));

            if (progress < duration) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [target, duration]);

    return <>{count.toLocaleString('tr-TR')}</>;
};

export function TournamentDetails({ event, userPoints, userRank, isJoined, joinedAt, onBack, username, onJoin }: TournamentDetailsProps) {
    const baseUrl = ""
    const startDate = parseEventDate(event.start_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const endDate = parseEventDate(event.end_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const joinDateDisplay = isJoined && joinedAt ? new Date(joinedAt.endsWith('Z') ? joinedAt : joinedAt + 'Z').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number }>({ days: 0, hours: 0, minutes: 0 })
    const [activeTab, setActiveTab] = useState<'info' | 'leaderboard' | 'coupons' | 'rewards'>('info')

    // Leaderboard State
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)

    // Coupons State
    const [coupons, setCoupons] = useState<any[]>([])
    const [activeRule, setActiveRule] = useState<number | null>(1)
    const [loadingCoupons, setLoadingCoupons] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCoupon, setSelectedCoupon] = useState<any | null>(null)

    // Reward Winners State
    const [rewardWinners, setRewardWinners] = useState<any[]>([])
    const [loadingRewardWinners, setLoadingRewardWinners] = useState(false)
    const [leagues, setLeagues] = useState<any[]>([])

    const isUpcoming = new Date() < parseEventDate(event.start_date)
    const isExpired = new Date() > parseEventDate(event.end_date)

    // Calculate dynamic values
    const totalPrize = calculateTotalPrize(event.rules);

    const parsedRewards = (() => {
        let r = event.rules;
        if (typeof r === 'string') {
            try { r = JSON.parse(r); } catch { return []; }
        }
        return Array.isArray(r?.rewards) ? r.rewards : [];
    })();

    // Sort rewards by criteria_value
    const sortedRewards = [...parsedRewards].sort((a: any, b: any) => (a.criteria_value || 0) - (b.criteria_value || 0));

    // Split top 3 (exact ranks) and others
    const top3 = sortedRewards.filter(r => r.criteria_type === 'rank_exact' && r.criteria_value <= 3);
    const otherRewards = sortedRewards.filter(r => !top3.includes(r));

    useEffect(() => {
        const calculateTimeRemaining = () => {
            const end = isUpcoming ? parseEventDate(event.start_date).getTime() : parseEventDate(event.end_date).getTime()
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
    }, [event.end_date, event.start_date, isUpcoming])

    // Fetch Leagues
    useEffect(() => {
        const fetchLeagues = async () => {
            try {
                const data = await getLeagues()
                setLeagues(data)
            } catch (e) {
                console.error("Failed to fetch leagues", e)
            }
        }
        if (activeTab === 'info') {
            fetchLeagues()
        }
    }, [activeTab])

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

        // Fetch reward winners for ended tournaments
        if (activeTab === 'leaderboard' && event.status === 'ended') {
            const fetchRewardWinners = async () => {
                setLoadingRewardWinners(true)
                try {
                    const data = await getRewardWinners(event.id)
                    setRewardWinners(data)
                } catch (error) {
                    console.error("Reward winners fetch error", error)
                } finally {
                    setLoadingRewardWinners(false)
                }
            }
            fetchRewardWinners()
        }
    }, [activeTab, event.id, event.status])

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


    // Rules from event or defaults
    const rules = event.rules || {}



    const getInitials = (u: string) => {
        if (!u) return "??"
        return u.substring(0, 2).toUpperCase()
    }

    // Sadece kazanan kuponlar; arama filtresi
    const wonCoupons = coupons.filter(c => c.state?.toLowerCase() === 'won')
    const filteredCoupons = wonCoupons.filter(c => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase().trim()
        const ids = q.split(',').map(s => s.trim()).filter(s => s)
        if (ids.length === 0) return c.bet_id.toString().includes(q)
        return ids.some(id => c.bet_id.toString().includes(id))
    })

    return (
        <div className="min-h-screen bg-black text-[#F7EBA5]">
            <div className="max-w-7xl mx-auto">
                <div className="px-4 py-6">
                    {/* Back Button */}
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-6 py-3 bg-[#D9B648] hover:bg-[#F7EBA5] text-black rounded-xl transition-all font-bold shadow-lg mb-6"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Turnuvalara Dön</span>
                    </button>

                    {/* Hero Card */}
                    <div className="relative rounded-xl overflow-hidden bg-black border-2 border-[#D9B648] shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,0,0.4)] transition-shadow duration-300 mb-6">
                        {/* Status Badge */}
                        <div className="absolute top-0 right-0 z-30 overflow-hidden pointer-events-none">
                            <div className="relative">
                                <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden">
                                    <div className={`absolute top-6 -right-6 md:top-8 md:-right-8 w-32 md:w-40 transform rotate-45 shadow-lg flex justify-center py-1.5 md:py-2 ${event.status === 'active' ? 'bg-gradient-to-r from-[#D9B648] to-[#F7EBA5]' : 'bg-zinc-600'}`}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            {event.status === 'active' && <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse"></div>}
                                            <span className={`text-[10px] md:text-xs font-bold tracking-wider ${event.status === 'active' ? 'text-black' : 'text-[#F7EBA5]'}`}>
                                                {event.status === 'active' ? (isUpcoming ? 'YAKINDA' : 'AKTİF') : 'BİTTİ'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="flex flex-col md:flex-row items-start md:items-stretch gap-0">
                                {/* Image */}
                                <div className="shrink-0 w-full md:w-[300px] border-b-2 md:border-b-0 md:border-r-2 border-[#D9B648] bg-black flex items-center justify-center min-h-[12rem] md:min-h-[16rem]">
                                    {event.image_url ? (
                                        <img src={`${baseUrl}${event.image_url}`} alt={event.name} className="w-full h-48 md:h-full object-contain" />
                                    ) : (
                                        <div className="w-full h-48 md:h-full flex items-center justify-center bg-zinc-900">
                                            <Trophy className="w-16 h-16 text-[#D9B648]/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-center gap-6 p-6">
                                    <div className="text-center">
                                        <h3 className="text-2xl md:text-3xl font-black text-[#F7EBA5] tracking-tight leading-tight mb-2 uppercase">
                                            {event.name}
                                        </h3>
                                        <div className="h-0.5 w-16 mx-auto bg-gradient-to-r from-transparent via-[#D9B648] to-transparent rounded-full"></div>
                                    </div>

                                    {/* Stats Boxes */}
                                    <div className="flex flex-wrap items-center justify-center gap-4">
                                        {/* Participants */}
                                        <div className="group relative bg-[#1a1a1a] border-2 border-[#D9B648] rounded-2xl p-6 md:p-8 hover:border-[#F7EBA5] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#1a1a1a]/20 hover:shadow-xl hover:shadow-[#D9B648]/40 flex-1 min-w-[130px] max-w-[180px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                                    <Users className="w-4 h-4 md:w-6 md:h-6 text-[#D9B648]" />
                                                    <span className="text-[10px] md:text-xs text-[#D9B648] font-bold uppercase tracking-wide md:tracking-widest">Katılımcı</span>
                                                </div>
                                                <div className="text-center text-xl md:text-2xl lg:text-3xl font-black text-[#F7EBA5] font-oswald">
                                                    {event.participant_count.toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Prize */}
                                        <div className="group relative bg-gradient-to-br from-[#D9B648]/20 via-[#F7EBA5]/10 to-black border-2 border-[#D9B648] rounded-2xl p-6 md:p-8 hover:border-[#F7EBA5] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#D9B648]/20 hover:shadow-[#D9B648]/40 hover:shadow-xl flex-1 min-w-[130px] max-w-[180px]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-[#D9B648]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                                    <Award className="w-4 h-4 md:w-6 md:h-6 text-[#D9B648]" />
                                                    <span className="text-[10px] md:text-xs text-[#D9B648] font-bold uppercase tracking-wide md:tracking-widest">Ödül Havuzu</span>
                                                </div>
                                                <div className="text-center text-base md:text-lg lg:text-xl font-black text-[#D9B648] font-oswald">
                                                    {totalPrize > 0 ? `${totalPrize.toLocaleString('tr-TR')}₺` : 'Belirlenmedi'}
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
                                                <div className="text-2xl md:text-4xl font-bold text-[#F7EBA5] font-oswald">
                                                    {userPoints.toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                            <div className="w-px h-12 md:h-16 bg-[#D9B648]/30"></div>
                                            <div className="text-center">
                                                <div className="flex items-center justify-center gap-2 text-[#D9B648] mb-1">
                                                    <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                    <span className="text-[10px] md:text-xs uppercase tracking-wide">Sıralama</span>
                                                </div>
                                                <div className="text-2xl md:text-4xl font-bold text-[#D9B648] font-oswald">
                                                    #{userRank}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!isJoined && event.status === 'active' && !isExpired && (
                                        <button
                                            onClick={isUpcoming ? undefined : onJoin}
                                            disabled={isUpcoming}
                                            className={`px-8 py-4 ${isUpcoming ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-[#D9B648] hover:bg-[#F7EBA5] text-black shadow-[0_0_20px_rgba(255,184,0,0.3)] hover:shadow-[0_0_30px_rgba(255,184,0,0.5)] transform hover:scale-105 active:scale-95'} font-black text-xl rounded-xl transition-all flex items-center justify-center gap-2 w-full md:w-auto`}
                                        >
                                            <UserPlus className="w-6 h-6" />
                                            {isUpcoming ? (
                                                <span className="flex flex-col items-start leading-none gap-0.5">
                                                    <span>KATILIM KAPALI</span>
                                                    <span className="text-[10px] font-medium opacity-80">HENÜZ BAŞLAMADI</span>
                                                </span>
                                            ) : (
                                                "HEMEN KATIL"
                                            )}
                                        </button>
                                    )}

                                    {/* Countdown */}
                                    <div className="w-full flex flex-col gap-3 md:gap-4">
                                        {event.status === 'active' ? (
                                            <div className="flex flex-col items-center">
                                                {isUpcoming && <div className="text-[#D9B648] text-sm font-bold uppercase tracking-widest animate-pulse mb-2">BAŞLIYOR</div>}
                                                <div className="flex justify-center gap-1 lg:gap-3">
                                                    {['GÜN', 'SAAT', 'DAK'].map((label, idx) => {
                                                        const val = idx === 0 ? timeLeft.days : idx === 1 ? timeLeft.hours : timeLeft.minutes
                                                        return (
                                                            <div key={label} className="contents">
                                                                <div className="text-center">
                                                                    <div className="bg-black border-2 border-[#D9B648] rounded-lg px-2 py-1.5 lg:px-3 lg:py-2.5 shadow-lg shadow-[#D9B648]/20">
                                                                        <div className="flex gap-0.5 lg:gap-1">
                                                                            {String(val).padStart(2, '0').split('').map((d, i) => (
                                                                                <div key={i} className="relative w-[18px] h-[28px] lg:w-[24px] lg:h-[40px] overflow-hidden">
                                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black rounded">
                                                                                        <span className="text-xl lg:text-3xl font-bold text-[#D9B648] tabular-nums font-oswald">{d}</span>
                                                                                    </div>
                                                                                    <div className="absolute top-1/2 left-0 right-0 h-[0.5px] lg:h-[1px] bg-black/60 z-10"></div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-[9px] lg:text-xs text-[#F7EBA5] mt-1 lg:mt-1.5 font-bold uppercase tracking-wide">{label}</div>
                                                                </div>
                                                                {idx < 2 && <div className="text-xl lg:text-2xl font-bold text-[#D9B648]/70 self-center pb-4 lg:pb-5 animate-pulse">:</div>}
                                                            </div>
                                                        )
                                                    })}
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
                </div>

                {/* Navigation Buttons */}
                <div className="bg-black border border-[#D9B648]/30 rounded-2xl p-1.5 md:p-2 mx-4 mb-6 flex gap-1 md:gap-2 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'info' ? 'bg-[#D9B648] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        <Info className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                        <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">BİLGİ</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('leaderboard')}
                        className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-[#D9B648] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        <Trophy className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                        <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">SIRALAMA</span>
                    </button>
                    {(isJoined || event.status === 'ended') && (
                        <button
                            onClick={() => setActiveTab('coupons')}
                            className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'coupons' ? 'bg-[#D9B648] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <Ticket className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                            <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">KUPONLAR</span>
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('rewards')}
                        className={`flex-1 min-w-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'rewards' ? 'bg-[#D9B648] text-black shadow-lg' : 'bg-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        <Gift className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                        <span className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap">ÖDÜLLER</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="px-4 pb-28 md:pb-32">
                    {/* INFO TAB */}
                    {activeTab === 'info' && (
                        <div className="space-y-3 md:space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                <div className="bg-black/50 border border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="w-4 h-4 text-[#D9B648]" />
                                        <span className="text-[#D9B648] text-xs md:text-sm font-semibold">Başlangıç - Bitiş Tarihi</span>
                                    </div>
                                    <p className="text-[#F7EBA5] text-sm md:text-base font-medium">
                                        <span>{startDate}</span>
                                        <span className="mx-2 text-gray-500">→</span>
                                        <span>{endDate}</span>
                                    </p>
                                </div>
                                {/* Katılım Tarihi + Katılım Durumu - yan yana (mobil + masaüstü), sarı çizgi ile */}
                                <div className="bg-black/50 border border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                    <div className="flex flex-row items-stretch gap-0 divide-x divide-[#D9B648]">
                                        <div className="flex-1 min-w-0 pr-3 md:pr-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock className="w-4 h-4 text-[#D9B648] shrink-0" />
                                                <span className="text-[#D9B648] text-xs md:text-sm font-semibold">Katılım Tarihi</span>
                                            </div>
                                            <p className="text-[#F7EBA5] text-xs md:text-base font-medium">{joinDateDisplay}</p>
                                        </div>
                                        <div className="flex-1 min-w-0 pl-3 md:pl-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <CheckCircle2 className="w-4 h-4 text-[#D9B648] shrink-0" />
                                                <span className="text-[#D9B648] text-xs md:text-sm font-semibold">Katılım Durumu</span>
                                            </div>
                                            <p className="text-xs md:text-base font-bold text-[#F7EBA5]">{isJoined ? 'Katıldınız' : 'Katılmadınız'}</p>
                                        </div>
                                    </div>
                                </div>
                                {/* Geçerli Bahisler + Yatırım şartı - yan yana, sarı çizgi ile */}
                                <div className="bg-black/50 border border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                    <div className="flex flex-row items-stretch gap-0 divide-x divide-[#D9B648]">
                                        <div className="flex-1 min-w-0 pr-3 md:pr-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <TrendingUp className="w-4 h-4 text-[#D9B648] shrink-0" />
                                                <span className="text-[#D9B648] text-xs md:text-sm font-semibold">Geçerli Bahisler</span>
                                            </div>
                                            <p className="text-[#F7EBA5] text-xs md:text-sm">
                                                <span className="font-medium">Minimum:</span> <span className="font-bold text-[#D9B648] whitespace-nowrap">{event.rules?.min_stake || 100} TL</span>
                                                <span className="mx-2 text-gray-500">|</span>
                                                <span className="font-medium">Maksimum:</span> <span className="font-bold text-[#D9B648]">∞</span>
                                            </p>
                                        </div>
                                        <div className="flex-1 min-w-0 pl-3 md:pl-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Shield className="w-4 h-4 text-[#D9B648] shrink-0" />
                                                <span className="text-[#D9B648] text-xs md:text-sm font-semibold">Yatırım şartı</span>
                                            </div>
                                            <p className="text-[#F7EBA5] text-xs md:text-base font-bold">
                                                {event.rules?.min_deposit != null ? `${Number(event.rules.min_deposit).toLocaleString('tr-TR')} TL` : 'Yok'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {/* Geçerli Bahis Türleri - ayrı kutu, sağda */}
                                <div className="bg-black/50 border border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Trophy className="w-4 h-4 text-[#D9B648]" />
                                        <span className="text-[#D9B648] text-xs md:text-sm font-semibold">Geçerli Bahis Türleri</span>
                                    </div>
                                    <p className="text-[#F7EBA5] text-xs md:text-sm font-medium leading-relaxed">
                                        {(event.rules?.min_odd || 1.5).toFixed(2)}+ oranlı tekli veya kombine bahis. Kombinede her maç en az {(event.rules?.min_odd || 1.5).toFixed(2)} olmalıdır.
                                    </p>
                                </div>
                            </div>

                            {/* Geçerli Ligler - ayrı kutu */}
                            <div className="bg-black/50 border border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield className="w-4 h-4 text-[#D9B648]" />
                                    <span className="text-[#D9B648] text-xs md:text-sm font-semibold">Geçerli Ligler & Karşılaşmalar</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                                    {(() => {
                                        const allowedIds = event.rules?.allowed_league_ids ?? [];

                                        if (allowedIds.length === 0) {
                                            return (
                                                <div className="md:col-span-2 bg-gradient-to-r from-[#D9B648]/10 to-transparent border border-[#D9B648]/20 rounded-lg p-3 md:p-4 flex items-start gap-3">
                                                    <Globe className="w-5 h-5 text-[#D9B648] shrink-0 mt-0.5" />
                                                    <div>
                                                        <div className="text-[#D9B648] text-xs md:text-sm font-bold mb-1">Tüm Spor Dalları ve Ligler</div>
                                                        <div className="text-[#F7EBA5]/80 text-[10px] md:text-xs leading-relaxed">
                                                            Belirtilen tarih aralığında, kurallara uygun şekilde yapılan tüm kuponlar puanlamaya dahil edilir.
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const filteredLeagues = leagues.filter(l => allowedIds.includes(l.id));

                                        // Specific Sport IDs: 1=Football, 2=Basketball, 3=Volleyball, 4=Tennis
                                        const footballLeagues = filteredLeagues.filter(l => l.sport_id === 1 || !l.sport_id);
                                        const basketballLeagues = filteredLeagues.filter(l => l.sport_id === 2);
                                        const volleyballLeagues = filteredLeagues.filter(l => l.sport_id === 3);
                                        const tennisLeagues = filteredLeagues.filter(l => l.sport_id === 4);

                                        if (filteredLeagues.length === 0) return <div className="text-gray-500 text-xs p-2">Yükleniyor...</div>;

                                        return (
                                            <>
                                                {footballLeagues.length > 0 && (
                                                    <div className="bg-black/30 border border-[#D9B648]/20 rounded-lg p-2 md:p-3">
                                                        <div className="text-[#D9B648] text-xs font-bold mb-1">⚽ FUTBOL</div>
                                                        <div className="text-[#F7EBA5] text-[10px] md:text-xs leading-relaxed">
                                                            {footballLeagues.map(l => l.name).join(', ')}
                                                        </div>
                                                    </div>
                                                )}
                                                {basketballLeagues.length > 0 && (
                                                    <div className="bg-black/30 border border-[#D9B648]/20 rounded-lg p-2 md:p-3">
                                                        <div className="text-[#D9B648] text-xs font-bold mb-1">🏀 BASKETBOL</div>
                                                        <div className="text-[#F7EBA5] text-[10px] md:text-xs leading-relaxed">
                                                            {basketballLeagues.map(l => l.name).join(', ')}
                                                        </div>
                                                    </div>
                                                )}
                                                {volleyballLeagues.length > 0 && (
                                                    <div className="bg-black/30 border border-[#D9B648]/20 rounded-lg p-2 md:p-3">
                                                        <div className="text-[#D9B648] text-xs font-bold mb-1">🏐 VOLEYBOL</div>
                                                        <div className="text-[#F7EBA5] text-[10px] md:text-xs leading-relaxed">
                                                            {volleyballLeagues.map(l => l.name).join(', ')}
                                                        </div>
                                                    </div>
                                                )}
                                                {tennisLeagues.length > 0 && (
                                                    <div className="bg-black/30 border border-[#D9B648]/20 rounded-lg p-2 md:p-3">
                                                        <div className="text-[#D9B648] text-xs font-bold mb-1">🎾 TENİS</div>
                                                        <div className="text-[#F7EBA5] text-[10px] md:text-xs leading-relaxed">
                                                            {tennisLeagues.map(l => l.name).join(', ')}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>

                            {/* Turnuva Kuralları - Bilgi kısmının en altında */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] rounded-xl flex items-center justify-center shadow-lg shadow-[#D9B648]/20">
                                        <ScrollText className="md:w-6 md:h-6 text-black" />
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-bold">Turnuva Kuralları</h2>
                                </div>
                                <div className="space-y-4">
                                    {event.content_rules_html?.trim() ? (
                                        <div
                                            className="rounded-xl border border-[#D9B648]/20 bg-black/40 p-4 md:p-6 text-gray-200 text-sm md:text-base leading-relaxed [&_a]:text-[#D9B648] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-[#F7EBA5] [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#F7EBA5] [&_h3]:font-semibold [&_p]:mb-3 [&_strong]:text-[#F7EBA5]"
                                            dangerouslySetInnerHTML={{ __html: event.content_rules_html }}
                                        />
                                    ) : (() => {
                                        const iconMap: Record<string, any> = {
                                            UserPlus, TrendingUp, Ticket, Award, FileText, AlertCircle, Info, Search, Calendar, Clock, Gift, ScrollText
                                        };

                                        const fallbackRules = [
                                            { id: 1, title: 'Nasıl Katılırım?', icon: UserPlus, content: 'Turnuvaya katılmak için "HEMEN KATIL" butonuna tıklamanız yeterlidir. Katılım ücretsizdir ve anında başlayabilirsiniz. Turnuva süresince oynadığınız tüm kuponlar otomatik olarak puan kazandırır.' },
                                            { id: 2, title: 'Puan Nasıl Kazanılır?', icon: TrendingUp, content: 'Puanlarınız kuponlarınızın oranına ve tutarına göre hesaplanır. Yüksek oranlı ve tutarlı kuponlar daha fazla puan kazandırır.' },
                                            { id: 3, title: 'Kupon Kuralları', icon: Ticket, content: 'Sadece futbol ve basketbol maçları geçerlidir. Minimum oran 1.50 olmalıdır.' },
                                            { id: 4, title: 'Ödül Dağıtımı', icon: Award, content: 'Ödüller turnuva bitiminden 48 saat sonra hesabınıza otomatik olarak yatırılır. Şartları sağlayan kullanıcılar ödül havuzundan pay alır.' },
                                            { id: 5, title: 'Genel Şartlar', icon: FileText, content: 'Turnuvaya katılan herkes genel kuralları kabul etmiş sayılır. Hile girişimi tespit edilen kullanıcılar diskalifiye edilir.' }
                                        ];

                                        const displayRules = (event.content_rules && event.content_rules.length > 0)
                                            ? event.content_rules.map((r: any, idx: number) => ({
                                                id: idx + 1,
                                                title: r.title,
                                                content: r.content,
                                                icon: iconMap[r.icon] || Info
                                            }))
                                            : fallbackRules;

                                        return displayRules.map((rule: any) => (
                                            <div key={rule.id} className={`bg-gradient-to-br from-gray-900 to-black border-2 rounded-xl overflow-hidden transition-all ${activeRule === rule.id ? 'border-[#D9B648]' : 'border-[#D9B648]/20'}`}>
                                                <button
                                                    onClick={() => setActiveRule(activeRule === rule.id ? null : rule.id)}
                                                    className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-black/30 transition-all text-left group"
                                                >
                                                    <div className="flex items-center gap-3 md:gap-4 flex-1">
                                                        <div className="relative">
                                                            <div className={`absolute inset-0 bg-[#D9B648] blur-lg opacity-20 ${activeRule === rule.id ? 'opacity-40' : ''}`}></div>
                                                            <div className="relative w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] rounded-xl flex items-center justify-center shadow-lg">
                                                                <rule.icon className="md:w-6 md:h-6 text-black" />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[#D9B648] font-black text-lg md:text-xl">{rule.id}.</span>
                                                                <h3 className="font-bold text-sm md:text-base text-[#F7EBA5]">{rule.title}</h3>
                                                            </div>
                                                            {activeRule !== rule.id && (
                                                                <p className="text-gray-500 text-xs md:text-sm line-clamp-1">Detayları görüntülemek için tıklayın</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronDown className={`md:w-6 md:h-6 text-[#D9B648] transition-transform flex-shrink-0 ml-2 ${activeRule === rule.id ? 'rotate-180' : ''}`} />
                                                </button>

                                                {activeRule === rule.id && (
                                                    <div className="px-4 md:px-5 pb-4 md:pb-5 animate-in slide-in-from-top-2">
                                                        <div className="bg-black/50 rounded-lg p-4 md:p-5 border-l-4 border-[#D9B648] max-h-[50vh] overflow-y-auto pr-2">
                                                            <div className="text-gray-300 text-xs md:text-sm whitespace-pre-line leading-7">
                                                                {rule.content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LEADERBOARD TAB */}
                    {activeTab === 'leaderboard' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            {isJoined && (
                                <div className="mb-8 bg-black border border-[#D9B648]/30 rounded-2xl p-4 md:p-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Trophy className="md:w-7 md:h-7 text-[#D9B648]" />
                                        <div>
                                            <h3 className="text-xl md:text-2xl font-bold text-[#F7EBA5]">İstatistikler</h3>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                        <div className="bg-black rounded-xl p-4 md:p-6 border border-[#D9B648]/30">
                                            <div className="flex items-center gap-2 md:gap-3 mb-2">
                                                <Crown className="w-5 h-5 md:w-6 md:h-6 text-[#D9B648]" />
                                                <span className="text-gray-400 text-xs md:text-sm font-semibold uppercase tracking-wide">SIRALAMA</span>
                                            </div>
                                            <div className="text-3xl md:text-5xl font-black text-[#D9B648]">#{userRank}</div>
                                            <div className="mt-2 text-gray-500 text-xs md:text-sm">İlk {leaderboard.length} arasında</div>
                                        </div>
                                        <div className="bg-black rounded-xl p-4 md:p-6 border border-[#D9B648]/30">
                                            <div className="flex items-center gap-2 md:gap-3 mb-2">
                                                <Trophy className="w-5 h-5 md:w-6 md:h-6 text-[#D9B648]" />
                                                <span className="text-gray-400 text-xs md:text-sm font-semibold uppercase tracking-wide">TOPLAM PUAN</span>
                                            </div>
                                            <div className="text-3xl md:text-5xl font-black text-[#F7EBA5]">{(Math.floor(userPoints * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                                            <div className="mt-2 text-gray-500 text-xs md:text-sm">Devam ediyor</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 mb-6">
                                <Crown className="md:w-7 md:h-7 text-[#D9B648]" />
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold">Liderlik Tablosu</h2>
                                    <p className="text-gray-400 text-xs md:text-sm">Turnuvanın en yüksek puanlı {leaderboard.length} katılımcısı</p>
                                </div>
                            </div>

                            {loadingLeaderboard ? (
                                <div className="flex justify-center p-12">
                                    <Loader2 className="w-10 h-10 text-[#D9B648] animate-spin" />
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <div className="text-center p-8 text-gray-500">Henüz sıralama verisi yok.</div>
                            ) : (
                                <>
                                    {
                                        leaderboard.length > 0 ? (
                                            <>
                                                {/* Podium for Top 3 */}
                                                <div className="relative py-8 md:py-12 mb-8">
                                                    <div className="flex justify-center items-end gap-2 md:gap-4">
                                                        {/* 2nd Place */}
                                                        {leaderboard[1] && (
                                                            <div className="flex flex-col items-center">
                                                                <div className="relative mb-2 md:mb-4">
                                                                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] flex items-center justify-center text-base md:text-2xl font-bold border-2 md:border-4 border-black shadow-xl text-black">
                                                                        {getInitials(leaderboard[1].username)}
                                                                    </div>
                                                                </div>
                                                                <div className="text-center mb-2">
                                                                    <div className="font-bold text-xs md:text-base text-gray-300">{leaderboard[1].username}</div>
                                                                    <div className="text-[#E0E0E0] font-bold text-xs md:text-base">{(Math.floor(leaderboard[1].score * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                                                                </div>
                                                                <div className="rounded-t-xl flex items-center justify-center text-2xl md:text-5xl font-bold bg-gradient-to-b from-gray-700 to-gray-800 w-20 h-16 md:w-32 md:h-28 text-[#E0E0E0] border-t border-x border-[#E0E0E0]/30 shadow-[0_-5px_20px_rgba(224,224,224,0.1)]">2</div>
                                                            </div>
                                                        )}

                                                        {/* 1st Place */}
                                                        {leaderboard[0] && (
                                                            <div className="flex flex-col items-center z-10">
                                                                <div className="relative mb-2 md:mb-4 scale-110">
                                                                    <Crown className="w-8 h-8 absolute -top-8 md:-top-10 left-1/2 -translate-x-1/2 text-[#D9B648] drop-shadow-[0_0_10px_rgba(255,184,0,0.5)] animate-bounce" />
                                                                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] flex items-center justify-center text-base md:text-2xl font-bold border-2 md:border-4 border-black shadow-[0_0_20px_rgba(255,184,0,0.4)] text-black relative z-10">
                                                                        {getInitials(leaderboard[0].username)}
                                                                    </div>
                                                                </div>
                                                                <div className="text-center mb-2">
                                                                    <div className="font-bold text-xs md:text-base text-gray-200">{leaderboard[0].username}</div>
                                                                    <div className="text-[#D9B648] font-bold text-xs md:text-base">{(Math.floor(leaderboard[0].score * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                                                                </div>
                                                                <div className="rounded-t-xl flex items-center justify-center text-3xl md:text-6xl font-bold bg-gradient-to-b from-yellow-600 to-yellow-800 w-24 h-24 md:w-36 md:h-40 text-[#D9B648] border-t border-x border-[#D9B648]/30 shadow-[0_-10px_30px_rgba(255,184,0,0.2)]">1</div>
                                                            </div>
                                                        )}

                                                        {/* 3rd Place */}
                                                        {leaderboard[2] && (
                                                            <div className="flex flex-col items-center">
                                                                <div className="relative mb-2 md:mb-4">
                                                                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#CD7F32] to-[#8B4513] flex items-center justify-center text-base md:text-2xl font-bold border-2 md:border-4 border-black shadow-xl text-[#F7EBA5]">
                                                                        {getInitials(leaderboard[2].username)}
                                                                    </div>
                                                                </div>
                                                                <div className="text-center mb-2">
                                                                    <div className="font-bold text-xs md:text-base text-gray-300">{leaderboard[2].username}</div>
                                                                    <div className="text-[#CD7F32] font-bold text-xs md:text-base">{(Math.floor(leaderboard[2].score * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                                                                </div>
                                                                <div className="rounded-t-xl flex items-center justify-center text-2xl md:text-5xl font-bold bg-gradient-to-b from-amber-800 to-amber-900 w-20 h-12 md:w-32 md:h-20 text-[#CD7F32] border-t border-x border-[#CD7F32]/30 shadow-[0_-5px_20px_rgba(205,127,50,0.1)]">3</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Ranks 4-100 List */}
                                                {leaderboard.length > 3 && (
                                                    <div className="bg-black rounded-xl border border-[#D9B648]/30 overflow-hidden mb-8">
                                                        {leaderboard.slice(3, 100).map((user, idx) => {
                                                            const rank = idx + 4;
                                                            const initial = user.username ? user.username.substring(0, 2).toUpperCase() : "??";
                                                            // Using the generic brown/bronze rank color for 4+ as requested or similar to previous
                                                            const rankColor = 'from-[#5a4a2a] to-[#3a2a1a] text-[#F7EBA5]';

                                                            return (
                                                                <div key={idx} className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 hover:bg-black/50 transition-all border-b border-[#D9B648]/30 last:border-none">
                                                                    <div className="flex items-center gap-2 md:gap-4">
                                                                        <div className="w-8 h-8 md:w-12 md:h-12 bg-black border border-[#D9B648]/30 rounded-full flex items-center justify-center text-gray-300 font-bold text-xs md:text-base">
                                                                            {rank}
                                                                        </div>
                                                                        <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-br ${rankColor} flex items-center justify-center font-bold text-sm md:text-lg shadow-lg`}>
                                                                            {initial}
                                                                        </div>
                                                                        <div className="font-medium text-gray-200 text-sm md:text-base">
                                                                            {user.username}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-base md:text-xl font-bold text-[#F7EBA5]">
                                                                        {(Math.floor((user.score || 0) * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </>
                                        ) : null
                                    }

                                    {/* Fixed User Rank Footer */}
                                    {isJoined && (
                                        <div className="mt-6 mb-20 md:mb-0 bg-black rounded-xl border-2 border-[#D9B648] overflow-hidden sticky bottom-[72px] md:bottom-0 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 md:px-6 py-4 md:py-5">
                                                <div className="flex items-center gap-3 md:gap-4">
                                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-black border-2 border-[#D9B648] rounded-full flex items-center justify-center text-[#D9B648] font-bold text-sm md:text-base shadow-[0_0_10px_rgba(255,184,0,0.3)]">
                                                        {userRank || '-'}
                                                    </div>
                                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] flex items-center justify-center font-bold text-base md:text-lg text-black shadow-lg">
                                                        {username ? username.substring(0, 2).toUpperCase() : 'ME'}
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Senin Sıran</div>
                                                        <div className="text-[#D9B648] font-bold text-sm md:text-base">#{userRank || '-'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-center sm:text-right">
                                                    <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Puanın</div>
                                                    <div className="text-lg md:text-xl font-bold text-[#F7EBA5]">{userPoints.toLocaleString('tr-TR')}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Reward Winners Section - Only for ended tournaments */}
                                    {event.status === 'ended' && (
                                        <div className="mt-8">
                                            <div className="flex items-center gap-3 mb-4">
                                                <Gift className="w-5 h-5 md:w-6 md:h-6 text-[#D9B648]" />
                                                <div>
                                                    <h3 className="text-lg md:text-xl font-bold text-[#F7EBA5]">Ödül Kazananlar</h3>
                                                    <p className="text-gray-400 text-xs md:text-sm">Bu turnuvada ödül alan kullanıcılar</p>
                                                </div>
                                            </div>

                                            {loadingRewardWinners ? (
                                                <div className="flex justify-center p-8">
                                                    <Loader2 className="w-8 h-8 text-[#D9B648] animate-spin" />
                                                </div>
                                            ) : rewardWinners.length === 0 ? (
                                                <div className="bg-black rounded-xl border border-[#D9B648]/30 p-6 text-center">
                                                    <div className="text-gray-500 text-sm italic">Henüz ödül dağıtımı yapılmamış.</div>
                                                </div>
                                            ) : (
                                                <div className="bg-black rounded-xl border border-[#D9B648]/30 overflow-hidden">
                                                    {rewardWinners.map((winner, idx) => {
                                                        const rawRType = String(winner.reward_type || '').toLowerCase();
                                                        const isSpin = rawRType.includes('spin');
                                                        const rewardTypeLabel = rawRType.includes('cash') ? '💰 Nakit' :
                                                            rawRType.includes('freebet') || rawRType.includes('bet') ? '🎟️ Freebet' :
                                                                isSpin ? '🎰 Spin' :
                                                                    rawRType.includes('bonus') ? '🎁 Bonus' : '🏆 Ödül';

                                                        const criteriaLabel = winner.criteria_type === 'rank_exact' ? `${winner.criteria_value}. Sıra` :
                                                            winner.criteria_type === 'rank' ? `İlk ${winner.criteria_value}` :
                                                                winner.criteria_type === 'min_points' ? `${winner.criteria_value}+ Puan` : '';

                                                        return (
                                                            <div key={idx} className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-[#D9B648]/20 last:border-none hover:bg-[#D9B648]/5 transition-all">
                                                                <div className="flex items-center gap-2 md:gap-4">
                                                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#D9B648]/30 to-[#F7EBA5]/10 border border-[#D9B648]/40 flex items-center justify-center text-[#D9B648] font-bold text-xs md:text-sm">
                                                                        {winner.username ? winner.username.substring(0, 2).toUpperCase() : '??'}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-medium text-gray-200 text-sm md:text-base">
                                                                            {winner.username}
                                                                        </div>
                                                                        <div className="text-gray-500 text-[10px] md:text-xs">{criteriaLabel}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-sm md:text-base font-bold text-[#D9B648]">
                                                                        {Number(String(winner.amount).replace(/[₺TL]/g, '')).toLocaleString('tr-TR')}{isSpin ? '' : '₺'}
                                                                    </div>
                                                                    <div className="text-gray-500 text-[10px] md:text-xs">{rewardTypeLabel}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Total Summary */}
                                                    <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 bg-[#D9B648]/10 border-t border-[#D9B648]/30">
                                                        <div className="text-gray-300 text-xs md:text-sm font-semibold uppercase tracking-wide">
                                                            Toplam {rewardWinners.length} kişi ödül aldı
                                                        </div>
                                                        <div className="text-[#D9B648] font-bold text-sm md:text-base">
                                                            {rewardWinners.reduce((sum, w) => sum + Number(String(w.amount || '0').replace(/[₺TL]/g, '')), 0).toLocaleString('tr-TR')}{rewardWinners.some(w => String(w.reward_type || '').toLowerCase().includes('spin')) ? '' : '₺'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* COUPONS TAB */}
                    {activeTab === 'coupons' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#D9B648] to-[#F7EBA5] rounded-xl flex items-center justify-center shadow-lg shadow-[#D9B648]/20">
                                    <Ticket className="md:w-6 md:h-6 text-black" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold">Kuponlar</h2>
                                </div>
                            </div>
                            <div className="mb-6 text-center">
                                <p className="text-gray-400 text-sm">Bu sayfada yalnızca kazanan kuponlar görüntülenmektedir.</p>
                            </div>
                            <div className="mb-6 bg-gradient-to-br from-[#D9B648]/20 via-[#D9B648]/10 to-black border-2 border-[#D9B648] rounded-xl p-6 text-center">
                                <div className="text-gray-400 text-sm mb-2">Toplam Puan:</div>
                                <div className="text-5xl md:text-6xl font-black text-[#D9B648]">{(Math.floor(userPoints * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                            </div>

                            {/* Search */}
                            <div className="mb-6">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Birden fazla kupon aramak için virgül (,) ile ayırınız (Örneğin; 6001673730, 6001673731)"
                                        className="w-full bg-black border-2 border-[#D9B648]/30 rounded-lg pl-12 pr-4 py-3 text-[#F7EBA5] placeholder-gray-600 text-sm focus:outline-none focus:border-[#D9B648] transition-colors"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="mt-3 text-gray-500 text-xs">
                                    * Bahis ID ile arama yapabilirsiniz.
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-black border-2 border-[#D9B648]/30 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gradient-to-r from-[#D9B648]/10 to-black border-b-2 border-[#D9B648]/30">
                                            <tr>
                                                <th className="text-left py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">İşlem No</th>
                                                <th className="text-left py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Bahis ID</th>
                                                <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold hidden md:table-cell">Tarih</th>
                                                <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Bahis Miktarı</th>
                                                <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Oran</th>
                                                <th className="text-center py-4 px-4 text-gray-400 text-xs md:text-sm font-bold hidden lg:table-cell">Tür</th>
                                                <th className="text-right py-4 px-4 text-gray-400 text-xs md:text-sm font-bold">Elde Edilen Puan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingCoupons ? (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-[#F7EBA5]"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D9B648]" /></td>
                                                </tr>
                                            ) : filteredCoupons.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-gray-500 italic">Kupon bulunamadı.</td>
                                                </tr>
                                            ) : (
                                                filteredCoupons.map((coupon, idx) => {
                                                    const isWon = coupon.state?.toLowerCase() === 'won';
                                                    const isLost = coupon.state?.toLowerCase() === 'lost';

                                                    let dotClass = "bg-gray-600";
                                                    if (isWon) dotClass = "bg-[#D9B648] shadow-lg shadow-[#D9B648]/50";

                                                    const selections = coupon.bet_data?.Selections || [];

                                                    return (
                                                        <tr
                                                            key={idx}
                                                            className="border-b border-[#D9B648]/10 hover:bg-[#D9B648]/5 transition-colors cursor-pointer group"
                                                            onClick={() => setSelectedCoupon(coupon)}
                                                        >
                                                            <td className="py-4 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}></div>
                                                                    <span className="text-[#F7EBA5] font-bold text-sm md:text-base">{filteredCoupons.length - idx}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4"><span className="text-gray-300 font-mono text-xs md:text-sm">{coupon.bet_id}</span></td>
                                                            <td className="py-4 px-4 text-center text-xs text-gray-400 hidden md:table-cell">
                                                                <div className="flex flex-col items-center">
                                                                    <span>{parseUtcDate(coupon.created_at).toLocaleDateString('tr-TR')}</span>
                                                                    <span className="text-[10px]">{parseUtcDate(coupon.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 text-center"><span className="text-[#F7EBA5] font-semibold text-sm md:text-base">{coupon.stake}₺</span></td>
                                                            <td className="py-4 px-4 text-center"><span className="px-2 md:px-3 py-1 bg-[#D9B648]/20 text-[#D9B648] rounded-full text-xs md:text-sm font-bold">{coupon.odds}</span></td>
                                                            <td className="py-4 px-4 text-center hidden lg:table-cell">
                                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                    {selections.length > 1 ? 'Kombine' : 'Tekli'}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-4 text-right">
                                                                <span className="text-lg md:text-xl font-black text-[#D9B648]">
                                                                    {(Math.floor((coupon.calculation || 0) * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Coupon Detail Modal */}
                            {selectedCoupon && (() => {
                                const c = selectedCoupon;
                                const cIsWon = c.state?.toLowerCase() === 'won';
                                const cIsLost = c.state?.toLowerCase() === 'lost';
                                const cStatusLabel = cIsWon ? 'KAZANDI' : 'KAYBETTİ';
                                const cStatusClass = cIsWon ? 'bg-[#D9B648] text-black' : 'bg-red-600 text-[#F7EBA5]';
                                const cSelections = c.bet_data?.Selections || [];
                                const cEstimatedWinning = (Number(c.stake) * Number(c.odds)).toFixed(2);

                                return (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCoupon(null)}>
                                        {/* Backdrop */}
                                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

                                        {/* Modal */}
                                        <div
                                            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border-2 border-[#D9B648]/40 rounded-2xl shadow-2xl shadow-[#D9B648]/10"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {/* Header */}
                                            <div className="sticky top-0 z-10 flex items-center justify-between p-4 md:p-5 bg-[#0a0a0a] border-b border-[#D9B648]/30">
                                                <div>
                                                    <h3 className="text-lg md:text-xl font-bold text-[#F7EBA5]">Kupon Detayı</h3>
                                                    <p className="text-gray-500 text-xs font-mono">#{c.bet_id}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedCoupon(null)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                                >
                                                    <X className="w-4 h-4 text-[#F7EBA5]" />
                                                </button>
                                            </div>

                                            <div className="p-4 md:p-6">
                                                {/* Stats Grid */}
                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    <div className="bg-black/70 border-2 border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                                        <div className="text-xs text-gray-400 mb-1">Bahis Miktarı</div>
                                                        <div className="text-lg md:text-2xl font-bold text-[#F7EBA5]">{Number(c.stake).toLocaleString('tr-TR')}₺</div>
                                                    </div>
                                                    <div className="bg-black/70 border-2 border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                                        <div className="text-xs text-gray-400 mb-1">Toplam Oran</div>
                                                        <div className="text-lg md:text-2xl font-bold text-[#D9B648]">{c.odds}</div>
                                                    </div>
                                                    <div className="bg-black/70 border-2 border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                                        <div className="text-xs text-gray-400 mb-1">Tahmini Kazanç</div>
                                                        <div className="text-lg md:text-2xl font-bold text-[#D9B648]">{Number(cEstimatedWinning).toLocaleString('tr-TR')}₺</div>
                                                    </div>
                                                    <div className="bg-black/70 border-2 border-[#D9B648]/30 rounded-lg p-3 md:p-4">
                                                        <div className="text-xs text-gray-400 mb-1">Turnuva Puanı</div>
                                                        <div className="text-lg md:text-2xl font-bold text-[#D9B648]">+{c.calculation || 0}</div>
                                                    </div>
                                                </div>

                                                {/* Status */}
                                                <div className="mb-4 bg-black/70 border-2 border-[#D9B648]/30 rounded-lg p-4">
                                                    <div className="text-xs text-gray-400 mb-1">Durum</div>
                                                    <div className={`inline-block px-4 py-2 rounded-lg font-bold text-sm ${cStatusClass}`}>{cStatusLabel}</div>
                                                </div>

                                                {/* Matches */}
                                                {cSelections.length > 0 ? (
                                                    <div>
                                                        <h4 className="text-base md:text-lg font-bold mb-3 text-[#D9B648]">Maçlar ({cSelections.length})</h4>
                                                        <div className="space-y-3">
                                                            {cSelections.map((sel: any, i: number) => {
                                                                const selStateName = (sel.StateName || '').toLowerCase();
                                                                const selWon = sel.State === 4 || selStateName === 'won';
                                                                const selLost = sel.State === 3 || selStateName === 'lost';
                                                                const selLabel = selWon ? 'KAZANDI' : selLost ? 'KAYBETTİ' : '-';
                                                                const selCls = selWon ? 'bg-[#D9B648] text-black' : selLost ? 'bg-red-600 text-[#F7EBA5]' : 'bg-gray-700 text-gray-300';
                                                                const selBorder = selWon ? 'rgb(255, 184, 0)' : selLost ? 'rgb(220, 38, 38)' : 'rgb(100, 100, 100)';

                                                                return (
                                                                    <div key={i} className="bg-black/70 rounded-lg p-3 md:p-4 border-l-4 hover:bg-black/50 transition-colors" style={{ borderLeftColor: selBorder }}>
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <div>
                                                                                <div className="font-bold text-sm md:text-base text-[#F7EBA5]">{sel.MatchName || 'Bilinmiyor'}</div>
                                                                                <div className="text-xs text-gray-400">{sel.CompetitionName || sel.SportName || ''}</div>
                                                                            </div>
                                                                            <div className="font-bold text-sm md:text-base text-[#D9B648]">@{sel.Price || '-'}</div>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="text-xs md:text-sm">
                                                                                <span className="text-gray-400">Bahis: </span>
                                                                                <span className="font-semibold text-[#F7EBA5]">{sel.DisplaySelectionName || sel.SelectionName || '-'}</span>
                                                                                {(sel.DisplayMarketName || sel.MarketName) && (
                                                                                    <span className="text-gray-500 ml-2">({sel.DisplayMarketName || sel.MarketName})</span>
                                                                                )}
                                                                            </div>
                                                                            <div className={`text-[10px] md:text-xs px-2 py-1 rounded font-bold ${selCls}`}>{selLabel}</div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-gray-500 italic text-sm">Maç detayı bulunamadı.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* REWARDS TAB */}
                    {activeTab === 'rewards' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-3 mb-6 md:mb-8">
                                <Gift className="md:w-7 md:h-7 text-[#D9B648]" />
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold">Ödüller</h2>
                                </div>
                            </div>
                            <div className="bg-black rounded-2xl p-6 md:p-8 mb-6 md:mb-8 text-center border-2 border-[#D9B648]">
                                <div className="text-[#D9B648]/80 text-xs md:text-sm mb-2 md:mb-3 uppercase tracking-wide font-semibold">Toplam Ödül Havuzu</div>
                                <div className="text-3xl md:text-5xl lg:text-6xl font-black text-[#D9B648] drop-shadow-[0_0_12px_rgba(255,184,0,0.4)]">
                                    ₺<CountUpAnimation target={totalPrize} />
                                </div>
                            </div>

                            {/* Top 3 Rewards */}
                            {top3.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                                    {top3.map((reward: any, idx: number) => {
                                        let bgClass = "from-[#3a2a1a] to-[#2a1a0a]";
                                        if (reward.criteria_value === 1) bgClass = "from-[#5a4a2a] to-[#3a2a1a]";

                                        return (
                                            <div key={idx} className={`bg-gradient-to-br ${bgClass} rounded-xl p-4 md:p-6 text-center border border-[#D9B648]/30`}>
                                                <div className="text-gray-300 text-xs md:text-sm mb-2 font-semibold">{getRewardLabel(reward)}</div>
                                                <div className="text-3xl md:text-5xl font-black text-[#D9B648]">{(reward.reward_type || '').toLowerCase().includes('spin') ? '' : '₺'}<CountUpAnimation target={Number(reward.amount)} /></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Other Rewards */}
                            {otherRewards.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                                    {otherRewards.map((reward: any, idx: number) => (
                                        <div key={idx} className="bg-black rounded-xl p-4 md:p-6 text-center border border-[#D9B648]/50">
                                            <div className="text-[#D9B648]/70 text-xs md:text-sm mb-2 font-semibold">{getRewardLabel(reward)}</div>
                                            <div className="text-2xl md:text-3xl font-bold text-[#D9B648]">{(reward.reward_type || '').toLowerCase().includes('spin') ? '' : '₺'}<CountUpAnimation target={Number(reward.amount)} /></div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {top3.length === 0 && otherRewards.length === 0 && (
                                <div className="text-center p-8 bg-black border border-[#D9B648]/30 rounded-xl">
                                    <p className="text-gray-400">Henüz ödül bilgisi girilmemiş.</p>
                                </div>
                            )}

                        </div>
                    )}

                </div>
            </div>
        </div>

    )
}
