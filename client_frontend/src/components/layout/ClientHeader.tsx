import { Trophy, LogOut, LayoutGrid, Zap, Calendar, CheckSquare, BarChart3, Star, CheckCircle2, Award } from "lucide-react"
import logo from "../../assets/logo.png"

interface ClientHeaderProps {
    username: string | null
    activeCategory?: string
    onCategoryChange?: (category: string) => void
}

export function ClientHeader({ username, activeCategory = 'all', onCategoryChange }: ClientHeaderProps) {
    const desktopNavItems = [
        { id: 'all', label: 'TÜMÜ', icon: LayoutGrid },
        { id: 'active', label: 'AKTİF', icon: Zap },
        { id: 'upcoming', label: 'YAKINDA', icon: Calendar },
        { id: 'finished', label: 'SONUÇLANAN', icon: Award },
        { id: 'report', label: 'TURNUVA RAPORUM', icon: BarChart3 },
        { id: 'enrollments', label: 'KATILDIĞIM TURNUVALAR', icon: Star },
    ]

    const mobileNavItems = [
        { id: 'all', label: 'TÜMÜ', icon: LayoutGrid },
        { id: 'active', label: 'AKTİF', icon: Zap },
        { id: 'upcoming', label: 'YAKINDA', icon: Calendar },
        { id: 'finished', label: 'SONUÇ.', icon: Award },
        { id: 'report', label: 'RAPOR', icon: BarChart3 },
        { id: 'enrollments', label: 'KAYIT', icon: Trophy },
    ]

    return (
        <nav className="border-b border-primary/20 bg-black/95 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto">
                {/* Desktop Layout (lg and above) */}
                <div className="hidden lg:flex h-20 items-center justify-between px-4 gap-4">
                    {/* Logo Section */}
                    <div className="flex-shrink-0 flex items-center group cursor-pointer" onClick={() => window.location.href = '/'}>
                        <img src={logo} alt="Extrabet Logo" className="h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
                    </div>

                    {/* Navigation - Inline for Desktop */}
                    <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide px-2">
                        {desktopNavItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeCategory === item.id
                            const isSpecial = item.id === 'report' || item.id === 'enrollments'
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onCategoryChange?.(item.id)}
                                    className={`
                                        flex-shrink-0 flex items-center justify-center gap-2 rounded-lg transition-all duration-300
                                        px-4 h-12
                                        ${isActive
                                            ? 'bg-primary text-black shadow-[0_0_15px_rgba(255,184,0,0.3)]'
                                            : isSpecial
                                                ? 'text-white/80 border border-white/10 hover:bg-white/5'
                                                : 'text-white/60 hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    <Icon className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} size={16} />
                                    <span className="font-black text-[10px] uppercase leading-none whitespace-nowrap">
                                        {item.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* User Section */}
                    <div className="flex-shrink-0 flex items-center gap-3">
                        {username && (
                            <div className="flex items-center gap-4 pl-4 border-l border-white/10">
                                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-black font-black text-base">
                                    {username[0].toUpperCase()}
                                </div>
                            </div>
                        )}
                        <button
                            title="Çıkış Yap"
                            className="p-2 text-white/40 hover:text-red-500 transition-colors"
                            onClick={() => {/* logout usually handled in parent */ }}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                {/* Mobile/Tablet Layout (smaller than lg) */}
                <div className="lg:hidden flex flex-col">
                    {/* Row 1: Logo and Logout Only (User Badge Removed per request) */}
                    <div className="h-14 flex items-center justify-between px-3 border-b border-white/5">
                        <div className="flex-shrink-0 flex items-center group cursor-pointer" onClick={() => window.location.href = '/'}>
                            <img src={logo} alt="Extrabet Logo" className="h-7 w-auto" />
                        </div>

                        <div className="flex items-center">
                            <button
                                className="p-2 text-white/40 hover:text-red-500 transition-colors"
                                onClick={() => {/* logout handled in parent */ }}
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Navigation Buttons (Always visible row, use compact labels) */}
                    <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-hide px-2 py-1.5 bg-black">
                        {mobileNavItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeCategory === item.id
                            const isSpecial = item.id === 'report' || item.id === 'enrollments'
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onCategoryChange?.(item.id)}
                                    className={`
                                        flex-1 flex flex-col items-center justify-center rounded-lg transition-all duration-300
                                        min-w-[54px] h-11
                                        ${isActive
                                            ? 'bg-primary text-black shadow-[0_0_8px_rgba(255,184,0,0.4)]'
                                            : isSpecial
                                                ? 'text-white border border-white/20 bg-white/5'
                                                : 'text-white/60 bg-white/[0.02]'}
                                    `}
                                >
                                    <Icon className="mb-0.5" size={isActive ? 14 : 12} />
                                    <span className="font-black text-[7px] uppercase leading-tight text-center whitespace-nowrap px-0.5">
                                        {item.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </nav>
    )
}
