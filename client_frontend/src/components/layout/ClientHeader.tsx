import { Trophy, LogOut, LayoutGrid, Zap, Calendar, CheckSquare, BarChart3, Star, CheckCircle2, Award } from "lucide-react"
import logo from "../../assets/logo.png"

interface ClientHeaderProps {
    username: string | null
    activeCategory?: string
    onCategoryChange?: (category: string) => void
}

export function ClientHeader({ username, activeCategory = 'all', onCategoryChange }: ClientHeaderProps) {
    return (
        <nav className="border-b border-primary/20 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-2 md:gap-4">
                {/* Logo Section */}
                <div className="hidden md:flex flex-shrink-0 items-center gap-2 group cursor-pointer" onClick={() => window.location.href = '/'}>
                    <img src={logo} alt="Extrabet Logo" className="h-8 md:h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
                </div>

                {/* Mobile Navigation - Compact Static (User Provided HTML) */}
                <div className="md:hidden bg-black border-b border-[#FFB800]/30 py-1 px-0.5 w-full">
                    <div className="flex items-center justify-between gap-0.5">
                        <div className="flex-shrink-0 px-0.5">
                            <img src={logo} alt="Logo" className="h-5 w-auto object-contain" />
                        </div>
                        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
                            <button
                                onClick={() => onCategoryChange?.('all')}
                                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0 px-1.5 py-0.5 rounded font-bold text-[7px] transition-all border border-[#FFB800] ${activeCategory === 'all' ? 'bg-[#FFB800] text-black' : 'bg-black text-white hover:bg-[#FFB800]/10'}`}
                            >
                                <LayoutGrid size={10} />
                                <span>TÜMÜ</span>
                            </button>
                            <button
                                onClick={() => onCategoryChange?.('active')}
                                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0 px-1.5 py-0.5 rounded font-bold text-[7px] transition-all border border-[#FFB800] ${activeCategory === 'active' ? 'bg-[#FFB800] text-black' : 'bg-black text-white hover:bg-[#FFB800]/10'}`}
                            >
                                <CheckCircle2 size={10} />
                                <span>AKTİF</span>
                            </button>
                            <button
                                onClick={() => onCategoryChange?.('upcoming')}
                                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0 px-1.5 py-0.5 rounded font-bold text-[7px] transition-all border border-[#FFB800] ${activeCategory === 'upcoming' ? 'bg-[#FFB800] text-black' : 'bg-black text-white hover:bg-[#FFB800]/10'}`}
                            >
                                <Calendar size={10} />
                                <span>YAKINDA</span>
                            </button>
                            <button
                                onClick={() => onCategoryChange?.('finished')}
                                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0 px-1.5 py-0.5 rounded font-bold text-[7px] transition-all border border-[#FFB800] ${activeCategory === 'finished' ? 'bg-[#FFB800] text-black' : 'bg-black text-white hover:bg-[#FFB800]/10'}`}
                            >
                                <Award size={10} />
                                <span className="text-[6px]">SONUÇ.</span>
                            </button>
                            <button
                                onClick={() => onCategoryChange?.('report')}
                                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0 px-1.5 py-0.5 rounded font-bold text-[7px] transition-all border border-[#FFB800] ${activeCategory === 'report' ? 'bg-[#FFB800] text-black' : 'bg-black text-white hover:bg-[#FFB800]/10'}`}
                            >
                                <BarChart3 size={10} />
                                <span className="text-[6px]">RAPOR</span>
                            </button>
                            <button
                                onClick={() => onCategoryChange?.('enrollments')}
                                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0 px-1.5 py-0.5 rounded font-bold text-[7px] transition-all border border-[#FFB800] ${activeCategory === 'enrollments' ? 'bg-[#FFB800] text-black' : 'bg-black text-white hover:bg-[#FFB800]/10'}`}
                            >
                                <Trophy size={10} />
                                <span className="text-[6px]">KAYIT</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-1">
                    <button
                        onClick={() => onCategoryChange?.('all')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeCategory === 'all' ? 'bg-[#FFB800] text-black hover:bg-[#FFB800]/90' : 'text-white hover:bg-white/10'}`}
                    >
                        <LayoutGrid size={16} /> TÜMÜ
                    </button>
                    <button
                        onClick={() => onCategoryChange?.('active')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeCategory === 'active' ? 'bg-[#FFB800] text-black hover:bg-[#FFB800]/90' : 'text-white hover:bg-white/10'}`}
                    >
                        <Zap size={16} /> AKTİF
                    </button>
                    <button
                        onClick={() => onCategoryChange?.('upcoming')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeCategory === 'upcoming' ? 'bg-[#FFB800] text-black hover:bg-[#FFB800]/90' : 'text-white hover:bg-white/10'}`}
                    >
                        <Calendar size={16} /> YAKINDA
                    </button>
                    <button
                        onClick={() => onCategoryChange?.('finished')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeCategory === 'finished' ? 'bg-[#FFB800] text-black hover:bg-[#FFB800]/90' : 'text-white hover:bg-white/10'}`}
                    >
                        <CheckSquare size={16} /> SONUÇLANAN
                    </button>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onCategoryChange?.('report')}
                        className={`hidden lg:flex items-center gap-2 border border-primary/30 px-5 py-2.5 rounded-lg font-black text-sm transition-all ${activeCategory === 'report' ? 'bg-primary text-black' : 'text-white hover:bg-primary/10'}`}
                    >
                        <BarChart3 className={`h-4 w-4 ${activeCategory === 'report' ? 'text-black' : 'text-primary'}`} /> TURNUVA RAPORUM
                    </button>
                    <button
                        onClick={() => onCategoryChange?.('enrollments')}
                        className={`hidden lg:flex items-center gap-2 border border-primary/30 px-5 py-2.5 rounded-lg font-black text-sm transition-all ${activeCategory === 'enrollments' ? 'bg-primary text-black' : 'text-white hover:bg-primary/10'}`}
                    >
                        <Star className={`h-4 w-4 ${activeCategory === 'enrollments' ? 'text-black fill-black/20' : 'text-primary fill-primary/20'}`} /> KATILDIĞIM TURNUVALAR
                    </button>

                    {username && (
                        <div className="hidden md:flex items-center gap-4 pl-6 border-l border-white/10 ml-3">
                            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-black font-black shadow-[0_0_15px_rgba(255,188,0,0.3)]">
                                {username[0].toUpperCase()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    )
}
