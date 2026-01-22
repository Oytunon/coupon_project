import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { apiClient } from "../api/client"
import { useAuth } from "../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function VerifyMagicLinkPage() {
    const hasRun = React.useRef(false)
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { login } = useAuth()
    const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const verifyToken = async () => {
            if (hasRun.current) return
            hasRun.current = true

            const token = searchParams.get("token")
            console.log("Verifying token:", token)

            if (!token) {
                setStatus("error")
                setErrorMessage("Geçersiz link. Token bulunamadı.")
                return
            }

            try {
                const response = await apiClient.post("/auth/verify-magic-link", { token })
                console.log("Verification response:", response.data)

                if (response.data.access_token) {
                    // AuthContext üzerinden login yap (State'i güncelle)
                    login(response.data.access_token)
                    setStatus("success")

                    // 2 saniye bekle ve admin panel'e yönlendir
                    setTimeout(() => {
                        navigate("/admin")
                    }, 2000)
                } else {
                    setStatus("error")
                    setErrorMessage("Giriş başarısız oldu.")
                }
            } catch (err: any) {
                setStatus("error")
                setErrorMessage(
                    err.response?.data?.detail ||
                    "Link doğrulanamadı. Link süresi dolmuş veya geçersiz olabilir."
                )
            }
        }

        verifyToken()
    }, [searchParams, navigate])

    if (status === "verifying") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 p-4">
                <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-gray-100">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <Loader2 className="h-16 w-16 text-emerald-500 animate-spin" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-center text-gray-100">
                            Doğrulanıyor...
                        </CardTitle>
                        <CardDescription className="text-center text-gray-400">
                            Giriş linkiniz kontrol ediliyor, lütfen bekleyin.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (status === "success") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 p-4">
                <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-gray-100">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-center text-emerald-500">
                            Giriş Başarılı!
                        </CardTitle>
                        <CardDescription className="text-center text-gray-400">
                            Admin paneline yönlendiriliyorsunuz...
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert className="bg-emerald-900/20 border-emerald-900">
                            <AlertDescription className="text-emerald-500 text-center">
                                ✓ Kimlik doğrulaması tamamlandı
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Error state
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950 p-4">
            <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-gray-100">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <XCircle className="h-16 w-16 text-red-500" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-center text-red-500">
                        Doğrulama Başarısız
                    </CardTitle>
                    <CardDescription className="text-center text-gray-400">
                        Giriş linkiniz doğrulanamadı.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-500">
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>

                    <div className="text-sm text-gray-400 space-y-2">
                        <p>Olası sebepler:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Link süresi dolmuş olabilir (24 saat)</li>
                            <li>Link daha önce kullanılmış olabilir</li>
                            <li>Link geçersiz olabilir</li>
                        </ul>
                    </div>

                    <Button
                        onClick={() => navigate("/login")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                        Yeni Link Talep Et
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
