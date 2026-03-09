import React, { useState } from "react"
import { User, Lock, ArrowRight, CheckCircle2 } from "lucide-react"
import { apiClient } from "../api/client"
import { login } from "../api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    const [userEmail, setUserEmail] = useState("")

    const handleMagicLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const response = await apiClient.post("/auth/request-magic-link", {
                username,
                password
            })

            if (response.status === 200) {
                setEmailSent(true)
                setUserEmail(response.data.email || "kayıtlı email adresinize")
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || "Giriş başarısız. Bilgilerinizi kontrol edin.")
        } finally {
            setLoading(false)
        }
    }

    if (emailSent) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background p-4">
                <Card className="w-full max-w-md bg-card border-border border-white/10 text-card-foreground shadow-2xl">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <CheckCircle2 className="h-16 w-16 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-center text-primary">
                            Takip Linki Gönderildi!
                        </CardTitle>
                        <CardDescription className="text-center text-muted-foreground">
                            Giriş yapmak için email adresinize gelen linke tıklayın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert className="bg-secondary/50 border-white/10 border">
                            <AlertDescription className="text-muted-foreground">
                                <div className="space-y-2">
                                    <p className="font-medium text-foreground">📧 Email kontrolü:</p>
                                    <p className="text-sm font-mono bg-background/50 p-2 rounded">{userEmail}</p>
                                    <p className="text-sm text-muted-foreground/80 mt-4">
                                        Email gelmedi mi? Spam klasörünü kontrol edin.
                                    </p>
                                </div>
                            </AlertDescription>
                        </Alert>

                        <Button
                            onClick={() => {
                                setEmailSent(false)
                                setUsername("")
                                setPassword("")
                            }}
                            variant="outline"
                            className="w-full border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                            Tekrar Dene
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
            />

            {/* Ambient Background Glow */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-white/10 text-card-foreground shadow-2xl relative z-10">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold text-center">Admin Girişi</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleMagicLogin} className="space-y-4">
                        <div className="space-y-2 relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Kullanıcı Adı"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-10 bg-secondary/50 border-white/10 focus-visible:ring-primary/50"
                                required
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="Şifre"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10 bg-secondary/50 border-white/10 focus-visible:ring-primary/50"
                                required
                            />
                        </div>

                        {error && (
                            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="w-full font-bold py-6 text-base shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground"
                            disabled={loading}
                        >
                            {loading ? "Doğrulanıyor..." : "Giriş Linki İste"} <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>

                        <div className="text-center text-xs text-muted-foreground mt-6 font-medium">
                            <p>Bilgileriniz doğruysa kayıtlı mail adresinize giriş linki gönderilecektir.</p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
