import { Trophy, LogOut, LayoutGrid, Zap, Calendar, CheckSquare, BarChart3, Star, CheckCircle2, Award } from "lucide-react"
import logo from "../../assets/logo.png"

interface ClientHeaderProps {
    username: string | null
}

export function ClientHeader({ username }: ClientHeaderProps) {
    return (
        <nav className="border-b border-primary/20 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-2 md:gap-4">
                {/* Logo Section */}
                <div className="flex-shrink-0 flex items-center gap-2 group cursor-pointer" onClick={() => window.location.href = '/'}>
                    <img src={logo} alt="Extrabet Logo" className="h-8 md:h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
                </div>

                {/* Mobile Navigation - Compact Static */}
                <div className="flex md:hidden items-center justify-center gap-1 overflow-x-auto scrollbar-hide">
                    <button className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded font-bold text-[8px] transition-all border border-[#FFB800] bg-[#FFB800] text-black shadow-[0_0_10px_rgba(255,184,0,0.3)] min-w-[36px]">
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="leading-none mt-0.5">TÜMÜ</span>
                    </button>
                    <button className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded font-bold text-[8px] transition-all border border-[#FFB800]/50 bg-black text-white hover:bg-[#FFB800]/20 min-w-[36px]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        <span className="leading-none mt-0.5">AKTİF</span>
                    </button>
                    <button className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded font-bold text-[8px] transition-all border border-[#FFB800]/50 bg-black text-white hover:bg-[#FFB800]/20 min-w-[36px]">
                        <Calendar className="h-3.5 w-3.5 text-white" />
                        <span className="leading-none mt-0.5">YAKINDA</span>
                    </button>
                    <button className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded font-bold text-[8px] transition-all border border-[#FFB800]/50 bg-black text-white hover:bg-[#FFB800]/20 min-w-[36px]">
                        <Award className="h-3.5 w-3.5 text-white" />
                        <span className="leading-none mt-0.5 text-[7px]">SONUÇ.</span>
                    </button>
                    <button className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded font-bold text-[8px] transition-all border border-[#FFB800]/50 bg-black text-white hover:bg-[#FFB800]/20 min-w-[36px]">
                        <BarChart3 className="h-3.5 w-3.5 text-white" />
                        <span className="leading-none mt-0.5 text-[7px]">RAPOR</span>
                    </button>
                    <button className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded font-bold text-[8px] transition-all border border-[#FFB800]/50 bg-black text-white hover:bg-[#FFB800]/20 min-w-[36px]">
                        <Trophy className="h-3.5 w-3.5 text-white" />
                        <span className="leading-none mt-0.5 text-[7px]">KAYIT</span>
                    </button>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-1">
                    <button className="flex items-center gap-2 bg-primary text-black px-5 py-2.5 rounded-lg font-black text-sm transition-all shadow-[0_0_20px_rgba(255,188,0,0.2)]">
                        <LayoutGrid className="h-4 w-4" /> TÜMÜ
                    </button>
                    <button className="flex items-center gap-2 text-white hover:bg-white/5 px-5 py-2.5 rounded-lg font-black text-sm transition-all border border-primary/30 ml-2">
                        <Zap className="h-4 w-4 text-primary" /> AKTİF
                    </button>
                    <button className="flex items-center gap-2 text-white hover:bg-white/5 px-5 py-2.5 rounded-lg font-black text-sm transition-all border border-primary/30 ml-1">
                        <Calendar className="h-4 w-4 text-primary" /> YAKINDA
                    </button>
                    <button className="flex items-center gap-2 text-white hover:bg-white/5 px-5 py-2.5 rounded-lg font-black text-sm transition-all border border-primary/30 ml-1">
                        <CheckSquare className="h-4 w-4 text-primary" /> SONUÇLANAN
                    </button>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    <button className="hidden lg:flex items-center gap-2 text-white border border-primary/30 hover:bg-primary/10 px-5 py-2.5 rounded-lg font-black text-sm transition-all">
                        <BarChart3 className="h-4 w-4 text-primary" /> TURNUVA RAPORUM
                    </button>
                    <button className="hidden lg:flex items-center gap-2 text-white border border-primary/30 hover:bg-primary/10 px-5 py-2.5 rounded-lg font-black text-sm transition-all">
                        <Star className="h-4 w-4 text-primary fill-primary/20" /> KATILDIĞIM TURNUVALAR
                    </button>

                    {username && (
                        <div className="flex items-center gap-4 pl-0 md:pl-6 md:border-l border-white/10 ml-0 md:ml-3">
                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-primary flex items-center justify-center text-black font-black shadow-[0_0_15px_rgba(255,188,0,0.3)] text-xs md:text-base">
                                {username[0].toUpperCase()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    )
}
