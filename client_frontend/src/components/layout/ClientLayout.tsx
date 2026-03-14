import { ReactNode } from "react"
import { ClientHeader } from "./ClientHeader"

interface ClientLayoutProps {
    children: ReactNode
    username: string | null
    activeCategory?: string
    onCategoryChange?: (category: string) => void
}

export function ClientLayout({ children, username, activeCategory, onCategoryChange }: ClientLayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground pb-28 md:pb-32 selection:bg-primary/30 font-sans">


            <ClientHeader username={username} activeCategory={activeCategory} onCategoryChange={onCategoryChange} />

            <div className="relative z-10">
                {children}
            </div>
        </div>
    )
}
