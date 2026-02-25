"""add_total_count_to_worker_log

Revision ID: a1b2c3d4e5f6
Revises: e7b9a5c6d3f2
Create Date: 2026-02-25 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e7b9a5c6d3f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('worker_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('total_count', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('worker_logs', schema=None) as batch_op:
        batch_op.drop_column('total_count')
