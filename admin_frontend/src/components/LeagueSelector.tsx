import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, ChevronRight, Trash2 } from "lucide-react"
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

    useEffect(() => {
        if (open) {
            loadLeagues()
        }
    }, [open, search])

    const fetchLeagues = async (search = "") => {
        const res = await apiClient.get('/leagues', { params: { search, limit: 100 } })
        return res.data
    }

    const loadLeagues = async () => {
        setLoading(true)
        try {
            const data = await fetchLeagues(search)
            setLeagues(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const toggleLeague = (id: number) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(i => i !== id))
        } else {
            onChange([...selectedIds, id])
        }
    }

    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">İzin Verilen Ligler</label>
            <div className="flex flex-wrap gap-2 mb-2 min-h-[30px] p-2 bg-black/20 rounded-md border border-white/5">
                {selectedIds.length === 0 && <span className="text-xs text-muted-foreground italic p-1">Tüm ligler açık (Kısıtlama yok)</span>}
                {selectedIds.map(id => (
                    <Badge key={id} variant="outline" className="gap-1 bg-primary/10 border-primary/20 text-primary">
                        {leagues.find(l => l.id === id)?.name || id}
                        <button type="button" onClick={() => toggleLeague(id)} className="ml-1 hover:text-red-500"><Trash2 size={12} /></button>
                    </Badge>
                ))}
            </div>

            <div className="relative">
                <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpen(!open)}>
                    {selectedIds.length > 0 ? `${selectedIds.length} Lig Seçili` : "Lig Seç (Opsiyonel)"}
                    <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
                </Button>

                {open && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 sticky top-0 bg-popover border-b">
                            <Input
                                placeholder="Lig ara..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-8"
                                autoFocus
                            />
                        </div>
                        <div className="p-1">
                            {loading ? (
                                <div className="text-center p-2 text-xs text-muted-foreground">Yükleniyor...</div>
                            ) : (
                                leagues.map(league => (
                                    <div
                                        key={league.id}
                                        className={`flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer text-sm ${selectedIds.includes(league.id) ? "bg-accent/50 text-accent-foreground" : ""}`}
                                        onClick={() => toggleLeague(league.id)}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedIds.includes(league.id) ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                                            {selectedIds.includes(league.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                        </div>
                                        <span>{league.name}</span>
                                        <span className="ml-auto text-xs text-muted-foreground opacity-50">#{league.id}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
