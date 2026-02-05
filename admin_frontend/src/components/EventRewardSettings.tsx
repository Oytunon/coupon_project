
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Gift, Trophy, Target } from "lucide-react"

interface RewardRule {
    reward_type: string
    amount: number
    currency: string
    criteria_type: string
    criteria_value: number
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

    const handleAdd = () => {
        onChange([...rewards, newReward])
    }

    const handleRemove = (index: number) => {
        onChange(rewards.filter((_, i) => i !== index))
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
                                {/* Future types can be added here */}
                                <SelectItem value="bonus">Bonus (Yakında)</SelectItem>
                                <SelectItem value="freebet">Freebet (Yakında)</SelectItem>
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
                            {newReward.criteria_type === 'rank' ? "Örn: 10 (İlk 10 kişiye verilir)" : "Örn: 5000 (5000 puanı geçenlere verilir)"}
                        </p>
                    </div>
                </div>

                <Button onClick={handleAdd} type="button" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" /> Kuralı Ekle
                </Button>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <Gift className="h-4 w-4" /> Tanımlı Ödüller ({rewards.length})
                </h3>

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
                                            <Badge variant="secondary" className="text-[10px] uppercase">{rule.reward_type}</Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            {rule.criteria_type === 'rank' ? (
                                                <><Trophy className="h-3 w-3 text-amber-500" /> İlk {rule.criteria_value} Kişi</>
                                            ) : (
                                                <><Target className="h-3 w-3 text-blue-400" /> +{rule.criteria_value} Puan</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button size="icon" type="button" variant="ghost" className="text-red-500 opacity-50 group-hover:opacity-100 hover:bg-red-500/10" onClick={() => handleRemove(idx)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
