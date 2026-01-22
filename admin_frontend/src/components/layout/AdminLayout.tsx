import { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

interface AdminLayoutProps {
    children: ReactNode
    activeTab: string
    setActiveTab: (tab: any) => void
    logout: () => void
    headerTitle: string
    headerDescription?: string
}

export function AdminLayout({
    children,
    activeTab,
    setActiveTab,
    logout,
    headerTitle,
    headerDescription
}: AdminLayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-amber-500/30">
            {/* Background Grid Pattern */}
            <div className="fixed inset-0 z-0 opacity-[0.02]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
            />

            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} logout={logout} />

            <div className="pl-64 relative z-10">
                <Header title={headerTitle} description={headerDescription} />
                <main className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
                    {children}
                </main>
            </div>
        </div>
    )
}
