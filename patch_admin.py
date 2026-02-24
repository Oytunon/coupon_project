import re

file_path = 'c:\\Users\\newon\\PyCharmMiscProject\\coupon_project\\admin_frontend\\src\\pages\\AdminPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update activeTab definition
old_tabs = 'useState<"dashboard" | "events" | "participants" | "users">("dashboard")'
new_tabs = 'useState<"dashboard" | "events" | "participants" | "users" | "leagues">("dashboard")'
if old_tabs in content:
    content = content.replace(old_tabs, new_tabs)

# 2. Add API functions before "export default function AdminPage()"
api_funcs = '''
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

export default function AdminPage() {
'''
if 'const createLeague = async' not in content:
    content = content.replace('export default function AdminPage() {', api_funcs)

# 3. Add States for Leagues inside AdminPage
states = '''
    const [leaguesData, setLeaguesData] = useState<any[]>([])
    const [loadingLeagues, setLoadingLeagues] = useState(false)
    const [showAddLeague, setShowAddLeague] = useState(false)
    const [editingLeague, setEditingLeague] = useState<any | null>(null)
    const [newLeague, setNewLeague] = useState({ id: "", name: "", sport_id: 1, region: "" })
    
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
        } catch(err: any) {
            toast({ title: "Hata", description: err?.response?.data?.detail || "İşlem başarısız", variant: "destructive" })
        }
    }
    
    const handleDeleteLeague = async (id: number) => {
        if(confirm("Bu ligi silmek istediğinize emin misiniz?")) {
            try {
                await deleteLeague(id)
                toast({ title: "Başarılı", description: "Lig silindi" })
                loadLeaguesData()
            } catch(e) {
                toast({ title: "Hata", description: "Silme işlemi başarısız", variant: "destructive" })
            }
        }
    }
'''
if 'const [leaguesData, setLeaguesData]' not in content:
    content = content.replace('const [searchQuery, setSearchQuery] = useState("")', 'const [searchQuery, setSearchQuery] = useState("")' + states)

# 4. Add UI block for activeTab === 'leagues'
ui_block = '''
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
                    
                    {showAddLeague && (
                        <Card className="bg-card/50 border-white/5 backdrop-blur-xl animate-in slide-in-from-top-4">
                            <CardHeader>
                                <CardTitle>{editingLeague ? "Ligi Düzenle" : "Yeni Lig Ekle"}</CardTitle>
                                <CardDescription>Bir ligin BetConstruct ID'sini girebilir ve bir isim belirleyebilirsiniz.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSaveLeague} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground uppercase">Lig ID (Sayısal)</label>
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
                                            onValueChange={v => setNewLeague({...newLeague, sport_id: parseInt(v)})}
                                        >
                                            <SelectTrigger className="h-11 bg-white/5 border-white/10">
                                                <SelectValue placeholder="Spor Seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Futbol (1)</SelectItem>
                                                <SelectItem value="2">Basketbol (2)</SelectItem>
                                                <SelectItem value="3">Tenis (3)</SelectItem>
                                                <SelectItem value="4">Buz Hokeyi (4)</SelectItem>
                                                <SelectItem value="5">Voleybol (5)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-4 flex justify-end gap-2 mt-2">
                                        <Button type="button" variant="outline" onClick={() => setShowAddLeague(false)}>İptal</Button>
                                        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 font-bold">Kaydet</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
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
                                    {leaguesData.map((league) => (
                                        <tr key={league.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4"><Badge variant="outline" className="font-mono">#{league.id}</Badge></td>
                                            <td className="px-6 py-4 font-medium text-white">{league.name}</td>
                                            <td className="px-6 py-4"><Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">{league.sport_id === 1 ? 'Futbol' : league.sport_id === 2 ? 'Basketbol' : league.sport_id === 3 ? 'Tenis' : 'Diğer (' + league.sport_id + ')'}</Badge></td>
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
                                    {leaguesData.length === 0 && !loadingLeagues && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Kayıtlı lig bulunamadı</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
'''
if "activeTab === 'leagues'" not in content:
    content = content.replace("{activeTab === 'dashboard' &&", ui_block + "\\n            {activeTab === 'dashboard' &&")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patching complete.")
