import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/context/AuthContext"
import { AdminLayout } from "@/components/layout/AdminLayout"
import {
    Users,
    Settings,
    LayoutDashboard,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    FileText,
    Trash2,
    Plus,
    Mail,
    Shield,
    Lock,
    UserPlus,
    Clock,
    History,
    Calendar,
    Trophy,
    RefreshCw,
    PlayCircle,
    PauseCircle,
    StopCircle,
    Archive,
    Pencil,
    Eye,
    Zap,
    Search,
    Download,
    ChevronLeft,
    ChevronRight,
    Gift,
    ImagePlus,
    Timer,
    Info,
    X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "../api/client"
import { LeagueSelector } from "@/components/LeagueSelector"
import { EventRewardSettings } from "@/components/EventRewardSettings"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const fetchAdminStats = async () => {
    const res = await apiClient.get('/admin/stats')
    return res.data
}

const fetchParticipants = async (eventId?: number, skip = 0, limit = 20, search = "") => {
    const params: any = { skip, limit }
    if (eventId) params.event_id = eventId
    if (search) params.search = search
    const res = await apiClient.get('/admin/participants', { params })
    return res.data
}

const fetchUserCoupons = async (clientId: number, eventId?: number, skip = 0, limit = 20, search = "") => {
    const params: any = { skip, limit }
    if (eventId) params.event_id = eventId
    if (search) params.search = search
    const res = await apiClient.get(`/admin/participants/${clientId}/coupons`, { params })
    return res.data
}

const fetchAdminUsers = async () => {
    const res = await apiClient.get('/admin/users')
    return res.data
}

const createAdminUser = async (userData: any) => {
    const res = await apiClient.post('/admin/users', userData)
    return res.data
}

const updateAdminUser = async (userId: number, userData: any) => {
    const res = await apiClient.put(`/admin/users/${userId}`, userData)
    return res.data
}

const deleteAdminUser = async (userId: number) => {
    const res = await apiClient.delete(`/admin/users/${userId}`)
    return res.data
}

const fetchEvents = async () => {
    const res = await apiClient.get('/admin/events')
    return res.data
}

const createEvent = async (eventData: any) => {
    const res = await apiClient.post('/admin/events', eventData)
    return res.data
}

const updateEvent = async (eventId: number, eventData: any) => {
    const res = await apiClient.put(`/admin/events/${eventId}`, eventData)
    return res.data
}

const updateEventStatus = async (eventId: number, status: string) => {
    const res = await apiClient.patch(`/admin/events/${eventId}/status`, { status })
    return res.data
}

const uploadEventImage = async (eventId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post(`/admin/events/${eventId}/upload-image`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
    return res.data
}

const recalculateEventPoints = async (eventId: number) => {
    const res = await apiClient.post(`/admin/events/${eventId}/recalculate`)
    return res.data
}

const runEventWorker = async (eventId: number) => {
    const res = await apiClient.post(`/admin/events/${eventId}/worker`)
    return res.data
}

const getEventStats = async (eventId: number) => {
    const res = await apiClient.get(`/admin/events/${eventId}/stats`)
    return res.data
}

const deleteEvent = async (eventId: number) => {
    const res = await apiClient.delete(`/admin/events/${eventId}`)
    return res.data
}

const distributeRewards = async (eventId: number) => {
    const res = await apiClient.post(`/admin/events/${eventId}/distribute-rewards`)
    return res.data
}

const fetchRewardHistory = async (eventId: number) => {
    const res = await apiClient.get(`/admin/events/${eventId}/reward-history`)
    return res.data
}

const addManualCoupon = async (eventId: number, betId: string) => {
    const res = await apiClient.post(`/admin/events/${eventId}/coupons/manual`, { bet_id: betId })
    return res.data
}


const createLeague = async (data: any) => {
    const res = await apiClient.post('/leagues/', data)
    return res.data
}
const updateLeague = async (id: number, data: any) => {
    const res = await apiClient.put(`/leagues/${id}`, data)
    return res.data
}
const deleteLeague = async (id: number) => {
    const res = await apiClient.delete(`/leagues/${id}`)
    return res.data
}


const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    try {
        // e.g. 2026-02-24T22:45:00 -> 24.02.2026 22:45
        const dt = dateString.split('.')[0].slice(0, 16).split('T');
        if (dt.length !== 2) return dateString;
        const [year, month, day] = dt[0].split('-');
        return `${day}.${month}.${year} ${dt[1]}`;
    } catch (e) {
        return dateString;
    }
}

// Strips timezone formatting completely, maps string straight to input compatible string
const formatDateTimeLocal = (dateString: string) => {
    if (!dateString) return "";
    // If it's already in the local format (e.g. from the input itself), return as-is
    if (dateString.length === 16 && dateString.includes('T') && !dateString.endsWith('Z')) return dateString;

    // Fallback naive slicing (YYYY-MM-DDTHH:mm) - ignores JS timezone offsets entirely
    // We expect the DB string to come back exactly as it was saved (e.g. 2026-02-24T22:45:00)
    try {
        return dateString.split('.')[0].slice(0, 16);
    } catch (e) {
        return "";
    }
}

const ContentRuleEditor = ({ rules, onChange }: { rules: { title: string; content: string; icon: string }[], onChange: (rules: { title: string; content: string; icon: string }[]) => void }) => {
    const icons = ["UserPlus", "TrendingUp", "Ticket", "Award", "FileText", "AlertCircle", "Info", "Search", "Calendar", "Clock", "Gift", "ScrollText"];

    const addRule = () => {
        onChange([...rules, { title: "", content: "", icon: "Info" }]);
    };

    const removeRule = (index: number) => {
        onChange(rules.filter((_, i) => i !== index));
    };

    const updateRule = (index: number, field: string, value: string) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [field]: value };
        onChange(newRules);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-muted-foreground uppercase">Kullanıcı Kuralları (FAQ)</label>
                <Button type="button" size="sm" onClick={addRule} className="gap-2">
                    <Plus className="h-4 w-4" /> Kural Ekle
                </Button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {rules.length === 0 && (
                    <div className="text-center p-8 bg-black/20 rounded-lg border border-dashed border-white/10">
                        <p className="text-muted-foreground text-sm italic">Henüz kural eklenmemiş. "Kural Ekle" butonu ile başlayın.</p>
                    </div>
                )}

                {rules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-4 relative group">
                        <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <X className="h-3 w-3 text-white" />
                        </button>

                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-8 space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Başlık</label>
                                <Input
                                    value={rule.title}
                                    onChange={e => updateRule(idx, "title", e.target.value)}
                                    placeholder="Örn: Nasıl Katılırım?"
                                    className="bg-black/20"
                                />
                            </div>
                            <div className="col-span-4 space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">İkon</label>
                                <Select value={rule.icon} onValueChange={val => updateRule(idx, "icon", val)}>
                                    <SelectTrigger className="bg-black/20 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {icons.map(icon => (
                                            <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">İçerik</label>
                            <textarea
                                value={rule.content}
                                onChange={e => updateRule(idx, "content", e.target.value)}
                                placeholder="Kural detaylarını buraya yazın..."
                                className="flex min-h-[60px] w-full rounded-md border border-input bg-black/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default function AdminPage() {

    const { toast } = useToast()
    const { logout, adminRole } = useAuth()
    const [activeTab, setActiveTab] = useState<"dashboard" | "events" | "participants" | "users" | "leagues">(adminRole === 'moderator' ? 'events' : 'dashboard')
    const [selectedParticipant, setSelectedParticipant] = useState<any | null>(null)
    const [userCoupons, setUserCoupons] = useState<any[]>([])
    const [totalUserCoupons, setTotalUserCoupons] = useState(0)
    const [loadingCoupons, setLoadingCoupons] = useState(false)
    const [couponPage, setCouponPage] = useState(1)
    const [expandedCouponId, setExpandedCouponId] = useState<number | null>(null)
    const [couponSearch, setCouponSearch] = useState("")
    const [debouncedCouponSearch, setDebouncedCouponSearch] = useState("")
    const COUPON_LIMIT = 20

    const [stats, setStats] = useState<any>(null)

    const [participants, setParticipants] = useState<any[]>([])
    const [totalParticipants, setTotalParticipants] = useState(0)
    const [page, setPage] = useState(1)
    const [limit] = useState(20)
    const [searchQuery, setSearchQuery] = useState("")
    const [leagueSearchQuery, setLeagueSearchQuery] = useState("")
    const [leaguesData, setLeaguesData] = useState<any[]>([])
    const [loadingLeagues, setLoadingLeagues] = useState(false)
    const [showAddLeague, setShowAddLeague] = useState(false)
    const [editingLeague, setEditingLeague] = useState<any | null>(null)
    const [newLeague, setNewLeague] = useState({ id: "", name: "", sport_id: 1, region: "" })

    // Worker Progress Modal states
    const [workerJob, setWorkerJob] = useState<any | null>(null)
    const [showWorkerModal, setShowWorkerModal] = useState(false)
    const [workerConflict, setWorkerConflict] = useState<{ jobId: number; event: any } | null>(null)
    const [workerStartTime, setWorkerStartTime] = useState<number | null>(null)
    const [workerElapsedSeconds, setWorkerElapsedSeconds] = useState(0)
    const [workerEstimatedSeconds, setWorkerEstimatedSeconds] = useState<number | null>(null)

    useEffect(() => {
        if (!showWorkerModal || !workerStartTime) return
        const interval = setInterval(() => {
            setWorkerElapsedSeconds(Math.floor((Date.now() - workerStartTime) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [showWorkerModal, workerStartTime])

    useEffect(() => {
        if (activeTab === "leagues") {
            loadLeaguesData()
        }
    }, [activeTab])

    const loadLeaguesData = async () => {
        setLoadingLeagues(true)
        try {
            const res = await fetchLeagues()
            setLeaguesData(res)
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingLeagues(false)
        }
    }

    const handleSaveLeague = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingLeague) {
                await updateLeague(editingLeague.id, {
                    id: editingLeague.id,
                    name: newLeague.name,
                    sport_id: newLeague.sport_id,
                    region: newLeague.region
                })
                toast({ title: "Başarılı", description: "Lig güncellendi" })
            } else {
                await createLeague({
                    id: parseInt(newLeague.id),
                    name: newLeague.name,
                    sport_id: newLeague.sport_id,
                    region: newLeague.region
                })
                toast({ title: "Başarılı", description: "Yeni lig eklendi" })
            }
            setShowAddLeague(false)
            setEditingLeague(null)
            setNewLeague({ id: "", name: "", sport_id: 1, region: "" })
            loadLeaguesData()
        } catch (err: any) {
            toast({ title: "Hata", description: err?.response?.data?.detail || "İşlem başarısız", variant: "destructive" })
        }
    }

    const handleDeleteLeague = async (id: number) => {
        if (confirm("Bu ligi silmek istediğinize emin misiniz?")) {
            try {
                await deleteLeague(id)
                toast({ title: "Başarılı", description: "Lig silindi" })
                loadLeaguesData()
            } catch (e) {
                toast({ title: "Hata", description: "Silme işlemi başarısız", variant: "destructive" })
            }
        }
    }

    const [debouncedSearch, setDebouncedSearch] = useState("")

    const [adminUsers, setAdminUsers] = useState<any[]>([])
    const [events, setEvents] = useState<any[]>([])
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)

    const [showAddUser, setShowAddUser] = useState(false)
    const [editingUser, setEditingUser] = useState<any>(null)
    const [newUser, setNewUser] = useState({ username: "", password: "", email: "", role: "admin" })

    const fetchLeagues = async (search = "") => {
        const res = await apiClient.get('/leagues', { params: { search, limit: 100 } })
        return res.data
    }



    const [eventFilter, setEventFilter] = useState<'active' | 'past' | 'archived'>('active')

    const DEFAULT_NEW_EVENT = {
        name: "",
        slug: "",
        description: "",
        start_date: "",
        end_date: "",
        display_until: "",
        won_point_multiplier: 1.0,
        loss_point_multiplier: 0.0,
        image_url: "",
        rules: {
            min_stake: 100,
            min_odd: 1.5,
            min_combination: 2,
            max_combination: null as number | null,
            allowed_league_ids: [] as number[],
            yan_bahis_ids: [] as number[],
            scoring_formula: "stake_times_odds_raw" as "simple" | "stake_times_odds" | "stake_times_odds_raw" | "net_profit_multiplier",
            min_deposit: 0,
            rewards: [] as any[]
        },
        content_rules: [] as { title: string; content: string; icon: string }[]
    }
    const [showAddEvent, setShowAddEvent] = useState(false)
    const [newEvent, setNewEvent] = useState(DEFAULT_NEW_EVENT)
    const [leagueIdsInput, setLeagueIdsInput] = useState("")
    const [modalTab, setModalTab] = useState<"general" | "rules" | "rewards" | "content_rules">("general")
    const [rewardHistory, setRewardHistory] = useState<any[]>([])
    const [loadingRewards, setLoadingRewards] = useState(false)

    const [showEditEvent, setShowEditEvent] = useState(false)
    const [editingEvent, setEditingEvent] = useState<any>(null)
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [historyEvent, setHistoryEvent] = useState<any>(null)
    const [rewardPoolEvent, setRewardPoolEvent] = useState<any>(null)

    const [viewEventId, setViewEventId] = useState<number | null>(null)
    const [eventStats, setEventStats] = useState<any>(null)
    const [showManualCouponModal, setShowManualCouponModal] = useState(false)
    const [manualCouponEventId, setManualCouponEventId] = useState<number | null>(null)
    const [manualCouponBetId, setManualCouponBetId] = useState("")
    const [manualCouponLoading, setManualCouponLoading] = useState(false)
    const [loadingEventDetail, setLoadingEventDetail] = useState(false)

    const [imageUploadLoading, setImageUploadLoading] = useState(false)
    const [tempImageFile, setTempImageFile] = useState<File | null>(null)

    useEffect(() => {
        loadData()
    }, [selectedEventId, page, debouncedSearch])


    useEffect(() => {
        if (selectedParticipant) {
            handleSelectParticipant(selectedParticipant)
        }
    }, [selectedEventId, couponPage, debouncedCouponSearch])

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCouponSearch(couponSearch)
            setCouponPage(1)
        }, 500)
        return () => clearTimeout(timer)
    }, [couponSearch])

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(1) // Reset to page 1 on search change
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const loadData = async () => {
        setLoading(true)
        try {
            const [s, p, u, e] = await Promise.all([
                adminRole !== 'moderator' ? fetchAdminStats().catch(() => null) : Promise.resolve(null),
                fetchParticipants(selectedEventId || undefined, (page - 1) * limit, limit, debouncedSearch).catch((err) => { console.error(err); return { items: [], total: 0 } }),
                adminRole !== 'moderator' ? fetchAdminUsers().catch(() => []) : Promise.resolve([]),
                fetchEvents().catch((err) => { console.error(err); return [] })
            ])
            setStats(s)
            if (p && p.items) {
                setParticipants(Array.isArray(p.items) ? p.items : [])
                setTotalParticipants(p.total || 0)
            } else {
                setParticipants(Array.isArray(p) ? p : [])
                setTotalParticipants(Array.isArray(p) ? p.length : 0)
            }
            setAdminUsers(Array.isArray(u) ? u : [])
            setEvents(Array.isArray(e) ? e : [])
        } catch (err) {
            console.error("Data load failed", err)
            toast({
                title: "Uyarı",
                description: "Bazı veriler yüklenirken yetki sorunu veya hata oluştu.",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handleExportExcel = async (eventId: number) => {
        try {
            const response = await apiClient.get(`/admin/events/${eventId}/participants/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `event_${eventId}_participants.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export error:", error);
            toast({
                title: "Hata",
                description: "Excel indirilemedi.",
                variant: "destructive"
            });
        }
    };

    const handleManualCouponSubmit = async () => {
        if (!manualCouponEventId || !manualCouponBetId.trim()) return
        setManualCouponLoading(true)
        try {
            const res = await addManualCoupon(manualCouponEventId, manualCouponBetId.trim())
            toast({
                title: "Başarılı",
                description: res.message || `Kupon eklendi. Kullanıcı: ${res.client_login || ""}`,
            })
            setShowManualCouponModal(false)
            setManualCouponEventId(null)
            setManualCouponBetId("")
            if (viewEventId === manualCouponEventId) {
                const [stats, partsData] = await Promise.all([
                    getEventStats(manualCouponEventId),
                    fetchEventParticipants(manualCouponEventId)
                ])
                setEventStats(stats)
                setParticipants(partsData.items || [])
            } else {
                const eList = await fetchEvents()
                setEvents(eList)
            }
        } catch (err: any) {
            const detail = err?.response?.data?.detail
            const msg = (typeof detail === "string" ? detail : detail?.message || detail?.detail) || "Kupon eklenemedi."
            toast({
                title: "Hata",
                description: msg,
                variant: "destructive"
            })
        } finally {
            setManualCouponLoading(false)
        }
    };

    const handleSelectParticipant = async (p: any) => {
        if (selectedParticipant?.id !== p.id) {
            setCouponPage(1)
        }

        setSelectedParticipant(p)
        setLoadingCoupons(true)
        try {
            const skip = (couponPage - 1) * COUPON_LIMIT
            const data = await fetchUserCoupons(p.client_id, selectedEventId || undefined, skip, COUPON_LIMIT, debouncedCouponSearch)

            if (data.items) {
                setUserCoupons(data.items)
                setTotalUserCoupons(data.total)
                // Update participant points with context-aware total
                if (data.total_points !== undefined) {
                    setSelectedParticipant((prev: any) => ({ ...prev, points: data.total_points }))
                }
            } else {
                setUserCoupons(data)
                setTotalUserCoupons(data.length)
            }
        } catch (err) {
            console.error("Coupons fetch failed", err)
        } finally {
            setLoadingCoupons(false)
        }
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving("create_user")
        try {
            await createAdminUser(newUser)
            toast({
                title: "Başarılı",
                description: "Kullanıcı başarıyla oluşturuldu.",
            })
            setShowAddUser(false)
            setNewUser({ username: "", password: "", email: "", role: "admin" })
            const u = await fetchAdminUsers()
            setAdminUsers(u)
        } catch (err: any) {
            toast({
                title: "Hata",
                description: err.response?.data?.detail || "Kullanıcı oluşturulamadı.",
                variant: "destructive"
            })
        } finally {
            setSaving(null)
        }
    }

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingUser) return
        setSaving("update_user")
        try {
            const payload: any = {
                username: editingUser.username,
                email: editingUser.email,
                role: editingUser.role,
                is_active: editingUser.is_active
            }
            if (editingUser.password && editingUser.password.trim() !== "") {
                payload.password = editingUser.password
            }

            await updateAdminUser(editingUser.id, payload)
            toast({
                title: "Başarılı",
                description: "Kullanıcı başarıyla güncellendi.",
            })
            setEditingUser(null)
            const u = await fetchAdminUsers()
            setAdminUsers(u)
        } catch (err: any) {
            toast({
                title: "Hata",
                description: err.response?.data?.detail || "Kullanıcı güncellenemedi.",
                variant: "destructive"
            })
        } finally {
            setSaving(null)
        }
    }

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving("create_event")
        try {
            const payload = {
                ...newEvent,
                slug: newEvent.slug || null,
                start_date: newEvent.start_date.length === 16 ? newEvent.start_date + ":00" : newEvent.start_date,
                end_date: newEvent.end_date.length === 16 ? newEvent.end_date + ":00" : newEvent.end_date,
                display_until: newEvent.display_until ? (newEvent.display_until.length === 16 ? newEvent.display_until + ":00" : newEvent.display_until) : null,
                content_rules: newEvent.content_rules || []
            }
            const createdEvent = await createEvent(payload)

            // Upload image if selected
            if (tempImageFile && createdEvent.id) {
                try {
                    await uploadEventImage(createdEvent.id, tempImageFile)
                } catch (imgErr) {
                    console.error("Image upload failed:", imgErr)
                    toast({ title: "Uyarı", description: "Kampanya oluşturuldu ama resim yüklenemedi.", variant: "destructive" })
                }
            }

            toast({
                title: "Başarılı",
                description: "Kampanya taslağı oluşturuldu.",
            })
            setShowAddEvent(false)
            setNewEvent(DEFAULT_NEW_EVENT)
            setTempImageFile(null)
            const eList = await fetchEvents()
            setEvents(eList)
        } catch (err: any) {
            console.error("Create Event Error:", err)
            let msg = "Kampanya oluşturulamadı."
            if (err.response?.data?.detail) {
                const d = err.response.data.detail
                if (typeof d === "string") msg = d
                else if (Array.isArray(d)) msg = d.map((e: any) => `${e.loc.join('.')} : ${e.msg}`).join(' | ')
                else msg = JSON.stringify(d)
            }
            toast({
                title: "Hata",
                description: msg,
                variant: "destructive"
            })
        } finally {
            setSaving(null)
        }
    }

    const handleEventStatus = async (id: number, status: string) => {
        try {
            await updateEventStatus(id, status)
            toast({
                title: "Başarılı",
                description: `Kampanya durumu güncellendi: ${status}`,
            })
            const e = await fetchEvents()
            setEvents(e)
        } catch (err: any) {
            toast({
                title: "Hata",
                description: err.response?.data?.detail || "Durum güncellenemedi",
                variant: "destructive"
            })
        }
    }


    const handleDeleteEvent = async (id: number) => {
        if (!confirm("Bu kampanyayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
        try {
            await deleteEvent(id)
            toast({
                title: "Başarılı",
                description: "Kampanya silindi.",
            })
            const e = await fetchEvents()
            setEvents(e)
        } catch (err: any) {
            toast({
                title: "Hata",
                description: "Silme işlemi başarısız: " + (err.response?.data?.detail || err.message),
                variant: "destructive"
            })
        }
    }

    const handleCancelJob = async (jobId: number) => {
        try {
            await apiClient.post(`/admin/worker-jobs/${jobId}/cancel`)
            toast({ title: "İptal Ediliyor", description: "İşlem durduruluyor..." })
        } catch (e) {
            toast({ title: "Hata", description: "İptal edilemedi", variant: "destructive" })
        }
    }

    const handleCancelAndRetry = async () => {
        if (!workerConflict) return
        const { jobId, event } = workerConflict
        setWorkerConflict(null)
        try {
            await apiClient.post(`/admin/worker-jobs/${jobId}/cancel`)
            toast({ title: "İptal Edildi", description: "Yeniden başlatılıyor..." })
            await new Promise(r => setTimeout(r, 500))
            handleRunWorker(event)
        } catch (e) {
            toast({ title: "Hata", description: "İptal edilemedi", variant: "destructive" })
        }
    }

    const handleRunWorker = async (event: any) => {
        try {
            const res = await runEventWorker(event.id)
            const jobId = res.job_id

            setWorkerJob({ id: jobId, status: 'pending', total: 0, processed: 0, saved: 0, event_name: event.name })
            setShowWorkerModal(true)
            setWorkerStartTime(Date.now())
            setWorkerElapsedSeconds(0)
            setWorkerEstimatedSeconds(event.avg_worker_duration_seconds ?? 120)

            const checkStatus = setInterval(async () => {
                try {
                    const statusRes = await apiClient.get(`/admin/worker-jobs/${jobId}`)
                    const job = statusRes.data

                    setWorkerJob((prev: any) => ({ ...prev, ...job, event_name: event.name }))

                    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
                        clearInterval(checkStatus)
                        if (job.status === 'completed') {
                            toast({
                                title: "İşlem Tamamlandı",
                                description: `${job.total || job.processed} kullanıcı incelendi.`,
                                duration: 5000
                            })
                            // Event listesini yenile → "Son Kupon Çekilme" saati güncellensin
                            try {
                                const updatedEvents = await fetchEvents()
                                setEvents(updatedEvents)
                            } catch (refreshErr) {
                                console.error("Event refresh failed", refreshErr)
                            }
                        }
                    }
                } catch (e) {
                    console.error("Status check failed", e)
                    clearInterval(checkStatus)
                }
            }, 2000)

        } catch (err: any) {
            if (err.response?.status === 409) {
                const d = err.response?.data?.detail
                const jobId = typeof d === 'object' && d?.running_job_id ? d.running_job_id : null
                const msg = typeof d === 'object' ? d?.message : d
                if (jobId) {
                    setWorkerConflict({ jobId, event })
                } else {
                    toast({
                        title: "Worker Çalışıyor",
                        description: msg || "Başka bir worker zaten çalışıyor. Lütfen tamamlanmasını bekleyin.",
                        variant: "destructive",
                        duration: 5000
                    })
                }
            } else {
                toast({
                    title: "Hata",
                    description: err.response?.data?.detail || "Kupon çekme işlemi başlatılamadı",
                    variant: "destructive"
                })
            }
        }
    }

    const handleImageUpload = async (eventId: number, file: File, isEdit: boolean) => {
        setImageUploadLoading(true)
        try {
            const data = await uploadEventImage(eventId, file)
            const newImageUrl = data.image_url
            if (isEdit) {
                setEditingEvent((prev: any) => ({ ...prev, image_url: newImageUrl }))
            } else {
                setNewEvent((prev: any) => ({ ...prev, image_url: newImageUrl }))
            }
            toast({ title: "Başarılı", description: "Resim yüklendi." })
            const eList = await fetchEvents()
            setEvents(eList)
        } catch (e: any) {
            toast({ title: "Hata", description: "Resim yüklenemedi.", variant: "destructive" })
        } finally {
            setImageUploadLoading(false)
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, eventId?: number) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (eventId) {
            await handleImageUpload(eventId, file, true)
        } else {
            setTempImageFile(file)
        }
    }

    const openEditModal = (event: any) => {
        const rules = event.rules || {}
        setEditingEvent({
            ...event,
            description: event.description || "",
            start_date: formatDateTimeLocal(event.start_date),
            end_date: formatDateTimeLocal(event.end_date),
            display_until: event.display_until ? formatDateTimeLocal(event.display_until) : "",
            rules: {
                min_stake: rules.min_stake ?? 100,
                min_odd: rules.min_odd ?? 1.5,
                min_combination: rules.min_combination ?? 2,
                allowed_league_ids: rules.allowed_league_ids ?? [],
                yan_bahis_ids: rules.yan_bahis_ids ?? [],
                min_deposit: rules.min_deposit ?? 1000,
                rewards: rules.rewards || [],
                ...rules
            }
        })
        setLeagueIdsInput(rules.allowed_league_ids ? rules.allowed_league_ids.join(", ") : "")
        setShowEditEvent(true)
        setModalTab("general")
    }

    const handleExportParticipants = async (eventId: number, eventName: string) => {
        try {
            const response = await apiClient.get(`/admin/events/${eventId}/participants/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${eventName}_katilimcilar.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast({ title: "Başarılı", description: "Katılımcı listesi indiriliyor." });
        } catch (err: any) {
            toast({ title: "Hata", description: "Dosya indirilemedi.", variant: "destructive" });
        }
    };

    const handleExportCoupons = async (eventId: number, eventName: string) => {
        try {
            const response = await apiClient.get(`/admin/events/${eventId}/coupons/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${eventName}_kuponlar.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast({ title: "Başarılı", description: "Kupon listesi indiriliyor." });
        } catch (err: any) {
            toast({ title: "Hata", description: "Dosya indirilemedi.", variant: "destructive" });
        }
    };

    const handleExportRewardHistory = async (eventId: number, eventName: string) => {
        try {
            const response = await apiClient.get(`/admin/events/${eventId}/reward-history/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${eventName}_odul_gecmisi.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast({ title: "Başarılı", description: "Ödül geçmişi indiriliyor." });
        } catch (err: any) {
            toast({ title: "Hata", description: "Dosya indirilemedi.", variant: "destructive" });
        }
    };

    const handleLoadRewardHistory = async (eventId: number) => {
        setLoadingRewards(true)
        try {
            const history = await fetchRewardHistory(eventId)
            setRewardHistory(history)
        } catch (e) {
            toast({ title: "Hata", description: "Ödül geçmişi yüklenemedi.", variant: "destructive" })
        } finally {
            setLoadingRewards(false)
        }
    }

    const handleUpdateEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving("update_event")
        try {
            console.log("Preparing payload for event:", editingEvent.id)
            const payload = {
                name: editingEvent.name,
                slug: editingEvent.slug || null,
                description: editingEvent.description || "",
                start_date: editingEvent.start_date.length === 16 ? editingEvent.start_date + ":00" : editingEvent.start_date,
                end_date: editingEvent.end_date.length === 16 ? editingEvent.end_date + ":00" : editingEvent.end_date,
                display_until: editingEvent.display_until ? (editingEvent.display_until.length === 16 ? editingEvent.display_until + ":00" : editingEvent.display_until) : null,
                won_point_multiplier: Number(editingEvent.won_point_multiplier),
                loss_point_multiplier: Number(editingEvent.loss_point_multiplier),
                rules: {
                    ...editingEvent.rules,
                    min_stock: undefined,
                    min_stake: Number(editingEvent.rules.min_stake),
                    min_odd: Number(editingEvent.rules.min_odd),
                    min_combination: Number(editingEvent.rules.min_combination),
                    max_combination: editingEvent.rules.max_combination ? Number(editingEvent.rules.max_combination) : null,
                    min_deposit: isNaN(editingEvent.rules.min_deposit) ? 0 : Number(editingEvent.rules.min_deposit),
                    scoring_formula: editingEvent.rules.scoring_formula
                },
                content_rules: editingEvent.content_rules || []
            }
            console.log("Sending payload:", payload)
            await updateEvent(editingEvent.id, payload)
            toast({
                title: "Başarılı",
                description: "Kampanya başarıyla güncellendi.",
            })
            setShowEditEvent(false)
            setEditingEvent(null)
            const updatedEvents = await fetchEvents()
            setEvents(updatedEvents)
        } catch (err: any) {
            console.error("Update failed:", err)
            const status = err.response?.status
            const detail = err.response?.data?.detail
            const errorMsg = typeof detail === 'string'
                ? detail
                : (typeof detail === 'object' ? JSON.stringify(detail) : (err.message || "Güncelleme başarısız."))

            toast({
                title: `Hata (${status || 'Network'})`,
                description: errorMsg,
                variant: "destructive"
            })
        } finally {
            setSaving(null)
        }
    }


    const fetchEventParticipants = async (eventId: number) => {
        const res = await apiClient.get(`/admin/events/${eventId}/participants`)
        return res.data
    }

    // ... existing code ...

    const handleViewDetails = async (event: any) => {
        setViewEventId(event.id)
        setLoadingEventDetail(true)
        try {
            const [stats, partsData] = await Promise.all([
                getEventStats(event.id),
                fetchEventParticipants(event.id)
            ])
            setEventStats(stats)
            if (partsData?.items) {
                setParticipants(partsData.items)
            } else {
                setParticipants(Array.isArray(partsData) ? partsData : [])
            }
        } catch (e) {
            console.error(e)
            setViewEventId(null)
            toast({
                title: "Hata",
                description: "Detaylar yüklenemedi.",
                variant: "destructive"
            })
        } finally {
            setLoadingEventDetail(false)
        }
    }


    const handleBackToEvents = async () => {
        setViewEventId(null)
        setEventStats(null)
        loadData()
    }

    const handleDeleteUser = async (id: number) => {
        if (!confirm("Bu yöneticiyi silmek istediğinize emin misiniz?")) return

        try {
            await deleteAdminUser(id)
            toast({
                title: "Başarılı",
                description: "Kullanıcı silindi.",
            })
            const u = await fetchAdminUsers()
            setAdminUsers(u)
        } catch (err) {
            toast({
                title: "Hata",
                description: "Silme işlemi başarısız.",
                variant: "destructive"
            })
        } finally {
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Admin Paneli Yükleniyor...</p>
            </div>
        )
    }

    // ... existing imports ...

    const getHeaderInfo = () => {
        if (activeTab === 'dashboard') return { title: "Genel Bakış", description: "Sistem durumunu kontrol et ve yönet." }
        if (activeTab === 'events') return { title: "Kampanya & Etkinlik Yönetimi", description: "Etkinlikleri düzenle ve takip et." }
        if (activeTab === 'participants') return { title: selectedParticipant ? "Kupon Detayları" : "Katılımcı Yönetimi", description: selectedParticipant ? `${selectedParticipant.username} kullanıcısının bahis geçmişi.` : "Katılımcı listesi." }
        if (activeTab === 'users') return { title: "Yönetici Ayarları", description: "Sistem yöneticilerini yönet." }
        return { title: "Admin Panel", description: "" }
    }
    const { title, description } = getHeaderInfo()

    return (
        <AdminLayout
            activeTab={activeTab}
            setActiveTab={(tab) => { setActiveTab(tab); setSelectedParticipant(null); }}
            logout={() => { localStorage.removeItem('admin_token'); window.location.href = '/login' }}
            headerTitle={title}
            headerDescription={description}
        >

            {activeTab === 'leagues' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold font-oswald text-white flex items-center gap-2">
                            Lig Yönetimi
                        </h2>
                        <Button onClick={() => { setEditingLeague(null); setNewLeague({ id: "", name: "", sport_id: 1, region: "" }); setShowAddLeague(true) }} className="bg-amber-500 hover:bg-amber-600 font-bold gap-2">
                            <Plus className="h-4 w-4" /> Yeni Lig Ekle
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                        <div className="flex-1">
                            <Input
                                placeholder="Lig ID veya Adı ile ara..."
                                value={leagueSearchQuery}
                                onChange={(e) => setLeagueSearchQuery(e.target.value)}
                                className="h-11 bg-white/5 border-white/10 w-full md:w-96"
                            />
                        </div>
                    </div>

                    {showAddLeague && (
                        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                            <Card className="bg-slate-900 border-white/10 shadow-2xl w-full max-w-2xl animate-in zoom-in-95">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold text-white">{editingLeague ? "Ligi Düzenle" : "Yeni Lig Ekle"}</CardTitle>
                                    <div className="text-sm text-muted-foreground">Bir ligin BetConstruct ID'sini girebilir ve bir isim belirleyebilirsiniz.</div>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSaveLeague} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Lig ID</label>
                                            <Input
                                                disabled={!!editingLeague}
                                                type="number"
                                                className="h-11 bg-white/5 border-white/10"
                                                placeholder="Örn: 999123"
                                                value={newLeague.id}
                                                onChange={e => setNewLeague({ ...newLeague, id: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Lig Adı</label>
                                            <Input
                                                className="h-11 bg-white/5 border-white/10"
                                                placeholder="Örn: Türkiye Süper Lig"
                                                value={newLeague.name}
                                                onChange={e => setNewLeague({ ...newLeague, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Spor Türü</label>
                                            <Select
                                                value={newLeague.sport_id.toString()}
                                                onValueChange={v => setNewLeague({ ...newLeague, sport_id: parseInt(v) })}
                                            >
                                                <SelectTrigger className="h-11 bg-white/5 border-white/10">
                                                    <SelectValue placeholder="Spor Seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">Futbol (1)</SelectItem>
                                                    <SelectItem value="2">Basketbol (2)</SelectItem>
                                                    <SelectItem value="3">Voleybol (3)</SelectItem>
                                                    <SelectItem value="4">Tenis (4)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-4 flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
                                            <Button type="button" variant="ghost" onClick={() => setShowAddLeague(false)}>İptal</Button>
                                            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 font-bold px-8">Kaydet</Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    <Card className="bg-black/40 border-white/5 backdrop-blur-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-white/5 border-b border-white/5">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">LİG ID</th>
                                        <th className="px-6 py-4 font-bold">LİG ADI</th>
                                        <th className="px-6 py-4 font-bold">SPOR TÜRÜ</th>
                                        <th className="px-6 py-4 font-bold text-right">İŞLEMLER</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaguesData.filter(l => {
                                        const q = leagueSearchQuery.toLowerCase();
                                        const sportName = l.sport_id === 1 ? 'futbol' : l.sport_id === 2 ? 'basketbol' : l.sport_id === 3 ? 'voleybol' : l.sport_id === 4 ? 'tenis' : 'diğer';
                                        return l.name.toLowerCase().includes(q) || l.id.toString().includes(q) || sportName.includes(q);
                                    }).map((league) => (
                                        <tr key={league.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4"><Badge variant="outline" className="font-mono">#{league.id}</Badge></td>
                                            <td className="px-6 py-4 font-medium text-white">{league.name}</td>
                                            <td className="px-6 py-4"><Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">{league.sport_id === 1 ? 'Futbol' : league.sport_id === 2 ? 'Basketbol' : league.sport_id === 3 ? 'Voleybol' : league.sport_id === 4 ? 'Tenis' : 'Diğer (' + league.sport_id + ')'}</Badge></td>
                                            <td className="px-6 py-4 text-right">
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    setEditingLeague(league)
                                                    setNewLeague({ id: league.id.toString(), name: league.name, sport_id: league.sport_id || 1, region: league.region || "" })
                                                    setShowAddLeague(true)
                                                }} className="h-8 w-8 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"><Pencil className="h-4 w-4" /></Button>
                                                <Button size="icon" variant="ghost" onClick={() => handleDeleteLeague(league.id)} className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10 ml-2"><Trash2 className="h-4 w-4" /></Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {leaguesData.filter(l => {
                                        const q = leagueSearchQuery.toLowerCase();
                                        const sportName = l.sport_id === 1 ? 'futbol' : l.sport_id === 2 ? 'basketbol' : l.sport_id === 3 ? 'voleybol' : l.sport_id === 4 ? 'tenis' : 'diğer';
                                        return l.name.toLowerCase().includes(q) || l.id.toString().includes(q) || sportName.includes(q);
                                    }).length === 0 && !loadingLeagues && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Aradığınız kriterlere uygun lig bulunamadı</td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Toplam Katılımcı" value={stats?.total_participants || 0} icon={Users} color="text-blue-500" />
                    <StatCard title="Toplam Kupon" value={stats?.total_coupons || 0} icon={FileText} color="text-purple-500" />
                    <StatCard title="Aktif Kampanya" value={events.filter(e => e.status === 'active').length} icon={Trophy} color="text-yellow-500" />
                    <StatCard title="Bekleyen Kontrol" value={stats?.pending_coupons || 0} icon={AlertCircle} color="text-orange-500" />
                </div>
            )}

            {activeTab === 'events' && (
                <>
                {viewEventId && (eventStats || loadingEventDetail) ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 relative">
                        {loadingEventDetail && (
                            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl min-h-[200px]">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
                                    <span className="text-sm text-muted-foreground">Detaylar yükleniyor...</span>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <Button variant="outline" onClick={handleBackToEvents} className="gap-2">
                                <ArrowLeft className="h-4 w-4" /> Kampanyalara Dön
                            </Button>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-lg py-1 px-4 border-primary/20 bg-primary/10 text-primary uppercase tracking-widest font-black italic">
                                    {eventStats?.event_name || "—"}
                                </Badge>
                                <Badge variant="secondary" className="uppercase">{eventStats?.status || "—"}</Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard title="Katılımcı" value={eventStats?.total_participants ?? 0} icon={Users} color="text-blue-500" />
                            <StatCard title="Toplam Kupon" value={eventStats?.total_coupons ?? 0} icon={FileText} color="text-purple-500" />
                            <StatCard title="Toplam Bahis" value={`₺${eventStats?.total_stake ?? 0}`} icon={History} color="text-green-500" />
                            <StatCard title="Dağıtılan Puan" value={eventStats?.total_points_distributed ?? 0} icon={Trophy} color="text-yellow-500" />
                        </div>

                        <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="flex justify-between items-center">
                                    <span>Etkinlik Liderlik Tablosu</span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleExportExcel(viewEventId)} className="gap-2">
                                            <Download className="h-4 w-4" /> Excel İndir
                                        </Button>
                                    </div>
                                </CardTitle>
                                <CardDescription>Bu kampanyada en çok puan toplayan katılımcılar.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-white/5 text-muted-foreground text-xs uppercase tracking-wider">
                                                <th className="px-4 py-3 font-bold w-16">Sıra</th>
                                                <th className="px-4 py-3 font-bold">Kullanıcı</th>
                                                <th className="px-4 py-3 font-bold">Kupon</th>
                                                <th className="px-4 py-3 font-bold text-right">Puan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {participants.map((p, index) => (
                                                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-4 font-mono text-muted-foreground">#{index + 1}</td>
                                                    <td className="px-4 py-4 font-bold">{p.username}</td>
                                                    <td className="px-4 py-4"><Badge variant="secondary">{p.coupon_count}</Badge></td>
                                                    <td className="px-4 py-4 font-black italic text-right text-primary text-lg">
                                                        {(Math.floor((p.points || 0) * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                            {participants.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">Henüz katılım yok.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1 bg-black/30 p-1 rounded-lg border border-white/5">
                                <button onClick={() => setEventFilter('active')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${eventFilter === 'active' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}>
                                    Aktif <span className="ml-1.5 text-xs opacity-70">({events.filter(e => ['draft', 'active', 'paused'].includes(e.status)).length})</span>
                                </button>
                                <button onClick={() => setEventFilter('past')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${eventFilter === 'past' ? 'bg-orange-500/20 text-orange-400 shadow-sm' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}>
                                    Geçmiş <span className="ml-1.5 text-xs opacity-70">({events.filter(e => e.status === 'ended').length})</span>
                                </button>
                                <button onClick={() => setEventFilter('archived')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${eventFilter === 'archived' ? 'bg-gray-500/20 text-gray-400 shadow-sm' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}>
                                    Arşiv <span className="ml-1.5 text-xs opacity-70">({events.filter(e => e.status === 'archived').length})</span>
                                </button>
                            </div>
                            {adminRole !== 'moderator' && (
                                <Button onClick={() => { setLeagueIdsInput(""); setNewEvent(DEFAULT_NEW_EVENT); setModalTab("general"); setShowAddEvent(true); }} className="gap-2 bg-primary hover:bg-primary/90 font-bold">
                                    <Plus className="h-4 w-4" /> Yeni Kampanya
                                </Button>
                            )}
                        </div>

                        {/* Event List */}
                        <div className="grid grid-cols-1 gap-6">
                            {events.filter(event => {
                                if (eventFilter === 'active') return ['draft', 'active', 'paused'].includes(event.status)
                                if (eventFilter === 'past') return event.status === 'ended'
                                if (eventFilter === 'archived') return event.status === 'archived'
                                return true
                            }).map(event => (
                                <Card key={event.id} className="bg-card/40 border-white/5 backdrop-blur-xl hover:border-primary/20 transition-all">
                                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                        <div className="h-16 w-24 bg-black/40 rounded flex items-center justify-center overflow-hidden border border-white/5 shrink-0 shadow-inner">
                                            {event.image_url ? (
                                                <img src={`${event.image_url}`} alt={event.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <Trophy className="h-6 w-6 text-white/10" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <Badge variant="outline" className={`font-bold ${event.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : event.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'text-muted-foreground'}`}>
                                                    {event.status.toUpperCase()}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground font-mono">ID: {event.id} | Slug: {event.slug}</span>
                                            </div>
                                            <CardTitle className="text-xl font-bold">{event.name}</CardTitle>
                                            <CardDescription>{event.description || "Açıklama yok"}</CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            {/* Status Actions */}
                                            {adminRole !== 'moderator' && event.status === 'draft' && (
                                                <Button size="sm" variant="outline" className="border-green-800 text-green-500 hover:bg-green-500/10" onClick={() => handleEventStatus(event.id, 'active')}>
                                                    <PlayCircle className="h-4 w-4 mr-2" /> Başlat
                                                </Button>
                                            )}
                                            {adminRole !== 'moderator' && event.status === 'active' && (
                                                <Button size="sm" variant="outline" className="border-orange-800 text-orange-500 hover:bg-orange-500/10" onClick={() => handleEventStatus(event.id, 'paused')}>
                                                    <PauseCircle className="h-4 w-4 mr-2" /> Duraklat
                                                </Button>
                                            )}
                                            {adminRole !== 'moderator' && (event.status === 'active' || event.status === 'paused') && (
                                                <Button size="sm" variant="outline" className="border-red-800 text-red-500 hover:bg-red-500/10" onClick={() => handleEventStatus(event.id, 'ended')}>
                                                    <StopCircle className="h-4 w-4 mr-2" /> Bitir
                                                </Button>
                                            )}
                                            {adminRole !== 'moderator' && event.status === 'ended' && (
                                                <>
                                                    <Button size="sm" variant="outline" className="border-green-800 text-green-500 hover:bg-green-500/10" onClick={() => handleEventStatus(event.id, 'active')}>
                                                        <PlayCircle className="h-4 w-4 mr-2" /> Tekrar Başlat
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => handleEventStatus(event.id, 'archived')}>
                                                        <Archive className="h-4 w-4 mr-2" /> Arşivle
                                                    </Button>
                                                </>
                                            )}



                                            {adminRole !== 'moderator' && (
                                                <Button size="sm" variant="outline" className="border-yellow-800 text-yellow-500 hover:bg-yellow-500/10 font-bold gap-2" onClick={() => handleRunWorker(event)} title="Kuponları Çek">
                                                    <RefreshCw className="h-4 w-4" /> Kuponları Çek
                                                </Button>
                                            )}
                                            {adminRole !== 'moderator' && (
                                                <Button size="sm" variant="outline" className="border-emerald-800 text-emerald-500 hover:bg-emerald-500/10 gap-2" onClick={async () => {
                                                    try {
                                                        const res = await recalculateEventPoints(event.id)
                                                        toast({ title: "Başarılı", description: res.message || `${res.recalculated_count} kupon yeniden hesaplandı.` })
                                                        const eList = await fetchEvents()
                                                        setEvents(eList)
                                                    } catch (e: any) {
                                                        toast({ title: "Hata", description: e?.response?.data?.detail || "Puanlar yeniden hesaplanamadı", variant: "destructive" })
                                                    }
                                                }} title="Puanları Yeniden Hesapla">
                                                    <RefreshCw className="h-4 w-4" /> Puanları Yeniden Hesapla
                                                </Button>
                                            )}

                                            {adminRole !== 'moderator' && event.reward_status !== 'completed' && (
                                                <Button size="icon" variant="ghost"
                                                    className={`${event.reward_status === 'processing' ? 'opacity-30 cursor-not-allowed' : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10'}`}
                                                    disabled={event.reward_status === 'processing'}
                                                    onClick={() => {
                                                        if (event.status !== 'ended') {
                                                            toast({
                                                                title: "Uyarı",
                                                                description: "Ödül dağıtımı için önce kampanyayı 'Bitir' diyerek sonlandırmalısınız.",
                                                                variant: "destructive"
                                                            });
                                                            return;
                                                        }
                                                        distributeRewards(event.id).then(() => toast({ title: "Başarılı", description: "Ödül dağıtımı sıraya alındı." }));
                                                    }}
                                                    title={event.reward_status === 'processing' ? "Dağıtım devam ediyor..." : "Ödülleri Dağıt"}
                                                >
                                                    <Gift className="h-4 w-4" />
                                                </Button>
                                            )}

                                            <Button size="icon" variant="ghost" onClick={() => handleViewDetails(event)} title="Detaylar">
                                                <Eye className="h-4 w-4 text-purple-400" />
                                            </Button>
                                            {adminRole !== 'moderator' && (
                                                <Button size="icon" variant="ghost" onClick={() => { setManualCouponEventId(event.id); setShowManualCouponModal(true); setManualCouponBetId(""); }} title="Manuel Kupon Ekle" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button size="icon" variant="ghost" onClick={() => { setHistoryEvent(event); setShowHistoryModal(true); handleLoadRewardHistory(event.id); }} title="Ödül Geçmişi">
                                                <History className="h-4 w-4 text-amber-400" />
                                            </Button>
                                            {adminRole !== 'moderator' && (
                                                <>
                                                    <Button size="icon" variant="ghost" onClick={() => openEditModal(event)} title="Düzenle">
                                                        <Pencil className="h-4 w-4 text-blue-400" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDeleteEvent(event.id)} title="Kampanyayı Sil">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                            <div className="space-y-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-wider">Tarih Aralığı</span>
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <Calendar className="h-3.5 w-3.5 text-primary" />
                                                    {new Date(event.start_date).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} - {new Date(event.end_date).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-wider">Görüntülenme Bitiş</span>
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                                                    {event.display_until ? new Date(event.display_until).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : <span className="text-white/30 italic">Her Zaman</span>}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-wider">Puan Çarpanı (Won/Loss)</span>
                                                <div className="flex items-center gap-2 font-mono font-bold">
                                                    <span className="text-emerald-500">x{event.won_point_multiplier}</span>
                                                    <span className="text-white/20">|</span>
                                                    <span className="text-red-500">x{event.loss_point_multiplier}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-wider">Min Yatırım</span>
                                                <div className="text-sm font-bold text-amber-500 flex items-center gap-1">
                                                    <Shield className="h-3.5 w-3.5" />
                                                    {event.rules.min_deposit ?? 0} TL+
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-wider">Ödül Havuzu</span>
                                                <div
                                                    className="text-sm font-bold text-emerald-500 flex items-center gap-1 cursor-pointer hover:underline"
                                                    onClick={() => setRewardPoolEvent(event)}
                                                >
                                                    <Gift className="h-3.5 w-3.5" />
                                                    {(event.rules.rewards || []).length > 0 ? (
                                                        <div className="flex flex-col">
                                                            <span>{(event.rules.rewards || []).length} Ödül Tanımlı</span>
                                                            <span className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full w-fit mt-1">
                                                                Toplam: {new Intl.NumberFormat('tr-TR').format((event.rules.rewards || []).reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0))} TL
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-white/20 italic font-normal">Tanımlanmadı</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-wider">Ödül Dağıtım Durumu</span>
                                                <div className="pt-1">
                                                    {event.reward_status === 'completed' && <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/30">Dağıtıldı</Badge>}
                                                    {event.reward_status === 'processing' && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/20 animate-pulse">Dağıtılıyor...</Badge>}
                                                    {event.reward_status === 'pending' && <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/20">Sırada</Badge>}
                                                    {event.reward_status === 'failed' && <Badge className="bg-red-500/20 text-red-500 border-red-500/20">Hata!</Badge>}
                                                    {(event.reward_status === 'none' || !event.reward_status) && <Badge variant="outline" className="text-white/20 border-white/5 font-normal">Dağıtılmadı</Badge>}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-wider">Son Kupon Çekilme</span>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-sm font-medium">
                                                        <RefreshCw className="h-3 w-3 text-blue-400" />
                                                        <span className="text-[10px] text-muted-foreground font-bold">OTOMATİK:</span>
                                                        {event.last_cron_run ? new Date(event.last_cron_run + (String(event.last_cron_run).includes('Z') ? '' : 'Z')).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : <span className="text-white/30 italic">—</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm font-medium">
                                                        <RefreshCw className="h-3 w-3 text-amber-400" />
                                                        <span className="text-[10px] text-muted-foreground font-bold">MANUEL:</span>
                                                        {event.last_worker_run ? new Date(event.last_worker_run + (String(event.last_worker_run).includes('Z') ? '' : 'Z')).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : <span className="text-white/30 italic">—</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Reward Pool Popup */}
                        {rewardPoolEvent && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRewardPoolEvent(null)}>
                                <Card className="bg-card border-white/5 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Gift className="h-5 w-5 text-emerald-500" />
                                            Ödül Havuzu — {rewardPoolEvent.name}
                                        </CardTitle>
                                        <CardDescription>Bu kampanya için tanımlanmış ödüller.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 pt-0">
                                        {(rewardPoolEvent.rules?.rewards || []).length === 0 ? (
                                            <div className="text-center py-8 bg-white/5 rounded-lg border border-dashed border-white/10 text-muted-foreground text-sm">
                                                Henüz ödül tanımlanmamış.
                                            </div>
                                        ) : (
                                            <div
                                                className="space-y-2 pr-2"
                                                style={{ height: 400, overflowY: 'scroll', overflowX: 'hidden' }}
                                            >
                                                {(rewardPoolEvent.rules.rewards || []).map((rule: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/5">
                                                        <Badge variant="outline" className="h-8 w-8 rounded-full flex items-center justify-center border-primary/50 bg-primary/10 text-primary font-bold shrink-0">
                                                            {idx + 1}
                                                        </Badge>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold flex items-center gap-2 flex-wrap">
                                                                <span className="text-emerald-400">{rule.amount} {rule.currency || 'TRY'}</span>
                                                                <Badge variant="secondary" className="text-[10px] uppercase">
                                                                    {rule.reward_type === 'cash' ? 'Nakit' : rule.reward_type === 'spin' ? 'Free Spin' : rule.reward_type === 'freebet' ? 'Freebet' : 'Bonus'}
                                                                    {rule.partner_bonus_id && ` (ID: ${rule.partner_bonus_id})`}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {rule.criteria_type === 'rank' && `İlk ${rule.criteria_value} kişiye verilir`}
                                                                {rule.criteria_type === 'rank_exact' && `Sadece ${rule.criteria_value}. sıraya verilir`}
                                                                {rule.criteria_type === 'min_points' && `${rule.criteria_value}+ puan yapanlara verilir`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                    <div className="p-4 border-t border-white/5 flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => { openEditModal(rewardPoolEvent); setModalTab("rewards"); setRewardPoolEvent(null); }}>
                                            Ödülleri Düzenle
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setRewardPoolEvent(null)}>Kapat</Button>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* Create Event Modal */}
                        {showAddEvent && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <Card className="bg-card border-white/5 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
                                    <CardHeader>
                                        <CardTitle>Yeni Kampanya Oluştur</CardTitle>
                                        <CardDescription>Kampanya kuralları ve ödülleri belirleyin.</CardDescription>
                                        <div className="flex gap-2 mt-4 border-b border-white/10">
                                            <button type="button" onClick={() => setModalTab("general")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Genel Ayarlar</button>
                                            <button type="button" onClick={() => setModalTab("rules")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Kurallar</button>
                                            <button type="button" onClick={() => setModalTab("content_rules")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'content_rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Kullanıcı Kuralları</button>
                                            <button type="button" onClick={() => setModalTab("rewards")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'rewards' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Ödüller</button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="overflow-y-auto custom-scrollbar pr-2 mt-4">
                                        <form onSubmit={handleCreateEvent} className="space-y-4">
                                            {/* TAB 1: GENERAL */}
                                            {modalTab === 'general' && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground">Kampanya Adı</label>
                                                        <Input value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} required placeholder="Örn: Hafta Sonu Ligi" className="bg-black/20" />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground">Açıklama</label>
                                                        <textarea
                                                            value={newEvent.description}
                                                            onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                                            placeholder="Kampanya detayları..."
                                                            className="flex min-h-[80px] w-full rounded-md border border-input bg-black/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-muted-foreground">Başlangıç</label>
                                                            <Input type="datetime-local" value={formatDateTimeLocal(newEvent.start_date)} onChange={e => setNewEvent({ ...newEvent, start_date: e.target.value })} required className="bg-black/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-muted-foreground">Bitiş</label>
                                                            <Input type="datetime-local" value={formatDateTimeLocal(newEvent.end_date)} onChange={e => setNewEvent({ ...newEvent, end_date: e.target.value })} required className="bg-black/20" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                                            <Timer className="h-3 w-3" /> Görüntülenme Bitiş Tarihi
                                                        </label>
                                                        <Input type="datetime-local" value={formatDateTimeLocal(newEvent.display_until)} onChange={e => setNewEvent({ ...newEvent, display_until: e.target.value })} className="bg-black/20" />
                                                        <p className="text-[10px] text-muted-foreground italic">Kampanya bittikten sonra client'te ne zamana kadar görünecek. Boş bırakılırsa her zaman görünür.</p>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                            <ImagePlus className="h-3 w-3" /> Kampanya Görseli
                                                        </label>
                                                        <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
                                                            <div className="h-16 w-16 bg-black/40 rounded flex items-center justify-center overflow-hidden border border-white/5">
                                                                {tempImageFile ? (
                                                                    <img src={URL.createObjectURL(tempImageFile)} alt="Preview" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <ImagePlus className="h-6 w-6 text-muted-foreground/30" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 space-y-1">
                                                                <input
                                                                    type="file"
                                                                    id="event-image-upload"
                                                                    className="hidden"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleFileChange(e)}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => document.getElementById('event-image-upload')?.click()}
                                                                    className="bg-black/20"
                                                                >
                                                                    {tempImageFile ? "Resmi Değiştir" : "Resim Seç"}
                                                                </Button>
                                                                <p className="text-[10px] text-muted-foreground italic">
                                                                    {tempImageFile ? tempImageFile.name : "Banner (Önerilen: 1080x1080 px)"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* TAB 2: RULES */}
                                            {modalTab === 'rules' && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Multipliers */}
                                                        <div className="space-y-3 bg-white/5 p-3 rounded-lg border border-white/5">
                                                            {newEvent.rules.scoring_formula === 'stake_times_odds_raw' ? (
                                                                <div className="text-xs text-muted-foreground py-2">
                                                                    <p className="font-medium text-foreground">Bu puan türünde çarpanlar sabittir:</p>
                                                                    <p className="mt-1">Kazanan: x1 · Kaybeden: x0</p>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <label className="text-xs font-bold text-emerald-400">Kazanan Çarpanı: <span className="text-sm">x{newEvent.won_point_multiplier.toFixed(1)}</span></label>
                                                                        </div>
                                                                        <input
                                                                            type="range" min="0.5" max="5.0" step="0.1"
                                                                            value={newEvent.won_point_multiplier}
                                                                            onChange={e => setNewEvent({ ...newEvent, won_point_multiplier: parseFloat(e.target.value) })}
                                                                            className="w-full h-1.5 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <label className="text-xs font-bold text-red-400">Kaybeden Çarpanı: <span className="text-sm">x{newEvent.loss_point_multiplier.toFixed(1)}</span></label>
                                                                        </div>
                                                                        <input
                                                                            type="range" min="0" max="2.0" step="0.1"
                                                                            value={newEvent.loss_point_multiplier}
                                                                            onChange={e => setNewEvent({ ...newEvent, loss_point_multiplier: parseFloat(e.target.value) })}
                                                                            className="w-full h-1.5 bg-red-500/20 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400 transition-all"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Formula */}
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-muted-foreground">Puan Hesaplama Türü</label>
                                                            <Select
                                                                value={newEvent.rules.scoring_formula}
                                                                onValueChange={(val) => setNewEvent({
                                                                    ...newEvent,
                                                                    rules: { ...newEvent.rules, scoring_formula: val as "simple" | "stake_times_odds" | "stake_times_odds_raw" | "net_profit_multiplier" },
                                                                    ...(val === 'stake_times_odds_raw' ? { won_point_multiplier: 1, loss_point_multiplier: 0 } : {})
                                                                })}
                                                            >
                                                                <SelectTrigger className="bg-black/20 border-white/10">
                                                                    <SelectValue placeholder="Seçiniz" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="simple">Oran X Kazanç Çarpanı</SelectItem>
                                                                    <SelectItem value="stake_times_odds">Bahis x Oran x Kazanç Çarpanı / 10</SelectItem>
                                                                    <SelectItem value="stake_times_odds_raw">Bahis x Oran = Toplam Puan</SelectItem>
                                                                    <SelectItem value="net_profit_multiplier">Kazanç - Bahis x Kazanç Çarpanı</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg border border-white/5">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Min Oran</label>
                                                            <Input type="number" step="0.1" value={newEvent.rules.min_odd} onChange={e => setNewEvent({ ...newEvent, rules: { ...newEvent.rules, min_odd: parseFloat(e.target.value) } })} className="bg-black/20 border-primary/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Min Bahis (TL)</label>
                                                            <Input type="number" value={newEvent.rules.min_stake} onChange={e => setNewEvent({ ...newEvent, rules: { ...newEvent.rules, min_stake: parseInt(e.target.value) } })} className="bg-black/20 border-primary/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Min Kombine</label>
                                                            <Input type="number" value={newEvent.rules.min_combination} onChange={e => setNewEvent({ ...newEvent, rules: { ...newEvent.rules, min_combination: parseInt(e.target.value) } })} className="bg-black/20 border-primary/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Max Kombine</label>
                                                            <Input type="number" placeholder="Sınırsız" value={newEvent.rules.max_combination || ""} onChange={e => setNewEvent({ ...newEvent, rules: { ...newEvent.rules, max_combination: e.target.value ? parseInt(e.target.value) : null } })} className="bg-black/20 border-primary/20" />
                                                        </div>

                                                        <div className="space-y-3 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <label className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
                                                                    <Shield className="h-3 w-3" /> Min Yatırım
                                                                </label>
                                                                <span className="text-xs font-bold text-amber-400">{newEvent.rules.min_deposit?.toLocaleString() || "0"} TL</span>
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="100"
                                                                value={newEvent.rules.min_deposit}
                                                                onChange={e => {
                                                                    const val = parseInt(e.target.value)
                                                                    setNewEvent({ ...newEvent, rules: { ...newEvent.rules, min_deposit: isNaN(val) ? 0 : val } })
                                                                }}
                                                                className="bg-black/20 border-amber-500/20 text-amber-500"
                                                            />
                                                            <p className="text-[9px] text-amber-500/60 leading-tight">Yalnızca bu tutar ve üzeri yatırım yapanlar katılabilir (0 = Herkes).</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                                                        <LeagueSelector
                                                            selectedIds={newEvent.rules.allowed_league_ids}
                                                            onChange={(ids) => setNewEvent({ ...newEvent, rules: { ...newEvent.rules, allowed_league_ids: ids } })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2 p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
                                                        <LeagueSelector
                                                            label="Yan Bahisler (Client'ta gizli)"
                                                            buttonLabel="Yan Bahis Ekle"
                                                            selectedIds={newEvent.rules.yan_bahis_ids ?? []}
                                                            onChange={(ids) => setNewEvent({ ...newEvent, rules: { ...newEvent.rules, yan_bahis_ids: ids } })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* TAB 3: REWARDS */}
                                            {modalTab === 'rewards' && (
                                                <div className="animate-in fade-in slide-in-from-right-4">
                                                    <EventRewardSettings
                                                        rewards={newEvent.rules.rewards}
                                                        onChange={(rewards) => setNewEvent({ ...newEvent, rules: { ...newEvent.rules, rewards } })}
                                                    />
                                                </div>
                                            )}

                                            {/* TAB 4: CONTENT RULES */}
                                            {modalTab === 'content_rules' && (
                                                <div className="animate-in fade-in slide-in-from-right-4">
                                                    <ContentRuleEditor
                                                        rules={newEvent.content_rules}
                                                        onChange={(content_rules) => setNewEvent({ ...newEvent, content_rules })}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                                                <Button type="button" variant="ghost" onClick={() => setShowAddEvent(false)}>İptal</Button>
                                                <Button type="submit" disabled={saving === "create_event"} className="bg-primary hover:bg-primary/90">
                                                    {saving === "create_event" ? "Kaydediliyor..." : "Kampanyayı Oluştur"}
                                                </Button>
                                            </div>
                                        </form>                                                </CardContent>
                                </Card>
                            </div>
                        )
                        }

                        {/* Edit Event Modal */}
                        {
                            showEditEvent && editingEvent && (
                                <Card className="bg-card/50 border-white/5 backdrop-blur-xl animate-in slide-in-from-top-4 fixed top-10 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 shadow-2xl">
                                    <CardHeader>
                                        <CardTitle>Kampanyayı Düzenle</CardTitle>
                                        <CardDescription>Kampanya kurallarını güncelle.</CardDescription>
                                        <div className="flex gap-2 mt-4 border-b border-white/10">
                                            <button type="button" onClick={() => setModalTab("general")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Genel Ayarlar</button>
                                            <button type="button" onClick={() => setModalTab("rules")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Kurallar</button>
                                            <button type="button" onClick={() => setModalTab("content_rules")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'content_rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Kullanıcı Kuralları</button>
                                            <button type="button" onClick={() => setModalTab("rewards")} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${modalTab === 'rewards' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>Ödüller</button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-2 mt-4">
                                        <form onSubmit={handleUpdateEvent} className="space-y-4">
                                            {/* TAB 1: GENERAL */}
                                            {modalTab === 'general' && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground">Kampanya Adı</label>
                                                        <Input value={editingEvent.name} onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })} required className="bg-black/20" />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground">Açıklama</label>
                                                        <textarea
                                                            value={editingEvent.description}
                                                            onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                                                            placeholder="Kampanya detayları..."
                                                            className="flex min-h-[80px] w-full rounded-md border border-input bg-black/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground">Event Key / Slug</label>
                                                        <Input value={editingEvent.slug} onChange={e => setEditingEvent({ ...editingEvent, slug: e.target.value })} required className="bg-black/20 font-mono" />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-muted-foreground">Başlangıç</label>
                                                            <Input type="datetime-local" value={formatDateTimeLocal(editingEvent.start_date)} onChange={e => setEditingEvent({ ...editingEvent, start_date: e.target.value })} required className="bg-black/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-muted-foreground">Bitiş</label>
                                                            <Input type="datetime-local" value={formatDateTimeLocal(editingEvent.end_date)} onChange={e => setEditingEvent({ ...editingEvent, end_date: e.target.value })} required className="bg-black/20" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                                            <Timer className="h-3 w-3" /> Görüntülenme Bitiş Tarihi
                                                        </label>
                                                        <Input type="datetime-local" value={formatDateTimeLocal(editingEvent.display_until || "")} onChange={e => setEditingEvent({ ...editingEvent, display_until: e.target.value })} className="bg-black/20" />
                                                        <p className="text-[10px] text-muted-foreground italic">Kampanya bittikten sonra client'te ne zamana kadar görünecek. Boş bırakılırsa her zaman görünür.</p>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                            <ImagePlus className="h-3 w-3" /> Kampanya Görseli
                                                        </label>
                                                        <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
                                                            <div className="h-16 w-16 bg-black/40 rounded flex items-center justify-center overflow-hidden border border-white/5">
                                                                {editingEvent.image_url ? (
                                                                    <img src={`${editingEvent.image_url}`} alt="Event" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <ImagePlus className="h-6 w-6 text-muted-foreground/30" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 space-y-1">
                                                                <input
                                                                    type="file"
                                                                    id="edit-event-image-upload"
                                                                    className="hidden"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleFileChange(e, editingEvent.id)}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => document.getElementById('edit-event-image-upload')?.click()}
                                                                    disabled={imageUploadLoading}
                                                                    className="bg-black/20"
                                                                >
                                                                    {imageUploadLoading ? "Yükleniyor..." : (editingEvent.image_url ? "Resmi Güncelle" : "Resim Yükle")}
                                                                </Button>
                                                                <p className="text-[10px] text-muted-foreground italic">
                                                                    Önerilen: 1080x1080 px (kare)
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* TAB 2: RULES */}
                                            {modalTab === 'rules' && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Multipliers */}
                                                        <div className="space-y-3 bg-white/5 p-3 rounded-lg border border-white/5">
                                                            {editingEvent.rules.scoring_formula === 'stake_times_odds_raw' ? (
                                                                <div className="text-xs text-muted-foreground py-2">
                                                                    <p className="font-medium text-foreground">Bu puan türünde çarpanlar sabittir:</p>
                                                                    <p className="mt-1">Kazanan: x1 · Kaybeden: x0</p>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <label className="text-xs font-bold text-emerald-400">Kazanan Çarpanı: <span className="text-sm">x{editingEvent.won_point_multiplier.toFixed(1)}</span></label>
                                                                        </div>
                                                                        <input
                                                                            type="range" min="0.5" max="5.0" step="0.1"
                                                                            value={editingEvent.won_point_multiplier}
                                                                            onChange={e => setEditingEvent({ ...editingEvent, won_point_multiplier: parseFloat(e.target.value) })}
                                                                            className="w-full h-1.5 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <label className="text-xs font-bold text-red-400">Kaybeden Çarpanı: <span className="text-sm">x{editingEvent.loss_point_multiplier.toFixed(1)}</span></label>
                                                                        </div>
                                                                        <input
                                                                            type="range" min="0" max="2.0" step="0.1"
                                                                            value={editingEvent.loss_point_multiplier}
                                                                            onChange={e => setEditingEvent({ ...editingEvent, loss_point_multiplier: parseFloat(e.target.value) })}
                                                                            className="w-full h-1.5 bg-red-500/20 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400 transition-all"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Formula */}
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-muted-foreground">Puan Hesaplama Türü</label>
                                                            <Select
                                                                value={editingEvent.rules.scoring_formula || "simple"}
                                                                onValueChange={(val) => setEditingEvent({
                                                                    ...editingEvent,
                                                                    rules: { ...editingEvent.rules, scoring_formula: val as "simple" | "stake_times_odds" | "stake_times_odds_raw" | "net_profit_multiplier" },
                                                                    ...(val === 'stake_times_odds_raw' ? { won_point_multiplier: 1, loss_point_multiplier: 0 } : {})
                                                                })}
                                                            >
                                                                <SelectTrigger className="bg-black/20 border-white/10">
                                                                    <SelectValue placeholder="Seçiniz" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="simple">Oran X Kazanç Çarpanı</SelectItem>
                                                                    <SelectItem value="stake_times_odds">Bahis x Oran x Kazanç Çarpanı / 10</SelectItem>
                                                                    <SelectItem value="stake_times_odds_raw">Bahis x Oran = Toplam Puan</SelectItem>
                                                                    <SelectItem value="net_profit_multiplier">Kazanç - Bahis x Kazanç Çarpanı</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg border border-white/5">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Min Oran</label>
                                                            <Input type="number" step="0.1" value={editingEvent.rules.min_odd} onChange={e => setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, min_odd: parseFloat(e.target.value) } })} className="bg-black/20 border-primary/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Min Bahis (TL)</label>
                                                            <Input type="number" value={editingEvent.rules.min_stake} onChange={e => setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, min_stake: parseInt(e.target.value) } })} className="bg-black/20 border-primary/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Min Kombine</label>
                                                            <Input type="number" value={editingEvent.rules.min_combination} onChange={e => setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, min_combination: parseInt(e.target.value) } })} className="bg-black/20 border-primary/20" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-primary">Max Kombine</label>
                                                            <Input type="number" placeholder="Sınırsız" value={editingEvent.rules.max_combination || ""} onChange={e => setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, max_combination: e.target.value ? parseInt(e.target.value) : null } })} className="bg-black/20 border-primary/20" />
                                                        </div>

                                                        <div className="space-y-3 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <label className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
                                                                    <Shield className="h-3 w-3" /> Min Yatırım
                                                                </label>
                                                                <span className="text-xs font-bold text-amber-400">{editingEvent.rules.min_deposit?.toLocaleString() || "0"} TL</span>
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="100"
                                                                value={editingEvent.rules.min_deposit}
                                                                onChange={e => {
                                                                    const val = parseInt(e.target.value)
                                                                    setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, min_deposit: isNaN(val) ? 0 : val } })
                                                                }}
                                                                className="bg-black/20 border-amber-500/20 text-amber-500"
                                                            />
                                                            <p className="text-[9px] text-amber-500/60 leading-tight">Yalnızca bu tutar ve üzeri yatırım yapanlar katılabilir (0 = Herkes).</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                                                        <LeagueSelector
                                                            selectedIds={editingEvent.rules.allowed_league_ids}
                                                            onChange={(ids) => setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, allowed_league_ids: ids } })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2 p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
                                                        <LeagueSelector
                                                            label="Yan Bahisler (Client'ta gizli)"
                                                            buttonLabel="Yan Bahis Ekle"
                                                            selectedIds={editingEvent.rules.yan_bahis_ids ?? []}
                                                            onChange={(ids) => setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, yan_bahis_ids: ids } })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* TAB 3: REWARDS */}
                                            {modalTab === 'rewards' && (
                                                <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                                                    {(!editingEvent.rules.rewards || editingEvent.rules.rewards.length === 0) && (
                                                        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500">
                                                            <AlertCircle className="h-4 w-4" />
                                                            <AlertTitle className="text-xs font-bold uppercase">Ödüller Tanımlanmamış</AlertTitle>
                                                            <AlertDescription className="text-xs">
                                                                Bu kampanya için henüz ödül kuralı eklenmemiş. Ödül dağıtımı yapabilmek için kural eklemelisiniz.
                                                            </AlertDescription>
                                                        </Alert>
                                                    )}
                                                    <EventRewardSettings
                                                        rewards={editingEvent.rules.rewards || []}
                                                        onChange={(rewards) => setEditingEvent({ ...editingEvent, rules: { ...editingEvent.rules, rewards } })}
                                                    />
                                                </div>
                                            )}

                                            {/* TAB 4: CONTENT RULES */}
                                            {modalTab === 'content_rules' && (
                                                <div className="animate-in fade-in slide-in-from-right-4">
                                                    <ContentRuleEditor
                                                        rules={editingEvent.content_rules || []}
                                                        onChange={(content_rules) => setEditingEvent({ ...editingEvent, content_rules })}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                                                <Button type="button" variant="ghost" onClick={() => setShowEditEvent(false)}>İptal</Button>
                                                <Button type="submit" disabled={saving === "update_event"} className="bg-primary hover:bg-primary/90">
                                                    {saving === "update_event" ? "Güncelleniyor..." : "Güncelle"}
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            )
                        }
                        {showHistoryModal && historyEvent && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <Card className="bg-card border-white/5 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle>Ödül Geçmişi</CardTitle>
                                            <CardDescription>{historyEvent.name} etkinliği için başarılı dağıtımlar.</CardDescription>
                                        </div>
                                        <History className="h-8 w-8 text-amber-400/20" />
                                    </CardHeader>
                                    <CardContent className="overflow-y-auto custom-scrollbar pr-2 mt-4 flex-grow">
                                        {loadingRewards ? (
                                            <div className="py-24 flex flex-col items-center justify-center">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                                                <span className="text-muted-foreground">Geçmiş yükleniyor...</span>
                                            </div>
                                        ) : rewardHistory.length === 0 ? (
                                            <div className="py-24 text-center flex flex-col items-center gap-4 text-muted-foreground italic">
                                                <History className="h-12 w-12 opacity-10" />
                                                Bu etkinlik için henüz başarılı bir ödül dağıtımı bulunmuyor.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto rounded-lg border border-white/5">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] tracking-wider">
                                                        <tr>
                                                            <th className="px-4 py-3">Kullanıcı</th>
                                                            <th className="px-4 py-3">Ödül</th>
                                                            <th className="px-4 py-3">Miktar</th>
                                                            <th className="px-4 py-3">Tarih</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {rewardHistory.map((rh, i) => (
                                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-3 font-bold">
                                                                    {rh.username}
                                                                    <div className="text-[9px] text-muted-foreground font-normal">ID: {rh.client_id}</div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <Badge variant="outline" className="uppercase text-[9px] border-primary/20 text-primary">
                                                                        {rh.reward_type}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-4 py-3 font-bold text-emerald-400">
                                                                    {rh.amount} TRY
                                                                </td>
                                                                <td className="px-4 py-3 text-muted-foreground text-[10px]">
                                                                    {new Date(rh.timestamp).toLocaleString("tr-TR")}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                    <div className="p-4 border-t border-white/5 flex justify-between items-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleExportRewardHistory(historyEvent.id, historyEvent.name)}
                                            className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                            disabled={rewardHistory.length === 0}
                                        >
                                            <Download className="h-4 w-4" /> Excel'e Aktar
                                        </Button>
                                        <Button variant="outline" onClick={() => setShowHistoryModal(false)}>Kapat</Button>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {showEditEvent && <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setShowEditEvent(false)} />}
                        {showHistoryModal && <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setShowHistoryModal(false)} />}
                    </div >
                )
            )}
            {showManualCouponModal && manualCouponEventId && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={() => { setShowManualCouponModal(false); setManualCouponEventId(null); setManualCouponBetId(""); }}>
                    <Card className="bg-slate-900/95 border-white/10 shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Manuel Kupon Ekle</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => { setShowManualCouponModal(false); setManualCouponEventId(null); setManualCouponBetId(""); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-muted-foreground">Bet ID (Kupon ID)</label>
                                <Input
                                    placeholder="örn. 6139043932"
                                    value={manualCouponBetId}
                                    onChange={(e) => setManualCouponBetId(e.target.value)}
                                    className="mt-2"
                                    disabled={manualCouponLoading}
                                />
                                <p className="text-xs text-muted-foreground mt-1">GetBetReport ile son 30 gün içinde aranır.</p>
                            </div>
                        </CardContent>
                        <div className="p-4 border-t border-white/5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setShowManualCouponModal(false); setManualCouponEventId(null); setManualCouponBetId(""); }} disabled={manualCouponLoading}>
                                İptal
                            </Button>
                            <Button onClick={handleManualCouponSubmit} disabled={manualCouponLoading || !manualCouponBetId.trim()}>
                                {manualCouponLoading ? "Ekleniyor..." : "Ekle"}
                            </Button>
                        </div>
                    </Card>
                </div>,
                document.body
            )}
            </>
            )}

            {
                activeTab === 'participants' && !selectedParticipant && (
                    <div className="space-y-6">
                        <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Kayıtlı Kullanıcılar</CardTitle>
                                    <CardDescription>Toplam {totalParticipants} katılımcı listeleniyor.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Kullanıcı Ara..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-[200px] pl-8 bg-black/20 border-white/10"
                                        />
                                    </div>

                                    <Select value={selectedEventId?.toString() || "all"} onValueChange={(val) => setSelectedEventId(val === "all" ? null : parseInt(val))}>
                                        <SelectTrigger className="w-[200px] bg-black/20 border-white/10">
                                            <SelectValue placeholder="Tüm Kampanyalar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tüm Kampanyalar</SelectItem>
                                            {events.map((e: any) => (
                                                <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-white/5 text-muted-foreground text-xs uppercase tracking-wider">
                                                <th className="px-4 py-3 font-bold">Kullanıcı</th>
                                                <th className="px-4 py-3 font-bold">Client ID</th>
                                                <th className="px-4 py-3 font-bold">Katıldığı Kampanya</th>
                                                <th className="px-4 py-3 font-bold">Katılım Tarihi</th>
                                                <th className="px-4 py-3 font-bold">Kupon Sayısı</th>
                                                <th className="px-4 py-3 font-bold">Toplam Puan</th>
                                                <th className="px-4 py-3 font-bold">Durum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {participants.map((p) => (
                                                <tr
                                                    key={p.id}
                                                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                                                    onClick={() => handleSelectParticipant(p)}
                                                >
                                                    <td className="px-4 py-4 font-bold">{p.username}</td>
                                                    <td className="px-4 py-4 text-xs text-muted-foreground">{p.client_id}</td>
                                                    <td className="px-4 py-4">
                                                        {Array.isArray(p.enrolled_events) && p.enrolled_events.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {p.enrolled_events.map((ename: string, i: number) => (
                                                                    <Badge key={i} variant="outline" className="border-primary/50 text-primary text-[10px] px-1 py-0">{ename}</Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground italic text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-xs">{p.joined_at ? new Date(p.joined_at + (String(p.joined_at).includes('Z') ? '' : 'Z')).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : '-'}</td>
                                                    <td className="px-4 py-4"><Badge variant="secondary">{p.coupon_count}</Badge></td>
                                                    <td className="px-4 py-4 font-black italic text-primary">{p.points}</td>
                                                    <td className="px-4 py-4">
                                                        <Badge className="bg-green-500/10 text-green-500 border-none">Aktif</Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                            <div className="p-4 border-t border-white/5 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Sayfa {page} / {Math.ceil(totalParticipants / limit) || 1}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Önceki
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={participants.length < limit}
                                        className="gap-1"
                                    >
                                        Sonraki <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )
            }

            {
                activeTab === 'participants' && selectedParticipant && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex justify-between items-center">
                            <Button variant="outline" size="sm" onClick={() => setSelectedParticipant(null)} className="gap-2">
                                <ArrowLeft className="h-4 w-4" /> Listeye Geri Dön
                            </Button>
                            <div className="flex gap-2 items-center">
                                <Select value={selectedEventId?.toString() || "all"} onValueChange={(val) => setSelectedEventId(val === "all" ? null : parseInt(val))}>
                                    <SelectTrigger className="w-[200px] h-8 bg-black/20 border-white/10">
                                        <SelectValue placeholder="Tüm Kampanyalar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Kampanyalar</SelectItem>
                                        {events.map((e: any) => (
                                            <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Badge variant="secondary" className="px-3 py-1">ID: {selectedParticipant.client_id}</Badge>
                                <Badge className="px-3 py-1 bg-primary/20 text-primary border-none">
                                    Puan: {Number(selectedParticipant.points).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Badge>
                            </div>
                        </div>

                        <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-primary" />
                                    Bahis Geçmişi
                                </CardTitle>
                                <CardDescription>Kullanıcının sisteme yüklediği tüm kuponlar.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Bet ID ile ara..."
                                            value={couponSearch}
                                            onChange={(e) => setCouponSearch(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
                                        />
                                    </div>
                                </div>
                                {loadingCoupons ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                                        Kuponlar yükleniyor...
                                    </div>
                                ) : userCoupons.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground italic">
                                        Henüz kupon bulunamadı.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-white/5 text-muted-foreground text-xs uppercase tracking-wider">
                                                    <th className="px-4 py-3 font-bold">Bet ID</th>
                                                    <th className="px-4 py-3 font-bold">Tarih</th>
                                                    <th className="px-4 py-3 font-bold">Maç Detayları</th>
                                                    <th className="px-4 py-3 font-bold text-right">Miktar</th>
                                                    <th className="px-4 py-3 font-bold text-center">Oran</th>
                                                    <th className="px-4 py-3 font-bold text-center">Puan</th>
                                                    <th className="px-4 py-3 font-bold text-center">Durum</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {userCoupons.map((c) => (
                                                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-4 font-mono text-xs">{c.bet_id}</td>
                                                        <td className="px-4 py-4 text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {new Date((c.created_at || '').includes('Z') || (c.created_at || '').includes('+') ? c.created_at : (c.created_at || '') + 'Z').toLocaleString("tr-TR")}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-xs max-w-[350px]">
                                                            {c.bet_data?.Selections && c.bet_data.Selections.length > 0 ? (
                                                                <div>
                                                                    {/* Detay Button */}
                                                                    <button
                                                                        onClick={() => setExpandedCouponId(expandedCouponId === c.id ? null : c.id)}
                                                                        className="w-full flex items-center justify-between text-left hover:bg-white/5 rounded px-2 py-1 transition-colors"
                                                                    >
                                                                        <span className="text-muted-foreground">
                                                                            {c.bet_data.Selections.length} maç
                                                                        </span>
                                                                        <span className="text-primary text-[10px] flex items-center gap-1">
                                                                            {expandedCouponId === c.id ? '▲ Gizle' : '▼ Detay'}
                                                                        </span>
                                                                    </button>

                                                                    {/* Expanded Details */}
                                                                    {expandedCouponId === c.id && (
                                                                        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                                                                            {c.bet_data.Selections.map((sel: any, i: number) => (
                                                                                <div key={i} className="border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                                                                    <div className="text-white/80 font-medium text-[11px]">{sel.MatchName}</div>
                                                                                    <div className="flex justify-between items-center text-[10px]">
                                                                                        <span className="text-blue-400">→ {sel.DisplaySelectionName || sel.SelectionName}</span>
                                                                                        <span className="text-muted-foreground">{sel.DisplayMarketName || sel.MarketName}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground italic">Detay yok</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 font-bold text-right">{c.stake} TL</td>
                                                        <td className="px-4 py-4 text-center">
                                                            <Badge variant="outline" className="font-bold border-white/10">x{c.odds}</Badge>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className="font-bold text-primary font-mono">{(c.calculation || 0).toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            {c.state && c.state.toLowerCase() === 'won' ? (
                                                                <Badge className="bg-green-500/10 text-green-500 border-none">Kazandı</Badge>
                                                            ) : c.state && c.state.toLowerCase() === 'lost' ? (
                                                                <Badge className="bg-red-500/10 text-red-500 border-none">Kaybetti</Badge>
                                                            ) : (
                                                                <Badge className="bg-yellow-500/10 text-yellow-500 border-none">Bekliyor</Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                            <div className="p-4 border-t border-white/5 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Toplam {totalUserCoupons} kupon. Sayfa {couponPage}.
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCouponPage(p => Math.max(1, p - 1))}
                                        disabled={couponPage === 1}
                                        className="gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Önceki
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCouponPage(p => p + 1)}
                                        disabled={userCoupons.length < COUPON_LIMIT}
                                        className="gap-1"
                                    >
                                        Sonraki <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )
            }

            {
                activeTab === 'users' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <Button onClick={() => setShowAddUser(true)} className="gap-2 bg-primary hover:bg-primary/90 font-bold">
                                <UserPlus className="h-4 w-4" /> Yeni Yönetici Ekle
                            </Button>
                        </div>

                        {showAddUser && (
                            <Card className="bg-card/50 border-white/5 backdrop-blur-xl animate-in slide-in-from-top-4">
                                <CardHeader>
                                    <CardTitle>Yeni Yönetici Hesabı</CardTitle>
                                    <CardDescription>Giriş için kullanıcı adı, şifre ve link gönderimi için e-posta gereklidir.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Kullanıcı Adı</label>
                                            <div className="relative">
                                                <Plus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    className="pl-10 h-11 bg-white/5 border-white/10"
                                                    placeholder="Örn: admin_mehmet"
                                                    value={newUser.username}
                                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">E-Posta</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="email"
                                                    className="pl-10 h-11 bg-white/5 border-white/10"
                                                    placeholder="admin@sirket.com"
                                                    value={newUser.email}
                                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Şifre</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="password"
                                                    className="pl-10 h-11 bg-white/5 border-white/10"
                                                    placeholder="••••••••"
                                                    value={newUser.password}
                                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Rol</label>
                                            <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v })}>
                                                <SelectTrigger className="h-11 bg-white/5 border-white/10">
                                                    <SelectValue placeholder="Rol Seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Yönetici (Admin)</SelectItem>
                                                    <SelectItem value="moderator">Moderatör (Sadece Okuma)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
                                            <Button type="button" variant="ghost" onClick={() => setShowAddUser(false)}>İptal</Button>
                                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 font-bold px-8" disabled={saving === "create_user"}>
                                                {saving === "create_user" ? "Oluşturuluyor..." : "Oluştur"}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        {editingUser && (
                            <Card className="bg-slate-900 border-white/10 shadow-2xl relative mb-8">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                <Pencil className="h-4 w-4 text-blue-500" />
                                            </div>
                                            Yönetici Hesap Bilgilerini Düzenle
                                        </CardTitle>
                                        <Button variant="ghost" size="icon" onClick={() => setEditingUser(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <CardDescription>
                                        Mevcut yönetici bilgilerini ve şifresini güncelleyebilirsiniz. Şifre alanı boş bırakılırsa, şifre değişmez.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                    <UserPlus className="h-3 w-3" /> Kullanıcı Adı
                                                </label>
                                                <Input
                                                    placeholder="Örn: oytun"
                                                    value={editingUser.username}
                                                    onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                                                    className="h-11 bg-white/5 border-white/10 text-lg font-bold"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                    <Mail className="h-3 w-3" /> E-posta
                                                </label>
                                                <Input
                                                    type="email"
                                                    placeholder="yonetici@gmail.com"
                                                    value={editingUser.email}
                                                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                                                    className="h-11 bg-white/5 border-white/10 text-lg"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                    <Lock className="h-3 w-3" /> Yeni Şifre (Güncellemek İstiyorsanız)
                                                </label>
                                                <Input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={editingUser.password || ""}
                                                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                                                    className="h-11 bg-white/5 border-white/10 font-mono tracking-widest text-lg"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                        <Shield className="h-3 w-3" /> Rol
                                                    </label>
                                                    <Select value={editingUser.role} onValueChange={v => setEditingUser({ ...editingUser, role: v })}>
                                                        <SelectTrigger className="h-11 bg-white/5 border-white/10">
                                                            <SelectValue placeholder="Rol Seçin" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Yönetici (Admin)</SelectItem>
                                                            <SelectItem value="moderator">Moderatör (Sadece Okuma)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                        <Shield className="h-3 w-3" /> Durum
                                                    </label>
                                                    <Select value={editingUser.is_active ? "true" : "false"} onValueChange={v => setEditingUser({ ...editingUser, is_active: v === "true" })}>
                                                        <SelectTrigger className="h-11 bg-white/5 border-white/10">
                                                            <SelectValue placeholder="Durum Seçin" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="true">Aktif</SelectItem>
                                                            <SelectItem value="false">Pasif</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
                                            <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>İptal</Button>
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold px-8" disabled={saving === "update_user"}>
                                                {saving === "update_user" ? "Güncelleniyor..." : "Kaydet"}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Yönetici Listesi</CardTitle>
                                <CardDescription>Sisteme erişimi olan tüm yöneticiler.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-white/5 text-muted-foreground text-xs uppercase tracking-wider">
                                                <th className="px-4 py-3 font-bold">Kullanıcı</th>
                                                <th className="px-4 py-3 font-bold">Email</th>
                                                <th className="px-4 py-3 font-bold">Rol</th>
                                                <th className="px-4 py-3 font-bold text-right">İşlemler</th>
                                                <th className="px-4 py-3 font-bold text-right">Durum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {adminUsers.map((user) => (
                                                <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                                                {user.username[0].toUpperCase()}
                                                            </div>
                                                            <span className="font-bold">{user.username}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-muted-foreground">{user.email}</td>
                                                    <td className="px-4 py-4">
                                                        <Badge variant="outline" className="text-[10px] uppercase">{user.role}</Badge>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-blue-500 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => setEditingUser({ ...user, password: "" })}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleDeleteUser(user.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <Badge className={user.is_active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>
                                                            {user.is_active ? "Aktif" : "Pasif"}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }
            {workerConflict && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <Card className="bg-slate-900/95 border-amber-500/50 shadow-2xl w-full max-w-md">
                        <CardHeader className="border-b border-white/5">
                            <CardTitle className="flex items-center gap-2 text-amber-400">
                                <AlertCircle className="h-5 w-5" />
                                Worker Çalışıyor
                            </CardTitle>
                            <CardDescription>
                                Job #{workerConflict.jobId} zaten çalışıyor veya takılı. İptal edip yeniden başlatmak ister misiniz?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 flex gap-3">
                            <Button
                                className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                                variant="outline"
                                onClick={handleCancelAndRetry}
                            >
                                <StopCircle className="h-4 w-4 mr-2" /> İptal Et ve Yeniden Başlat
                            </Button>
                            <Button variant="ghost" onClick={() => setWorkerConflict(null)}>
                                Vazgeç
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
            {showWorkerModal && workerJob && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <Card className="bg-slate-900/90 border-white/10 shadow-2xl w-full max-w-lg overflow-hidden">
                        <CardHeader className="border-b border-white/5 pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                                        <RefreshCw className={`h-5 w-5 text-primary ${workerJob.status === 'running' ? 'animate-spin' : ''}`} />
                                        Kuponlar Çekiliyor...
                                    </CardTitle>
                                    <CardDescription className="mt-1">{workerJob.event_name}</CardDescription>
                                </div>
                                <Badge className={
                                    workerJob.status === 'completed' ? 'bg-emerald-500' :
                                        workerJob.status === 'failed' ? 'bg-red-500' :
                                            workerJob.status === 'cancelled' ? 'bg-orange-500' :
                                                'bg-primary animate-pulse'
                                }>
                                    {workerJob.status === 'running' ? 'Taranıyor' :
                                        workerJob.status === 'completed' ? 'Bitti' :
                                            workerJob.status === 'cancelled' ? 'İptal Edildi' : 'Bekliyor'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            {/* Progress Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex flex-col items-center">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Taranan Kupon</span>
                                    <span className="text-xl font-black">{workerJob.processed ?? 0}</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex flex-col items-center">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Yeni Kupon</span>
                                    <span className="text-xl font-black text-emerald-400">+{workerJob.saved ?? 0}</span>
                                </div>
                            </div>

                            {/* Süre - her zaman görünür */}
                            <div className="flex flex-wrap gap-4 items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-sm font-bold flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-primary" />
                                    Geçen süre: <span className="text-primary">{workerStartTime ? (workerElapsedSeconds >= 60 ? `${Math.floor(workerElapsedSeconds / 60)}dk ${workerElapsedSeconds % 60}sn` : `${workerElapsedSeconds}sn`) : '—'}</span>
                                </span>
                                {(workerJob.status === 'running' || workerJob.status === 'pending') && (
                                    <span className="text-sm font-bold flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-amber-400" />
                                        Tahmini: <span className="text-amber-400">
                                            {(() => {
                                                const est = workerEstimatedSeconds ?? 120
                                                const remaining = Math.max(0, Math.round(est - workerElapsedSeconds))
                                                return remaining >= 60 ? `${Math.floor(remaining / 60)}dk ${remaining % 60}sn` : `${remaining}sn`
                                            })()}
                                        </span>
                                    </span>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span>İlerleme: {workerJob.status === 'completed' || workerJob.status === 'failed' || workerJob.status === 'cancelled' ? '%100' : 'İşleniyor...'}</span>
                                </div>
                                <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                    <div
                                        className={`h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out ${(workerJob.status === 'running' || workerJob.status === 'pending') ? 'animate-pulse' : ''}`}
                                        style={{ width: `${workerJob.status === 'completed' || workerJob.status === 'failed' || workerJob.status === 'cancelled' ? 100 : 15}%` }}
                                    />
                                </div>
                            </div>

                            {/* Info Text */}
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <p className="text-[11px] text-blue-400 leading-relaxed italic">
                                    <Info className="h-3 w-3 inline mr-1 mb-0.5" />
                                    BetConstruct API üzerinden kullanıcıların bahis geçmişi taranıyor. Aktif kampanyaya uygun kuponlar otomatik olarak eşlenir.
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2 pt-2">
                                {workerJob.status === 'running' && (
                                    <Button
                                        variant="outline"
                                        className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10 font-bold"
                                        onClick={() => handleCancelJob(workerJob.id)}
                                    >
                                        <StopCircle className="h-4 w-4 mr-2" /> İşlemi Durdur
                                    </Button>
                                )}
                                {(workerJob.status === 'completed' || workerJob.status === 'failed' || workerJob.status === 'cancelled') && (
                                    <Button
                                        className="w-full bg-primary font-bold"
                                        onClick={() => setShowWorkerModal(false)}
                                    >
                                        Kapat
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </AdminLayout>
    )
}

function StatCard({ title, value, icon: Icon, color }: any) {
    return (
        <Card className="bg-card/40 border-white/5 hover:border-primary/20 transition-all group overflow-hidden relative">
            <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                <Icon className={`h-24 w-24 ${color}`} />
            </div>
            <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-black tracking-widest">{title}</CardDescription>
                <CardTitle className="text-3xl font-black italic">{value}</CardTitle>
            </CardHeader>
        </Card>
    )
}

