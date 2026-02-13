import { Trophy, LogOut, LayoutGrid, Zap, Calendar, CheckSquare, BarChart3, Star } from "lucide-react"
import logo from "../../assets/logo.png"

interface ClientHeaderProps {
    username: string | null
}

export function ClientHeader({ username }: ClientHeaderProps) {
    return (
        <nav className="border-b border-primary/20 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-4">
                {/* Logo Section */}
                <div className="flex-shrink-0 flex items-center gap-2 group cursor-pointer" onClick={() => window.location.href = '/'}>
                    <img src={logo} alt="Extrabet Logo" className="h-8 md:h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
                </div>

                {/* Navigation Menu - Scrollable on Mobile */}
                <div className="flex-1 flex items-center gap-2 overflow-x-auto pr-4 md:pr-0 md:justify-center [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    <button className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 bg-primary text-black px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm transition-all shadow-[0_0_20px_rgba(255,188,0,0.2)]">
                        <LayoutGrid className="h-3 w-3 md:h-4 md:w-4" /> TÜMÜ
                    </button>
                    <button className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-white hover:bg-white/5 px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm transition-all border border-primary/30">
                        <Zap className="h-3 w-3 md:h-4 md:w-4 text-primary" /> AKTİF
                    </button>
                    <button className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-white hover:bg-white/5 px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm transition-all border border-primary/30">
                        <Calendar className="h-3 w-3 md:h-4 md:w-4 text-primary" /> YAKINDA
                    </button>
                    <button className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-white hover:bg-white/5 px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm transition-all border border-primary/30">
                        <CheckSquare className="h-3 w-3 md:h-4 md:w-4 text-primary" /> SONUÇLANAN
                    </button>

                    {/* Moved from Right Actions to here for mobile scroll */}
                    <button className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-white border border-primary/30 hover:bg-primary/10 px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm transition-all">
                        <BarChart3 className="h-3 w-3 md:h-4 md:w-4 text-primary" /> TURNUVA RAPORUM
                    </button>
                    <button className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-white border border-primary/30 hover:bg-primary/10 px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm transition-all">
                        <Star className="h-3 w-3 md:h-4 md:w-4 text-primary fill-primary/20" /> KATILDIĞIM TURNUVALAR
                    </button>
                </div>

                {/* User Profile */}
                {username && (
                    <div className="flex-shrink-0 flex items-center gap-4 pl-0 md:pl-6 md:border-l border-white/10 md:ml-3">
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-primary flex items-center justify-center text-black font-black shadow-[0_0_15px_rgba(255,188,0,0.3)] text-xs md:text-base">
                            {username[0].toUpperCase()}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
