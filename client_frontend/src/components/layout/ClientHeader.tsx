import { Trophy, LogOut, LayoutGrid, Zap, Calendar, CheckSquare, BarChart3, Star, CheckCircle2, Award } from "lucide-react"
import logo from "../../assets/logo.png"

interface ClientHeaderProps {
    username: string | null
    activeCategory?: string
    onCategoryChange?: (category: string) => void
}

export function ClientHeader({ username, activeCategory = 'all', onCategoryChange }: ClientHeaderProps) {
    const navItems = [
        { id: 'all', label: 'TÜMÜ', icon: LayoutGrid },
        { id: 'active', label: 'AKTİF', icon: Zap },
        { id: 'upcoming', label: 'YAKINDA', icon: Calendar },
        { id: 'finished', label: 'SONUÇLANAN', icon: Award },
        { id: 'report', label: 'RAPOR', icon: BarChart3 },
        { id: 'enrollments', label: 'KAYIT', icon: Trophy },
    ]

    return (
        <nav className="border-b border-primary/20 bg-black/95 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-2 md:px-6 h-16 md:h-20 flex items-center justify-between gap-1 md:gap-4">
                {/* Logo Section */}
                <div className="flex-shrink-0 flex items-center gap-2 group cursor-pointer" onClick={() => window.location.href = '/'}>
                    <img src={logo} alt="Extrabet Logo" className="h-6 md:h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
                </div>

                {/* Unified Responsive Navigation */}
                <div className="flex-1 flex items-center justify-center gap-0.5 md:gap-1 lg:gap-2 mx-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeCategory === item.id
                        return (
                            <button
                                key={item.id}
                                onClick={() => onCategoryChange?.(item.id)}
                                className={`
                                    flex flex-col items-center justify-center rounded-lg transition-all duration-300
                                    flex-1 min-w-0 max-w-[100px]
                                    h-12 md:h-16
                                    ${isActive
                                        ? 'bg-primary text-black shadow-[0_0_15px_rgba(255,184,0,0.3)]'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'}
                                `}
                            >
                                <Icon className={`mb-0.5 md:mb-1 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} size={isActive ? 16 : 14} />
                                <span className={`font-black tracking-tighter md:tracking-normal leading-none text-[7.5px] md:text-[9px] lg:text-[10px] xl:text-xs uppercase truncate w-full px-0.5`}>
                                    {item.label}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Right Side Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 md:gap-3">
                    {username && (
                        <div className="flex items-center gap-2 md:gap-4 md:pl-6 md:border-l border-white/10">
                            <div className="h-7 w-7 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-primary flex items-center justify-center text-black text-xs md:text-base font-black shadow-[0_0_10px_rgba(255,188,0,0.2)]">
                                {username[0].toUpperCase()}
                            </div>
                        </div>
                    )}
                    <button
                        title="Çıkış Yap"
                        className="p-2 text-white/40 hover:text-red-500 transition-colors"
                        onClick={() => {/* Logout logic usually handled in parent */ }}
                    >
                        <LogOut size={16} className="md:w-5 md:h-5" />
                    </button>
                </div>
            </div>
        </nav>
    )
}
