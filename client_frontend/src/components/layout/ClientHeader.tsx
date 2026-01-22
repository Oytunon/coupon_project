import { Trophy, LogOut } from "lucide-react"

interface ClientHeaderProps {
    username: string | null
}

export function ClientHeader({ username }: ClientHeaderProps) {
    return (
        <nav className="border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3 group cursor-default">
                    <div className="bg-gradient-to-br from-amber-500 to-yellow-600 p-2 rounded-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform duration-300">
                        <Trophy className="h-5 w-5 text-white fill-white/20" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-xl tracking-tighter uppercase italic bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                            Extra<span className="text-amber-500">Bet</span>
                        </span>
                        <span className="text-[10px] font-bold tracking-[0.2em] text-primary/80 uppercase">Tournament</span>
                    </div>
                </div>

                {username && (
                    <div className="flex items-center gap-4 pl-6 border-l border-white/10">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold leading-tight tracking-wider">Hoş Geldin</p>
                            <p className="text-sm font-bold leading-tight text-white">{username}</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-secondary/50 border border-white/5 flex items-center justify-center text-primary font-bold shadow-inner relative overflow-hidden group">
                            <span className="relative z-10">{username[0].toUpperCase()}</span>
                            <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
