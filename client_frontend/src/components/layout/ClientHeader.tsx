import { Trophy, LogOut, LayoutGrid, Zap, Calendar, CheckSquare, BarChart3, Star } from "lucide-react"

interface ClientHeaderProps {
    username: string | null
}

export function ClientHeader({ username }: ClientHeaderProps) {
    return (
        <nav className="border-b border-primary/20 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo Section */}
                <div className="flex items-center gap-2 group cursor-pointer">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                            <span className="font-black text-3xl tracking-tighter uppercase italic text-white flex items-center">
                                EXTRA<span className="text-secondary-foreground font-black">BET</span>
                                <span className="ml-2 bg-primary text-black text-[10px] px-1 py-0.5 rounded not-italic font-black flex items-center gap-1">
                                    12.<span className="text-[8px]">YIL</span>
                                    <span className="w-3 h-2 bg-red-600 relative overflow-hidden flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full absolute -left-0.5"></div>
                                        <div className="w-1 h-1 bg-white rotate-45 absolute right-0.5"></div>
                                    </span>
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
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
                        <div className="flex items-center gap-4 pl-6 border-l border-white/10 ml-3">
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
