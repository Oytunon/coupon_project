"""
Ödül dağıtımı için dedupe (tekilleştirme) defteri.

Bu tablo mevcut RewardJob.results (JSONB) akışının YERİNE geçmiyor — okuma tarafındaki
hiçbir endpoint (admin reward-history, client reward-winners/my-rewards, reward_claim
find_pending_claim) burayı kullanmıyor, hepsi bugünkü gibi RewardJob.results'ı okumaya
devam ediyor.

Tek görevi: reward_worker bir client'a event bazında ödül göndermeden ÖNCE buraya bir
satır eklemeyi denemek (event_id, client_id) üzerindeki UNIQUE kısıt sayesinde, aynı
client'a aynı event için ikinci kez gönderim yapılmasını veritabanı seviyesinde
imkansız hale getirmek — job tekrarında (retry/çift job) çifte ödeme riskine karşı.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from shared.database import Base


class RewardPayout(Base):
    __tablename__ = "reward_payouts"
    __table_args__ = (
        UniqueConstraint("event_id", "client_id", name="uq_reward_payouts_event_client"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    reward_job_id = Column(Integer, ForeignKey("reward_jobs.id", ondelete="SET NULL"), nullable=True)

    client_id = Column(Integer, nullable=False, index=True)
    reward_type = Column(String(20), nullable=False)  # cash, bonus, spin, freebet
    amount = Column(Float, nullable=True)
    criteria_type = Column(String(50), nullable=True)
    criteria_value = Column(Float, nullable=True)
    partner_bonus_id = Column(Integer, nullable=True)

    # pending -> gönderim kilidini bu satır aldı ama henüz sonuçlanmadı
    # success / failed -> cash/bonus gönderim sonucu
    # pending_claim -> freebet/spin, kullanıcı client'tan alacak
    status = Column(String(20), nullable=False, default="pending")
    bapi_response = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, server_default=func.now())
    sent_at = Column(DateTime, nullable=True)
