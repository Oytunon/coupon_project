"""add_event_lost_coupons

Revision ID: a7c8e9f0b1d2
Revises: 5f39b72b3a15
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a7c8e9f0b1d2"
down_revision: Union[str, None] = "5f39b72b3a15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_lost_coupons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("coupon_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("stake", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["coupon_id"], ["coupons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "coupon_id", name="uq_event_lost_coupon"),
    )
    op.create_index(op.f("ix_event_lost_coupons_id"), "event_lost_coupons", ["id"], unique=False)
    op.create_index(op.f("ix_event_lost_coupons_event_id"), "event_lost_coupons", ["event_id"], unique=False)
    op.create_index(op.f("ix_event_lost_coupons_coupon_id"), "event_lost_coupons", ["coupon_id"], unique=False)
    op.create_index(op.f("ix_event_lost_coupons_client_id"), "event_lost_coupons", ["client_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_lost_coupons_client_id"), table_name="event_lost_coupons")
    op.drop_index(op.f("ix_event_lost_coupons_coupon_id"), table_name="event_lost_coupons")
    op.drop_index(op.f("ix_event_lost_coupons_event_id"), table_name="event_lost_coupons")
    op.drop_index(op.f("ix_event_lost_coupons_id"), table_name="event_lost_coupons")
    op.drop_table("event_lost_coupons")
