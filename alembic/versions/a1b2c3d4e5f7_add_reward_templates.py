"""add reward_templates table

Revision ID: a1b2c3d4e5f7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-13 16:20:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f7'
down_revision = 'd1e2f3a4b5c6' # This refers to the html_templates migration I just pushed
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tablo var mı diye kontrol et
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'reward_templates' not in inspector.get_table_names():
        op.create_table(
            'reward_templates',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('reward_data', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
    op.create_index(op.f('ix_reward_templates_id'), 'reward_templates', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_reward_templates_id'), table_name='reward_templates')
    op.drop_table('reward_templates')
