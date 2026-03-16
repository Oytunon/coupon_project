"""add_event_excluded_from_ranking

Revision ID: b8e3f0a1c2d3
Revises: a7c8e9f0b1d2
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b8e3f0a1c2d3"
down_revision: Union[str, None] = "a7c8e9f0b1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_excluded_from_ranking",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("bet_id", sa.String(64), nullable=False),
        sa.Column("stake", sa.Float(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "bet_id", name="uq_event_excluded_bet"),
    )
    op.create_index(op.f("ix_event_excluded_from_ranking_id"), "event_excluded_from_ranking", ["id"], unique=False)
    op.create_index(op.f("ix_event_excluded_from_ranking_event_id"), "event_excluded_from_ranking", ["event_id"], unique=False)
    op.create_index(op.f("ix_event_excluded_from_ranking_client_id"), "event_excluded_from_ranking", ["client_id"], unique=False)
    op.create_index(op.f("ix_event_excluded_from_ranking_bet_id"), "event_excluded_from_ranking", ["bet_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_excluded_from_ranking_bet_id"), table_name="event_excluded_from_ranking")
    op.drop_index(op.f("ix_event_excluded_from_ranking_client_id"), table_name="event_excluded_from_ranking")
    op.drop_index(op.f("ix_event_excluded_from_ranking_event_id"), table_name="event_excluded_from_ranking")
    op.drop_index(op.f("ix_event_excluded_from_ranking_id"), table_name="event_excluded_from_ranking")
    op.drop_table("event_excluded_from_ranking")
