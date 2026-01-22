import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { jwtDecode } from "jwt-decode"

interface AuthContextType {
    isAuthenticated: boolean
    user: string | null
    login: (token: string) => void
    logout: () => void
    loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check local storage on boot
        const token = localStorage.getItem("admin_token")
        if (token) {
            try {
                const decoded: any = jwtDecode(token)
                // Check expiry
                const currentTime = Date.now() / 1000
                if (decoded.exp < currentTime) {
                    logout()
                } else {
                    setIsAuthenticated(true)
                    setUser(decoded.sub)
                }
            } catch (e) {
                logout()
            }
        }
        setLoading(false)
    }, [])

    const login = (token: string) => {
        localStorage.setItem("admin_token", token)
        const decoded: any = jwtDecode(token)
        setUser(decoded.sub)
        setIsAuthenticated(true)
    }

    const logout = () => {
        localStorage.removeItem("admin_token")
        setIsAuthenticated(false)
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
