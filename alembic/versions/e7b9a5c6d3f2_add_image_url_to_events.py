"""add_image_url_to_events

Revision ID: e7b9a5c6d3f2
Revises: 4b108025c3c5
Create Date: 2026-02-12 17:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7b9a5c6d3f2'
down_revision: Union[str, None] = '4b108025c3c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility if needed, 
    # but Postgres is fine with op.add_column
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('image_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_column('image_url')
