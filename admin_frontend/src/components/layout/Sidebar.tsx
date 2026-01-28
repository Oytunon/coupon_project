import {
    LayoutDashboard,
    Trophy,
    Users,
    Shield,
    Settings,
    LogOut,
    Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SidebarProps {
    activeTab: string
    setActiveTab: (tab: any) => void
    logout: () => void
}

export function Sidebar({ activeTab, setActiveTab, logout }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
        { id: 'events', label: 'Kampanyalar', icon: Trophy },
        { id: 'participants', label: 'Katılımcılar', icon: Users },
        { id: 'users', label: 'Yöneticiler', icon: Shield },
    ]

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-card/50 backdrop-blur-xl border-r border-white/5 z-50 flex flex-col">
            <div className="h-16 flex items-center gap-3 px-6 border-b border-white/5">
                <div className="h-8 w-8 bg-gradient-to-tr from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Zap className="h-5 w-5 text-white fill-current" />
                </div>
                <div>
                    <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Extra<span className="text-amber-500">Bet</span>
                    </h1>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Admin Panel</p>
                </div>
            </div>

            <div className="flex-1 py-6 px-3 space-y-1">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                            activeTab === item.id
                                ? "bg-amber-500/10 text-amber-500 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)] border border-amber-500/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )}
                    >
                        {activeTab === item.id && (
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-50" />
                        )}
                        <item.icon className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            activeTab === item.id ? "scale-110" : "group-hover:scale-110"
                        )} />
                        {item.label}
                        {activeTab === item.id && (
                            <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_2px_rgba(245,158,11,0.5)] animate-pulse" />
                        )}
                    </button>
                ))}
            </div>

            <div className="p-4 border-t border-white/5 space-y-2">
                <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 group" onClick={logout}>
                    <LogOut className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Çıkış Yap
                </Button>

            </div>
        </aside>
    )
}
