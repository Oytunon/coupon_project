"""merge heads

Revision ID: f2e3d4c5b6a7
Revises: ('a1b2c3d4e5f7', 'c9f1a2b3c4d5')
Create Date: 2026-04-13 16:32:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f2e3d4c5b6a7'
down_revision = ('a1b2c3d4e5f7', 'c9f1a2b3c4d5')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
