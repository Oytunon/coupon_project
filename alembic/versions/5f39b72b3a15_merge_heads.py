"""merge_heads

Revision ID: 5f39b72b3a15
Revises: a1b2c3d4e5f6, f1a2b3c4d5e6
Create Date: 2026-02-27 16:18:03.522669

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f39b72b3a15'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
