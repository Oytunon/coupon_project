"""add content_rules_html to events

Revision ID: c9f1a2b3c4d5
Revises: b7d2a5f8e3c1, b8e3f0a1c2d3
Create Date: 2026-03-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c9f1a2b3c4d5"
down_revision: Union[str, tuple, None] = ("b7d2a5f8e3c1", "b8e3f0a1c2d3")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("content_rules_html", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "content_rules_html")
