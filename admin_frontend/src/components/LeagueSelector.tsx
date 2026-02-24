import { useEffect, useState, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { CheckCircle2, Search, X, Check, ListFilter, Plus, Loader2 } from "lucide-react"
import { apiClient } from "../api/client"


// Simple debounce hook implementation if not available
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

interface LeagueSelectorProps {
    selectedIds: number[]
    onChange: (ids: number[]) => void
}

interface League {
    id: number
    name: string
}

export function LeagueSelector({
    selectedIds,
    onChange
}: LeagueSelectorProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [leagues, setLeagues] = useState<League[]>([])
    const [loading, setLoading] = useState(false)
    const debouncedSearch = useDebounceValue(search, 500)
    const [hasMore, setHasMore] = useState(true)
    const LIMIT = 50

    // Internal state for pending changes
    const [tempSelected, setTempSelected] = useState<number[]>([])

    // Cache for league names
    const [leagueNameCache, setLeagueNameCache] = useState<Record<number, string>>({})

    const loadLeagues = useCallback(async (searchTerm: string = "", isAppend: boolean = false) => {
        setLoading(true)
        try {
            const currentSkip = isAppend ? leagues.length : 0
            const params: any = {
                limit: LIMIT,
                skip: currentSkip
            }
            if (searchTerm) params.search = searchTerm

            const res = await apiClient.get('/leagues', { params })
            let data = []
            if (Array.isArray(res.data)) {
                data = res.data
            } else if (res.data && Array.isArray(res.data.items)) {
                data = res.data.items
            }

            if (isAppend) {
                setLeagues(prev => [...prev, ...data])
            } else {
                setLeagues(data)
            }

            setHasMore(data.length === LIMIT)

            // Update cache
            const newCache = { ...leagueNameCache }
            data.forEach((l: League) => {
                newCache[l.id] = l.name
            })
            setLeagueNameCache(newCache)
        } catch (error) {
            console.error("Failed to load leagues", error)
        } finally {
            setLoading(false)
        }
    }, [leagueNameCache, leagues.length])

    // Initial load to get names of selected IDs
    useEffect(() => {
        loadLeagues("")
    }, [])

    useEffect(() => {
        if (open) {
            setTempSelected([...selectedIds])
            loadLeagues("")
            setSearch("")
        }
    }, [open, selectedIds])

    useEffect(() => {
        if (open) {
            loadLeagues(debouncedSearch)
        }
    }, [debouncedSearch, open])

    const toggleLeague = (id: number) => {
        if (tempSelected.includes(id)) {
            setTempSelected(tempSelected.filter(i => i !== id))
        } else {
            setTempSelected([...tempSelected, id])
        }
    }

    const handleManualAdd = () => {
        if (search && /^\d+$/.test(search)) {
            const id = parseInt(search);
            if (!tempSelected.includes(id)) {
                setTempSelected([...tempSelected, id]);
                // Ensure we don't lose the "name" if it was strictly manual
                // If the API didn't return it, we might just show ID.
                setSearch("");
            }
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
        return leagueNameCache[id] || `Lig #${id}`
    }

    // Check if the search term is a number and NOT already in the list
    const isManualAddable = search && /^\d+$/.test(search) && !leagues.some(l => l.id.toString() === search);

    const displayLeagues = useMemo(() => {
        const list = [...leagues];
        tempSelected.forEach(id => {
            if (!list.some(l => l.id === id)) {
                // Not in current search results, but it is selected, let's prepend it
                list.unshift({ id, name: getLeagueName(id) });
            }
        });
        return list;
    }, [leagues, tempSelected, leagueNameCache]);

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-muted-foreground">İzin Verilen Ligler</label>
                <span className="text-[10px] text-muted-foreground">{selectedIds.length} lig seçili</span>
            </div>

            {/* Summary View */}
            <div className="flex flex-wrap gap-2 mb-2 p-3 bg-black/20 rounded-lg border border-white/5 min-h-[50px] items-start content-start max-h-[160px] overflow-y-auto custom-scrollbar">
                {selectedIds.length === 0 && (
                    <span className="text-xs text-muted-foreground italic w-full text-center py-2">
                        Kısıtlama yok, tüm ligler aktif.
                    </span>
                )}
                {selectedIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all pl-2 pr-1 py-1 animate-in zoom-in-95 duration-200">
                        <span className="truncate max-w-[150px] font-medium">{getLeagueName(id)}</span>
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
                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>

                        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Lig adı veya ID ile ara..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="pl-9 bg-zinc-950 border-zinc-800"
                                        autoFocus
                                    />
                                    {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                                </div>
                                {isManualAddable && (
                                    <Button type="button" size="sm" onClick={handleManualAdd} className="bg-blue-600 hover:bg-blue-500 text-white gap-1">
                                        <Plus size={16} />
                                        Ekle ({search})
                                    </Button>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] text-muted-foreground hover:text-destructive"
                                    onClick={() => setTempSelected([])}
                                >
                                    Seçimi Temizle
                                </Button>
                            </div>
                        </div>

                        <CardContent className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {displayLeagues.length === 0 && !loading ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>Sonuç bulunamadı.</p>
                                    {search && <p className="text-xs mt-2">ID girerek yukarıdaki mavi butondan ekleyebilirsiniz.</p>}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-1">
                                        {displayLeagues.map(league => {
                                            const isSelected = tempSelected.includes(league.id)
                                            return (
                                                <div
                                                    key={league.id}
                                                    onClick={() => toggleLeague(league.id)}
                                                    className={`
                                                        flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border
                                                        ${isSelected
                                                            ? "bg-primary/20 border-primary/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                                            : "hover:bg-zinc-900 border-transparent hover:border-zinc-800"}
                                                    `}
                                                >
                                                    <div className={`
                                                        h-5 w-5 rounded border flex items-center justify-center transition-all duration-300
                                                        ${isSelected ? "bg-primary border-primary text-primary-foreground scale-110" : "border-zinc-700 bg-zinc-900"}
                                                    `}>
                                                        {isSelected && <Check size={12} strokeWidth={3} className="animate-in zoom-in duration-300" />}
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

                                    {hasMore && (
                                        <div className="py-4 px-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs h-9"
                                                disabled={loading}
                                                onClick={() => loadLeagues(search, true)}
                                            >
                                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                                                Daha Fazla Lig Yükle
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>

                        <CardFooter className="pt-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between">
                            <div className="text-xs text-muted-foreground">
                                <span className="font-bold text-primary">{tempSelected.length}</span> lig seçildi
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                    İptal
                                </Button>
                                <Button type="button" size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
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
