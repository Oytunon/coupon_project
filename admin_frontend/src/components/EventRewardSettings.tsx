
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Gift, Trophy, Target, ChevronUp, ChevronDown, AlertCircle, Save, ClipboardList } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { apiClient } from "../api/client"
import { useToast } from "@/hooks/use-toast"

interface RewardRule {
    reward_type: string
    amount: number
    currency: string
    criteria_type: string
    criteria_value: number
    partner_bonus_id?: number
}

interface EventRewardSettingsProps {
    rewards: RewardRule[]
    onChange: (rewards: RewardRule[]) => void
}

export function EventRewardSettings({ rewards = [], onChange }: EventRewardSettingsProps) {
    const [newReward, setNewReward] = useState<RewardRule>({
        reward_type: "cash",
        amount: 100,
        currency: "TRY",
        criteria_type: "rank",
        criteria_value: 10
    })

    const { toast } = useToast()
    const [templates, setTemplates] = useState<any[]>([])
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
    const [showSaveInput, setShowSaveInput] = useState(false)
    const [templateName, setTemplateName] = useState("")
    const [saving, setSaving] = useState(false)

    const fetchTemplates = async () => {
        try {
            const res = await apiClient.get('/admin/reward-templates')
            setTemplates(res.data)
        } catch (err) {
            console.error("Templates fetch error", err)
        }
    }

    const handleSaveTemplate = async () => {
        if (!templateName.trim() || rewards.length === 0) return
        setSaving(true)
        try {
            await apiClient.post('/admin/reward-templates', {
                name: templateName.trim(),
                reward_data: rewards
            })
            toast({ title: "Şablon kaydedildi" })
            setTemplateName("")
            setShowSaveInput(false)
            fetchTemplates()
        } catch (err) {
            toast({ title: "Hata", description: "Şablon kaydedilemedi", variant: "destructive" })
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteTemplate = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await apiClient.delete(`/admin/reward-templates/${id}`)
            fetchTemplates()
        } catch (err) {
            toast({ title: "Hata", description: "Şablon silinemedi", variant: "destructive" })
        }
    }

    const handleAdd = () => {
        onChange([...rewards, newReward])
    }

    const handleRemove = (index: number) => {
        onChange(rewards.filter((_, i) => i !== index))
    }

    const moveUp = (index: number) => {
        if (index === 0) return
        const newRewards = [...rewards]
        const temp = newRewards[index]
        newRewards[index] = newRewards[index - 1]
        newRewards[index - 1] = temp
        onChange(newRewards)
    }

    const moveDown = (index: number) => {
        if (index === rewards.length - 1) return
        const newRewards = [...rewards]
        const temp = newRewards[index]
        newRewards[index] = newRewards[index + 1]
        newRewards[index + 1] = temp
        onChange(newRewards)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Yeni Ödül Kuralı Ekle
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-primary">Ödül Türü</label>
                        <Select
                            value={newReward.reward_type}
                            onValueChange={(val) => setNewReward({ ...newReward, reward_type: val })}
                        >
                            <SelectTrigger className="bg-black/20 border-primary/20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Nakit (Cash)</SelectItem>
                                <SelectItem value="spin">Free Spin</SelectItem>
                                <SelectItem value="freebet">Freebet</SelectItem>
                                <SelectItem value="bonus">Diğer Bonuslar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-primary">Miktar</label>
                        <div className="relative">
                            <Input
                                type="number"
                                value={newReward.amount}
                                onChange={e => setNewReward({ ...newReward, amount: parseFloat(e.target.value) })}
                                className="bg-black/20 border-primary/20 pl-8"
                            />
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">{newReward.currency}</span>
                        </div>

                        {newReward.reward_type !== 'cash' && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-amber-500">Partner Bonus ID</label>
                                <Input
                                    type="number"
                                    placeholder="Örn: 206675"
                                    value={newReward.partner_bonus_id || ''}
                                    onChange={e => setNewReward({ ...newReward, partner_bonus_id: parseInt(e.target.value) })}
                                    className="bg-black/20 border-amber-500/20"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-400">Kriter</label>
                        <Select
                            value={newReward.criteria_type}
                            onValueChange={(val) => setNewReward({ ...newReward, criteria_type: val })}
                        >
                            <SelectTrigger className="bg-black/20 border-blue-500/20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="rank">Sıralama (İlk X Kişi)</SelectItem>
                                <SelectItem value="rank_exact">Tam Sıralama (Sadece X. Kişi)</SelectItem>
                                <SelectItem value="min_points">Puan Barajı (Puan {'>'} X)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-400">Değer</label>
                        <Input
                            type="number"
                            value={newReward.criteria_value}
                            onChange={e => setNewReward({ ...newReward, criteria_value: parseInt(e.target.value) })}
                            className="bg-black/20 border-blue-500/20"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            {newReward.criteria_type === 'rank' && "Örn: 10 (İlk 10 kişiye verilir)"}
                            {newReward.criteria_type === 'rank_exact' && "Örn: 1 (Sadece 1. kişiye verilir)"}
                            {newReward.criteria_type === 'min_points' && "Örn: 5000 (5000 puanı geçenlere verilir)"}
                        </p>
                    </div>
                </div>

                <Button onClick={handleAdd} type="button" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" /> Kuralı Ekle
                </Button>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                        <Gift className="h-4 w-4" /> Tanımlı Ödüller ({rewards.length})
                    </h3>
                    
                    <div className="flex items-center gap-2 relative">
                        {/* Şablonu Kaydet */}
                        {showSaveInput ? (
                            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                                <Input 
                                    autoFocus
                                    placeholder="Şablon adı..." 
                                    className="h-7 w-32 bg-black/40 border-primary/30 text-[10px] py-0"
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                />
                                <Button size="sm" className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveTemplate} disabled={saving}>
                                    {saving ? "..." : "Tamam"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setShowSaveInput(false)}>X</Button>
                            </div>
                        ) : (
                            <Button
                                type="button" size="sm" variant="outline"
                                className="h-7 px-2 text-[10px] gap-1 border-white/10 text-white/50 hover:text-white hover:border-primary/50"
                                onClick={() => setShowSaveInput(true)}
                                disabled={rewards.length === 0}
                            >
                                <Save className="h-3 w-3" /> Şablon Kaydet
                            </Button>
                        )}

                        {/* Şablonları Listele */}
                        <div className="relative">
                            <Button
                                type="button" size="sm" variant="outline"
                                className="h-7 px-2 text-[10px] gap-1 border-white/10 text-white/50 hover:text-white hover:border-primary/50"
                                onClick={() => {
                                    if (!showTemplateDropdown) fetchTemplates()
                                    setShowTemplateDropdown(!showTemplateDropdown)
                                }}
                            >
                                <ClipboardList className="h-3 w-3" /> Kaydedilen Şablonlar ▾
                            </Button>

                            {showTemplateDropdown && (
                                <div className="absolute right-0 top-8 z-50 w-64 rounded-lg border border-white/10 bg-[#1a1a2e] shadow-2xl py-1 animate-in fade-in slide-in-from-top-2">
                                    {templates.length === 0 ? (
                                        <div className="px-3 py-4 text-center text-[10px] text-muted-foreground italic">
                                            Henüz şablon bulunmuyor.
                                        </div>
                                    ) : (
                                        templates.map(t => (
                                            <div key={t.id} className="flex items-center justify-between px-3 py-2 hover:bg-white/5 group cursor-pointer" onClick={() => { onChange(t.reward_data); setShowTemplateDropdown(false); }}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-bold text-white/90 truncate">{t.name}</div>
                                                    <div className="text-[9px] text-white/40">{t.reward_data.length} Ödül Kuralı</div>
                                                </div>
                                                <button 
                                                    onClick={(e) => handleDeleteTemplate(t.id, e)}
                                                    className="ml-2 h-6 w-6 rounded flex items-center justify-center text-red-400/30 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {rewards.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                         <span className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
                            Toplam: {new Intl.NumberFormat('tr-TR').format(rewards.reduce((acc, r) => acc + (Number(r.amount) || 0), 0))} TL
                        </span>
                    </div>
                )}

                {rewards.length > 0 && (
                    <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-xs font-bold uppercase">Önemli: Ödül Önceliği</AlertTitle>
                        <AlertDescription className="text-[11px]">
                            Ödüller yukarıdan aşağıya doğru kontrol edilir. Bir kullanıcı uyan <b>ilk kuraldan</b> ödülünü alır ve diğerlerini es geçer.
                            En özel ödülleri (Örn: 1.lik ödülü) her zaman en üste taşıyın.
                        </AlertDescription>
                    </Alert>
                )}

                {rewards.length === 0 ? (
                    <div className="text-center py-8 bg-white/5 rounded-lg border border-dashed border-white/10 text-muted-foreground text-sm">
                        Henüz ödül kuralı eklenmedi.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {rewards.map((rule, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <Badge variant="outline" className="h-8 w-8 rounded-full flex items-center justify-center border-primary/50 bg-primary/10 text-primary font-bold">
                                        {idx + 1}
                                    </Badge>
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            <span className="text-emerald-400">{rule.amount} {rule.currency}</span>
                                            <Badge variant="secondary" className="text-[10px] uppercase">
                                                {rule.reward_type}
                                                {rule.partner_bonus_id && ` (ID: ${rule.partner_bonus_id})`}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            {rule.criteria_type === 'rank' ? (
                                                <><Trophy className="h-3 w-3 text-amber-500" /> İlk {rule.criteria_value} Kişi</>
                                            ) : rule.criteria_type === 'rank_exact' ? (
                                                <><Trophy className="h-3 w-3 text-purple-500" /> Sadece {rule.criteria_value}. Kişi</>
                                            ) : (
                                                <><Target className="h-3 w-3 text-blue-400" /> +{rule.criteria_value} Puan</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground hover:text-white"
                                        disabled={idx === 0}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveUp(idx); }}
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground hover:text-white"
                                        disabled={idx === rewards.length - 1}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveDown(idx); }}
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" type="button" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => handleRemove(idx)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
