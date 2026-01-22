import { ReactNode } from "react"
import { ClientHeader } from "./ClientHeader"

interface ClientLayoutProps {
    children: ReactNode
    username: string | null
}

export function ClientLayout({ children, username }: ClientLayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30 font-sans">


            <ClientHeader username={username} />

            <div className="relative z-10">
                {children}
            </div>
        </div>
    )
}
