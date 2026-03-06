"""add excluded_bet_cache table

Revision ID: 4ab041b28058
Revises: f1a2b3c4d5e6
Create Date: 2026-03-06 14:49:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4ab041b28058'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'excluded_bet_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bet_id', sa.String(length=64), nullable=False),
        sa.Column('client_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_excluded_bet_cache_bet_id'), 'excluded_bet_cache', ['bet_id'], unique=True)
    op.create_index(op.f('ix_excluded_bet_cache_client_id'), 'excluded_bet_cache', ['client_id'], unique=False)
    op.create_index(op.f('ix_excluded_bet_cache_id'), 'excluded_bet_cache', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_excluded_bet_cache_id'), table_name='excluded_bet_cache')
    op.drop_index(op.f('ix_excluded_bet_cache_client_id'), table_name='excluded_bet_cache')
    op.drop_index(op.f('ix_excluded_bet_cache_bet_id'), table_name='excluded_bet_cache')
    op.drop_table('excluded_bet_cache')
