
import { ModeToggle } from "@/components/mode-toggle"


interface HeaderProps {
    title: string
    description?: string
}

export function Header({ title, description }: HeaderProps) {
    return (
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-background/50 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex flex-col justify-center">
                <h2 className="text-xl font-bold tracking-tight text-foreground/90">{title}</h2>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 border-l border-white/5 pl-4">
                    <ModeToggle />
                </div>

                <div className="flex items-center gap-3 pl-4 border-l border-white/5">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-medium leading-none">Admin User</span>
                        <span className="text-xs text-muted-foreground">Süper Yönetici</span>
                    </div>
                    <div className="h-9 w-9 bg-gradient-to-tr from-amber-500 to-yellow-600 rounded-full ring-2 ring-background shadow-lg shadow-amber-500/20 flex items-center justify-center text-white font-bold text-sm">
                        AD
                    </div>
                </div>
            </div>
        </header>
    )
}
