from pydantic import BaseModel


class ParticipationStatus(BaseModel):
    user_id: int
    can_participate: bool
    reason: str
