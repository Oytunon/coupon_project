import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { CheckCircle2, Search, X, Check, Trash2, ListFilter } from "lucide-react"
import { apiClient } from "../api/client"

interface LeagueSelectorProps {
    selectedIds: number[]
    onChange: (ids: number[]) => void
}

export function LeagueSelector({
    selectedIds,
    onChange
}: LeagueSelectorProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [leagues, setLeagues] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Internal state for pending changes
    const [tempSelected, setTempSelected] = useState<number[]>([])

    useEffect(() => {
        if (open) {
            // Reset temp state to match props when opening
            setTempSelected([...selectedIds])
            loadLeagues()
        }
    }, [open])

    const fetchLeagues = async (search = "") => {
        // Fetch more to ensure we have a good list for selection
        const res = await apiClient.get('/leagues', { params: { search, limit: 1000 } })
        return res.data
    }

    const loadLeagues = async () => {
        setLoading(true)
        setError(null)
        try {
            // Fetch all leagues initially or filtered by search
            const data = await fetchLeagues(search)
            setLeagues(data)
        } catch (e: any) {
            console.error(e)
            setError(e.message || "Ligler yüklenirken bir hata oluştu.")
        } finally {
            setLoading(false)
        }
    }

    // Debounced search effect
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            loadLeagues()
        }, 300)
        return () => clearTimeout(timer)
    }, [search])

    const toggleLeague = (id: number) => {
        if (tempSelected.includes(id)) {
            setTempSelected(tempSelected.filter(i => i !== id))
        } else {
            setTempSelected([...tempSelected, id])
        }
    }

    const handleSave = () => {
        onChange(tempSelected)
        setOpen(false)
    }

    const handleRemove = (id: number) => {
        onChange(selectedIds.filter(i => i !== id))
    }

    const getLeagueName = (id: number) => {
        const l = leagues.find(x => x.id === id)
        return l ? l.name : `Lig #${id}`
    }

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-muted-foreground">İzin Verilen Ligler</label>
                <span className="text-[10px] text-muted-foreground">{selectedIds.length} lig seçili</span>
            </div>

            {/* Summary View */}
            <div className="flex flex-wrap gap-2 mb-2 p-3 bg-black/20 rounded-lg border border-white/5 min-h-[50px] items-start content-start max-h-[120px] overflow-y-auto">
                {selectedIds.length === 0 && (
                    <span className="text-xs text-muted-foreground italic w-full text-center py-2">
                        Kısıtlama yok, tüm ligler aktif.
                    </span>
                )}
                {selectedIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-colors pl-2 pr-1 py-1">
                        <span className="truncate max-w-[150px]">{getLeagueName(id)}</span>
                        <button
                            type="button"
                            onClick={() => handleRemove(id)}
                            className="ml-1 p-0.5 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </Badge>
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                className="w-full justify-between bg-card hover:bg-accent border-dashed border-2 font-medium"
                onClick={() => setOpen(true)}
            >
                <span className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4 text-muted-foreground" />
                    Lig Seç / Düzenle
                </span>
                <Badge variant="secondary" className="ml-2 font-normal">
                    {selectedIds.length}
                </Badge>
            </Button>

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-lg bg-zinc-950 border-zinc-800 shadow-2xl flex flex-col max-h-[85vh]">
                        <CardHeader className="border-b border-zinc-800 pb-4">
                            <CardTitle className="text-lg font-bold flex items-center justify-between">
                                Lig Seçimi
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>

                        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Lig adı veya ID ile ara..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9 bg-zinc-950 border-zinc-800"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <CardContent className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                    <span className="text-xs">Ligler yükleniyor...</span>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-12 text-red-500 gap-2 text-center">
                                    <span className="font-bold">Hata Oluştu</span>
                                    <span className="text-xs max-w-[200px]">{error}</span>
                                    <Button variant="outline" size="sm" onClick={loadLeagues}>Tekrar Dene</Button>
                                </div>
                            ) : leagues.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>Sonuç bulunamadı.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-1">
                                    {leagues.map(league => {
                                        const isSelected = tempSelected.includes(league.id)
                                        return (
                                            <div
                                                key={league.id}
                                                onClick={() => toggleLeague(league.id)}
                                                className={`
                                                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border
                                                    ${isSelected
                                                        ? "bg-primary/10 border-primary/30"
                                                        : "hover:bg-zinc-900 border-transparent hover:border-zinc-800"}
                                                `}
                                            >
                                                <div className={`
                                                    h-5 w-5 rounded border flex items-center justify-center transition-colors
                                                    ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-zinc-700 bg-zinc-900"}
                                                `}>
                                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-zinc-300"}`}>
                                                        {league.name}
                                                    </div>
                                                </div>

                                                <Badge variant="outline" className="text-[10px] font-mono opacity-50 bg-zinc-950">
                                                    #{league.id}
                                                </Badge>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>

                        <CardFooter className="pt-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between">
                            <div className="text-xs text-muted-foreground">
                                <span className="font-bold text-primary">{tempSelected.length}</span> lig seçildi
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                    İptal
                                </Button>
                                <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Seçimi Kaydet
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    )
}
