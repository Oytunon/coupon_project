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
        { id: 'finished', label: 'SONUÇ.', icon: Award },
        { id: 'report', label: 'RAPOR', icon: BarChart3 },
        { id: 'enrollments', label: 'KAYIT', icon: Trophy },
    ]

    return (
        <nav className="border-b border-primary/20 bg-black/95 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto">
                {/* Desktop Layout (lg and above) */}
                <div className="hidden lg:flex h-20 items-center justify-between px-4 gap-8">
                    {/* Logo Section */}
                    <div className="flex-shrink-0 flex items-center group cursor-pointer" onClick={() => window.location.href = '/'}>
                        <img src={logo} alt="Extrabet Logo" className="h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
                    </div>

                    {/* Navigation - No scroll, Shrinks proportionally */}
                    <div className="flex-1 flex items-center justify-center gap-2 px-2 overflow-hidden">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeCategory === item.id
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onCategoryChange?.(item.id)}
                                    className={`
                                        flex-shrink flex items-center justify-center gap-2 rounded-lg transition-all duration-300
                                        px-4 h-11 min-w-0
                                        ${isActive
                                            ? 'bg-primary text-black shadow-[0_0_15px_rgba(255,184,0,0.3)]'
                                            : 'text-white/80 border border-primary/20 bg-white/[0.02] hover:bg-white/10'}
                                    `}
                                >
                                    <Icon className={`flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} size={16} />
                                    <span className="font-black text-[10px] uppercase leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                                        {item.id === 'finished' ? 'SONUÇLANAN' : item.id === 'report' ? 'TURNUVA RAPORUM' : item.id === 'enrollments' ? 'KATILDIĞIM TURNUVALAR' : item.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <div className="flex-shrink-0 w-[140px] hidden xl:block" aria-hidden="true" />
                </div>

                {/* Mobile/Tablet Layout (smaller than lg) */}
                <div className="lg:hidden flex flex-col">
                    {/* Row 1: Logo Only (Centered) */}
                    <div className="h-14 flex items-center justify-center px-3 border-b border-primary/20 relative">
                        <div className="flex-shrink-0 flex items-center group cursor-pointer" onClick={() => window.location.href = '/'}>
                            <img src={logo} alt="Extrabet Logo" className="h-7 w-auto" />
                        </div>
                    </div>

                    {/* Row 2: Navigation - Single row, NO SCROLL, shrinking proportionally */}
                    <div className="flex items-center justify-center gap-1 px-1.5 py-2 bg-black overflow-hidden">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeCategory === item.id
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onCategoryChange?.(item.id)}
                                    className={`
                                        flex-1 flex items-center justify-center gap-1.5 rounded-lg transition-all duration-300
                                        h-10 px-1 min-w-0
                                        ${isActive
                                            ? 'bg-primary text-black shadow-[0_0_8px_rgba(255,184,0,0.4)]'
                                            : 'text-white/80 border border-primary/40 bg-white/[0.02]'}
                                    `}
                                >
                                    <Icon className="flex-shrink-0" size={14} />
                                    <span className="font-black text-[8px] uppercase leading-none whitespace-nowrap overflow-hidden text-ellipsis">
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
