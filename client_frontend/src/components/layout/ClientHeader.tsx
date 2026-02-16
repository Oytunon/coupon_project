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
            <div className="max-w-[1400px] mx-auto px-2 md:px-4 lg:px-6 py-2 lg:py-0">
                {/* Single Row Layout for Desktop (lg+) */}
                <div className="hidden lg:flex h-20 items-center justify-between gap-4">
                    {/* Logo Section */}
                    <div className="flex-shrink-0 flex items-center gap-2 group cursor-pointer" onClick={() => window.location.href = '/'}>
                        <img src={logo} alt="Extrabet Logo" className="h-12 w-auto transition-transform duration-500 group-hover:scale-105" />
                    </div>

                    {/* Navigation */}
                    <div className="flex-1 flex items-center justify-center gap-2 max-w-fit mx-auto">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeCategory === item.id
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onCategoryChange?.(item.id)}
                                    className={`
                                        flex flex-col items-center justify-center rounded-lg transition-all duration-300
                                        w-[100px] h-16
                                        ${isActive
                                            ? 'bg-primary text-black shadow-[0_0_15px_rgba(255,184,0,0.3)]'
                                            : 'text-white/60 hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    <Icon className={`mb-1 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} size={isActive ? 18 : 16} />
                                    <span className="font-black text-xs uppercase">{item.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex-shrink-0 flex items-center gap-3">
                        {username && (
                            <div className="flex items-center gap-4 pl-6 border-l border-white/10">
                                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-black font-black shadow-[0_0_10px_rgba(255,188,0,0.2)]">
                                    {username[0].toUpperCase()}
                                </div>
                            </div>
                        )}
                        <button
                            title="Çıkış Yap"
                            className="p-2 text-white/40 hover:text-red-500 transition-colors"
                            onClick={() => {/* Logout logic usually handled in parent */ }}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                {/* Two Row Layout for Tablet and Mobile (< lg) */}
                <div className="flex lg:hidden flex-col gap-2">
                    {/* Top Row: Logo and User Info */}
                    <div className="flex items-center justify-between h-12">
                        <div className="flex-shrink-0" onClick={() => window.location.href = '/'}>
                            <img src={logo} alt="Extrabet Logo" className="h-7 w-auto" />
                        </div>
                        <div className="flex items-center gap-2">
                            {username && (
                                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-black font-black">
                                    {username[0].toUpperCase()}
                                </div>
                            )}
                            <button className="p-2 text-white/40"><LogOut size={18} /></button>
                        </div>
                    </div>

                    {/* Bottom Row: Full Width Navigation */}
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full pb-1">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeCategory === item.id
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onCategoryChange?.(item.id)}
                                    className={`
                                        flex flex-col items-center justify-center rounded-lg transition-all duration-300
                                        flex-1 min-w-0 max-w-[80px] h-12
                                        ${isActive
                                            ? 'bg-primary text-black'
                                            : 'text-white/60 hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    <Icon className={`mb-0.5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} size={isActive ? 16 : 14} />
                                    <span className="font-black text-[7.5px] sm:text-[9px] uppercase leading-none truncate w-full px-0.5 text-center">
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
