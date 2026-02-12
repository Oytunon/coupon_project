import { Trophy, LogOut, LayoutGrid, Zap, Calendar, CheckSquare, BarChart3, Star } from "lucide-react"
import logo from "../../assets/logo.png"

interface ClientHeaderProps {
    username: string | null
}

export function ClientHeader({ username }: ClientHeaderProps) {
    return (
        <nav className="border-b border-primary/20 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo Section */}
                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.location.href = '/'}>
                    <img src={logo} alt="Extrabet Logo" className="h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
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
