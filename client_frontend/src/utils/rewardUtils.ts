export interface RewardRule {
    reward_type?: string
    amount: number
    currency?: string
    criteria_type: 'rank' | 'rank_exact' | 'min_points' | string
    criteria_value: number
    partner_bonus_id?: number
}

export interface LabeledRewardRule extends RewardRule {
    _label: string
    _winnerCount: number
}

function parseRewards(rules: any): RewardRule[] {
    if (!rules) return []
    let validRules = rules
    if (typeof rules === 'string') {
        try { validRules = JSON.parse(rules) } catch { return [] }
    }
    return Array.isArray(validRules?.rewards) ? validRules.rewards : []
}

// Kurallar "ilk uyan kural kazanır" sırasıyla değerlendirilir (bkz. reward_worker.py /
// shared/domain/reward_distribution.py), yani bir 'rank' kuralı yalnızca önceki, daha
// dar kuralların bıraktığı sıra aralığını ödüllendirir. Etiketi ve o aralıktaki kazanan
// sayısını (havuz toplamını doğru hesaplamak için) buna göre üretiyoruz.
export function buildLabeledRewards(rewards: RewardRule[]): LabeledRewardRule[] {
    let runningMaxRank = 0
    return rewards.map((r) => {
        let label = 'Ödül'
        let winnerCount = 1
        if (r.criteria_type === 'rank_exact') {
            label = `${r.criteria_value}. Sıra`
            runningMaxRank = Math.max(runningMaxRank, r.criteria_value)
        } else if (r.criteria_type === 'rank') {
            const start = runningMaxRank + 1
            const end = r.criteria_value
            label = start >= end ? `${end}. Sıra` : `${start}. Sıra - ${end}. Sıra`
            winnerCount = Math.max(0, end - runningMaxRank)
            runningMaxRank = Math.max(runningMaxRank, end)
        } else if (r.criteria_type === 'min_points') {
            label = `${r.criteria_value}+ Puan`
            // Kazanan sayısı puan barajını kimlerin geçeceğine bağlı, kurallardan önceden bilinemez.
        }
        return { ...r, _label: label, _winnerCount: winnerCount }
    })
}

// Toplam ödül havuzu: her kuralın miktarı, o kuralın gerçekte ödüllendirdiği kişi
// sayısıyla çarpılarak toplanır (örn. "8. Sıra - 20. Sıra" için 6.000 TL x 13 kişi).
export function calculateTotalPrize(rules: any): number {
    const rewards = parseRewards(rules)
    if (rewards.length === 0) return 0
    return buildLabeledRewards(rewards).reduce(
        (acc, r) => acc + (Number(r.amount) || 0) * r._winnerCount,
        0
    )
}
