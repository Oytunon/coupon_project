"""add_content_rules_to_events

Revision ID: e9549d4264ee
Revises: 5f39b72b3a15
Create Date: 2026-02-27 16:18:21.989896

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9549d4264ee'
down_revision: Union[str, None] = '5f39b72b3a15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    op.add_column('events', sa.Column('content_rules', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('events', 'content_rules')
