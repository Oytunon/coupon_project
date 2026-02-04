from sqlalchemy import Column, Integer, String, Index
from shared.database import Base

class League(Base):
    __tablename__ = "leagues"

    id = Column(Integer, primary_key=True, index=True) # Direct mapping to BetConstruct CompetitionId
    name = Column(String, index=True)
    sport_id = Column(Integer, nullable=True) # Optional, future proofing
    region = Column(String, nullable=True) # Optional, e.g. "Europe"

    # Index for faster searching by name
    __table_args__ = (
        Index('ix_leagues_name_search', 'name'),
    )

    def __repr__(self):
        return f"<League(id={self.id}, name='{self.name}')>"
