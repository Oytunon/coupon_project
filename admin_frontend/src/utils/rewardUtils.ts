export interface RewardRule {
    reward_type?: string
    amount: number
    currency?: string
    criteria_type: 'rank' | 'rank_exact' | 'min_points' | string
    criteria_value: number
    partner_bonus_id?: number
}

// Kurallar "ilk uyan kural kazanır" sırasıyla değerlendirilir (bkz. reward_worker.py /
// shared/domain/reward_distribution.py), yani bir 'rank' kuralı yalnızca önceki, daha
// dar kuralların bıraktığı sıra aralığını ödüllendirir. Toplam ödül havuzunu doğru
// hesaplamak için her kuralın miktarını, gerçekte ödüllendirdiği kişi sayısıyla çarpıyoruz
// (örn. "8. Sıra - 20. Sıra" için 6.000 TL x 13 kişi).
export function calculateTotalPrize(rewards: RewardRule[]): number {
    if (!Array.isArray(rewards) || rewards.length === 0) return 0
    let runningMaxRank = 0
    return rewards.reduce((acc, r) => {
        const amount = Number(r.amount) || 0
        let winnerCount = 1
        if (r.criteria_type === 'rank_exact') {
            winnerCount = 1
            runningMaxRank = Math.max(runningMaxRank, r.criteria_value)
        } else if (r.criteria_type === 'rank') {
            const end = r.criteria_value
            winnerCount = Math.max(0, end - runningMaxRank)
            runningMaxRank = Math.max(runningMaxRank, end)
        }
        // min_points: kazanan sayısı önceden bilinemez, tek kişilik miktar olarak sayılır.
        return acc + amount * winnerCount
    }, 0)
}
