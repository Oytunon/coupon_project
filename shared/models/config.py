from sqlalchemy import Column, Integer, String, Float, Text, JSON
from shared.database import Base


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)

    @classmethod
    def get_default_configs(cls):
        return [
            {"key": "min_stake", "value": 100.0, "description": "Minimum kupon bahis miktari"},
            {"key": "min_odd", "value": 1.50, "description": "Minimum kupon oran"},
            {"key": "min_combination", "value": 2, "description": "Minimum kupon kombinasyon sayısı"},
            {"key": "allowed_league_ids", "value": [
                3013, 18290431, 38243, 36951, 18957, 538, 541, 18260269, 36941, 36940,
                545, 756, 686, 566, 18290799, 18278228, 35958, 35957, 19204, 1861,
                18260607, 18278410, 18290430, 18260074, 543, 18290433, 557, 1957,
                18291746, 560
            ], "description": "Allowed league IDs for the tournament"},
            {"key": "points_multiplier", "value": 1.0, "description": "Multiplier for points calculation"},
        ]
